// === УЧАСТНИКИ КОМАНДЫ И ИХ ПУБЛИЧНЫЕ ПРОФИЛИ ===
// Публичная карточка профиля (имя, фамилия, пол, дата рождения, страна, город, аватар)
// хранится в teamRegistry/{teamId}/private/profiles и доступна ТОЛЬКО участникам этой команды
// (см. обновлённые правила безопасности Firestore).
 
let currentMembersTeamId = null;
let currentMembersProfiles = {};
 
// Публикует профиль текущего пользователя во все команды, в которых он состоит.
// Вызывается после сохранения профиля, смены аватарки, вступления в команду и создания команды.
async function syncPublicProfileToTeams() {
    if (!currentUser || !db) return;
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const data = userDoc.exists ? userDoc.data() : {};
        const localAvatar = localStorage.getItem('clc_avatar_' + currentUser.uid);
        const publicProfile = {
            displayName: data.displayName || currentUser.displayName || '',
            lastName: data.lastName || '',
            gender: data.gender || '',
            birthDate: data.birthDate || '',
            country: data.country || '',
            city: data.city || '',
            avatar: localAvatar || data.avatar || currentUser.photoURL || null,
            updatedAt: Date.now()
        };
        const myTeams = (teams || []).filter(t => t && t.id);
        await Promise.all(myTeams.map(t =>
            db.collection('teamRegistry').doc(t.id).collection('private').doc('profiles')
                .set({ [currentUser.uid]: publicProfile }, { merge: true })
                .catch(err => console.error('Не удалось синхронизировать профиль в команду ' + t.id + ':', err))
        ));
    } catch (err) {
        console.error('syncPublicProfileToTeams error:', err);
    }
}
 
let currentMembersIds = [];
 
// Самопочинка для команд, созданных/полученных ДО появления подколлекции members:
// создаёт свой документ-пропуск teamRegistry/{teamId}/members/{uid} для каждой
// команды, которая уже есть в локальном списке пользователя. Идемпотентно —
// безопасно вызывать при каждом входе в приложение.
async function ensureTeamMemberships() {
    if (!currentUser || !db) return;
    const myTeams = (teams || []).filter(t => t && t.id);
    await Promise.all(myTeams.map(async t => {
        try {
            const memberDoc = await db.collection('teamRegistry').doc(t.id).collection('members').doc(currentUser.uid).get();
            if (!memberDoc.exists) {
                await db.collection('teamRegistry').doc(t.id).collection('members').doc(currentUser.uid).set({ joinedAt: Date.now() });
            }
        } catch (err) {
            console.error('Не удалось создать пропуск участника для команды ' + t.id + ':', err);
        }
    }));
}
 
function openTeamMembers(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    currentMembersTeamId = teamId;
    currentMembersProfiles = {};
    currentMembersIds = team.members || [];
    document.getElementById('team-members-name').innerText = team.name;
    const avatarEl = document.getElementById('team-members-avatar');
    avatarEl.innerHTML = team.avatar ? `<img src="${team.avatar}" alt="">` : '🎸';
    const searchInput = document.getElementById('team-members-search');
    searchInput.value = '';
    document.getElementById('team-members-list').innerHTML = '<div style="text-align:center;color:#888;padding:30px;">Загрузка...</div>';
    document.getElementById('modal-team-members').classList.add('show');
   if (!db || !currentUser) { renderTeamMembersList(); return; }
    db.collection('teamRegistry').doc(teamId).get()
        .then(regDoc => {
            if (regDoc.exists) {
                const regData = regDoc.data();
                if (regData.name) { team.name = regData.name; document.getElementById('team-members-name').innerText = regData.name; }
                if (regData.avatar !== undefined) { team.avatar = regData.avatar; avatarEl.innerHTML = regData.avatar ? `<img src="${regData.avatar}" alt="">` : '🎸'; }
            }
            // Список участников — из подколлекции members (надёжный источник истины,
            // в отличие от устаревшего поля-массива members на самом документе).
            return db.collection('teamRegistry').doc(teamId).collection('members').get();
        })
        .then(membersSnap => {
            currentMembersIds = membersSnap.docs.map(d => d.id);
            return db.collection('teamRegistry').doc(teamId).collection('private').doc('profiles').get();
        })
        .then(doc => {
            currentMembersProfiles = doc.exists ? (doc.data() || {}) : {};
            renderTeamMembersList();
        })
        .catch(err => {
            console.error('Не удалось загрузить участников команды:', err);
            document.getElementById('team-members-list').innerHTML = '<div style="text-align:center;color:#ef5350;padding:30px;">Не удалось загрузить участников</div>';
        });
}
 
function closeTeamMembers() {
    closeModal('modal-team-members');
    currentMembersTeamId = null;
    currentMembersProfiles = {};
}
async function changeTeamMemberRole(uid, newRole) {
    const team = teams.find(t => t.id === currentMembersTeamId);
    if (!team || !currentUser) return;
    if (getMyRole(team.id) !== 'owner') { notAllowedForRole(); return; }
    if (uid === currentUser.uid) { alert('❌ Нельзя менять роль самому себе'); return; }
    const p = currentMembersProfiles[uid] || {};
    const label = [p.displayName, p.lastName].filter(Boolean).join(' ').trim() || 'этого участника';
    const roleNames = { owner: 'владельцем', admin: 'администратором', member: 'участником' };
    if (!confirm(`Сделать ${label} ${roleNames[newRole]}?`)) return;
    try {
        await db.collection('teamRegistry').doc(team.id).collection('members').doc(uid).update({ role: newRole });
        showToast('✅ Роль обновлена', 'success');
    } catch (err) {
        console.error('role change failed:', err);
        showToast('⚠️ Не удалось изменить роль: ' + err.code, 'error');
    }
}
async function kickTeamMember(uid) {
    const team = teams.find(t => t.id === currentMembersTeamId);
    if (!team || !currentUser) return;
    const myRole = getMyRole(team.id);
    const roles = teamRolesCache[team.id] || {};
    const targetRole = (roles[uid] && roles[uid].role) || 'member';
    if (targetRole === 'owner') { alert('❌ Нельзя исключить владельца'); return; }
    if (myRole === 'admin' && targetRole === 'admin') { alert('❌ Администратор не может исключить другого администратора'); return; }
    if (myRole !== 'owner' && myRole !== 'admin') { alert('❌ Удалять участников может только владелец или администратор'); return; }
    if (uid === currentUser.uid) { alert('❌ Нельзя удалить самого себя'); return; }
    const label = [currentMembersProfiles[uid]?.displayName, currentMembersProfiles[uid]?.lastName].filter(Boolean).join(' ').trim() || 'этого участника';
    if (!confirm(`Удалить ${label} из команды «${team.name}»?`)) return;
    try {
        await db.collection('teamRegistry').doc(team.id).collection('members').doc(uid).delete();
        await db.collection('teamRegistry').doc(team.id).update({ members: firebase.firestore.FieldValue.arrayRemove(uid) });
        currentMembersIds = currentMembersIds.filter(id => id !== uid);
        renderTeamMembersList();
        showToast('✅ Участник удалён из команды', 'success');
    } catch (err) {
        console.error('Не удалось удалить участника:', err);
        showToast('⚠️ Не удалось удалить участника: ' + err.code, 'error');
    }
}
 
function renderTeamMembersList() {
    const team = teams.find(t => t.id === currentMembersTeamId);
    const list = document.getElementById('team-members-list');
    if (!team) { list.innerHTML = ''; return; }
   const query = (document.getElementById('team-members-search').value || '').trim().toLowerCase();
    const memberIds = currentMembersIds && currentMembersIds.length ? currentMembersIds : [];
    if (memberIds.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:30px;">В команде пока нет участников</div>';
        return;
    }
    let rows = memberIds.map(uid => {
        const p = currentMembersProfiles[uid] || {};
        const fullName = [p.displayName, p.lastName].filter(Boolean).join(' ').trim();
        return { uid, p, label: fullName || 'Без имени' };
    });
    if (query) rows = rows.filter(r => r.label.toLowerCase().includes(query));
    rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    if (rows.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#888;padding:30px;">Никого не найдено</div>';
        return;
    }
    const myRole = getMyRole(team.id);
    const iAmOwner = myRole === 'owner';
    const iAmAdmin = myRole === 'admin';
    const roles = teamRolesCache[team.id] || {};
    list.innerHTML = rows.map(r => {
        const avatarHtml = r.p.avatar
            ? `<img src="${escapeHtml(r.p.avatar)}" class="team-member-avatar" alt="">`
            : `<div class="team-member-avatar-placeholder">👤</div>`;
        const isMe = currentUser && r.uid === currentUser.uid;
        const sub = [r.p.city, r.p.country].filter(Boolean).join(', ');
        const targetRole = (roles[r.uid] && roles[r.uid].role) || 'member';
        const roleLabel = targetRole === 'owner' ? 'владелец' : targetRole === 'admin' ? 'администратор' : '';
        const canKick = !isMe && targetRole !== 'owner' && (iAmOwner || (iAmAdmin && targetRole !== 'admin'));
        const kickBtn = canKick ? `<button class="btn-danger" style="padding:6px 12px;font-size:12px;min-height:auto;border-radius:6px;" onclick="event.stopPropagation();kickTeamMember('${r.uid}')">Удалить</button>` : '';
        let roleBtns = '';
        if (iAmOwner && !isMe) {
            if (targetRole === 'member') {
                roleBtns = `<button class="btn-icon" onclick="event.stopPropagation();changeTeamMemberRole('${r.uid}','admin')" title="Сделать админом">⬆️</button><button class="btn-icon" onclick="event.stopPropagation();changeTeamMemberRole('${r.uid}','owner')" title="Сделать владельцем">👑</button>`;
            } else if (targetRole === 'admin') {
                roleBtns = `<button class="btn-icon" onclick="event.stopPropagation();changeTeamMemberRole('${r.uid}','owner')" title="Сделать владельцем">👑</button><button class="btn-icon" onclick="event.stopPropagation();changeTeamMemberRole('${r.uid}','member')" title="Снять админа">⬇️</button>`;
            } else if (targetRole === 'owner') {
                roleBtns = `<button class="btn-icon" onclick="event.stopPropagation();changeTeamMemberRole('${r.uid}','admin')" title="Снять с владельцев">⬇️</button>`;
            }
        }
        const roleHtml = roleLabel ? `<div style="color:#888;font-size:12px;white-space:nowrap;">${roleLabel}</div>` : '';
        return `<div class="list-item" style="cursor:pointer;" onclick="openMemberProfile('${r.uid}')">
<div class="item-left">
${avatarHtml}
<div style="min-width:0;flex:1;">
<div class="item-title">${escapeHtml(r.label)}${isMe ? ' <span style="color:#4caf50;font-size:11px;">(вы)</span>' : ''}</div>
${sub ? `<div class="item-sub">${escapeHtml(sub)}</div>` : ''}
</div>
${roleHtml}
${roleBtns}
${kickBtn}
</div>
</div>`;
    }).join('');
}
 
function formatBirthDateForProfile(dateString) {
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return dateString; }
}
 
function openMemberProfile(uid) {
    const p = currentMembersProfiles[uid] || {};
    const fullName = [p.displayName, p.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
    document.getElementById('member-profile-name').innerText = fullName;
    const avatarEl = document.getElementById('member-profile-avatar');
    if (p.avatar) {
        const safeSrc = p.avatar.replace(/'/g, "\\'");
        avatarEl.innerHTML = `<img src="${escapeHtml(p.avatar)}" alt="" onclick="openMemberPhotoFull('${safeSrc}')">`;
    } else {
        avatarEl.innerHTML = '👤';
    }
    const genderLabels = { male: 'Мужской', female: 'Женский' };
    const fields = [
        ['🎂 День рождения', p.birthDate ? formatBirthDateForProfile(p.birthDate) : ''],
        ['🚻 Пол', p.gender ? (genderLabels[p.gender] || p.gender) : ''],
        ['🌍 Страна', p.country || ''],
        ['🏙 Город', p.city || '']
    ].filter(f => f[1]);
    const details = document.getElementById('member-profile-details');
    if (fields.length === 0) {
        details.innerHTML = '<div style="text-align:center;color:#888;padding:15px;">Участник пока не заполнил профиль</div>';
    } else {
        details.innerHTML = fields.map(f =>
            `<div class="member-profile-row"><span class="member-profile-label">${f[0]}</span><span class="member-profile-value">${escapeHtml(String(f[1]))}</span></div>`
        ).join('');
    }
    document.getElementById('modal-member-profile').classList.add('show');
}
 
function openMemberPhotoFull(src) {
    document.getElementById('photo-view-img').src = src;
    document.getElementById('modal-photo-view').classList.add('show');
}