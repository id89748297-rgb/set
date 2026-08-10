function switchHomeView(view) {
currentHomeView = view;
const idx = carouselItems.findIndex(i => i.type === view);
if (idx !== -1 && idx !== carouselActiveIndex) {
setCarouselIndex(idx, true);
} else {
activateCarouselItem(carouselActiveIndex);
}
}
function showTeamsView() {
const view = document.getElementById('home-view-teams');
view.style.display = 'block';
teams.forEach(t => startTeamDataListener(t.id));
let html = `<div style="padding: 10px 0;">
<div style="text-align: center; margin-bottom: 20px;">
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
<button class="btn-pastel" style="margin: 0;" onclick="createTeamPrompt()">➕ Создать команду</button>
<button class="btn-pastel" style="margin: 0;" onclick="showJoinTeamByLinkModal()">🔗 Присоединиться к команде</button>
</div>
<p style="color: #888; font-size: 12px; margin-top: 10px;">Создано: ${teams.length} / ${MAX_TEAMS}</p>
</div>`;
if (teams.length === 0) {
html += `<div style="text-align: center; padding: 30px 20px; color: #888;">
<div style="font-size: 48px; margin-bottom: 15px;">👥</div>
<p>У вас пока нет команд</p>
<p style="font-size: 13px; margin-top: 8px;">Создайте команду, чтобы делиться сет-листами</p>
</div>`;
} else {
teams.forEach(t => {
const teamSetlists = setlists.filter(sl => sl.teamId === t.id && !sl.isArchived);
const avatarHtml = t.avatar
? `<img src="${t.avatar}" class="team-list-avatar" alt="">`
: `<div class="team-list-avatar-placeholder">🎸</div>`;
html += `<div class="list-item" style="cursor: pointer;" onclick="openTeamFromList('${t.id}')">
<div class="item-left">
${avatarHtml}
<div style="min-width: 0; flex: 1;">
<div class="item-title">${escapeHtml(t.name)}</div>
<div class="item-sub">Участники: ${t.members ? t.members.length : 0}${t.password ? ' · 🔐' : ''}</div>
</div>
</div>
<div class="item-actions" style="display: flex; gap: 4px;">
<button class="btn-icon" onclick="event.stopPropagation(); openTeamMembers('${t.id}')" title="Участники">👥</button>
<button class="btn-icon" onclick="event.stopPropagation(); showTeamInvite('${t.id}')" title="Пригласить">🔗</button>
<button class="btn-icon" onclick="event.stopPropagation(); editTeam('${t.id}')" title="Изменить">✏️</button>
<button class="btn-icon" onclick="event.stopPropagation(); deleteTeam('${t.id}')" title="Удалить" style="color: #ef5350;">🗑️</button>
</div>
</div>`;
});
}
html += `</div>`;
view.innerHTML = html;
}
function openTeamFromList(teamId) {
const idx = carouselItems.findIndex(i => i.type === 'team' && i.teamId === teamId);
if (idx !== -1) {
setCarouselIndex(idx, true);
} else {
showTeamDetailView(teamId);
}
}
function createTeamPrompt() {
if (teams.length >= MAX_TEAMS) {
alert(`❌ Достигнут лимит команд (${MAX_TEAMS})`);
return;
}
editingTeamId = null;
teamAvatarFile = null;
document.getElementById('team-modal-title').innerText = '➕ Создать команду';
document.getElementById('team-edit-name').value = '';
document.getElementById('team-edit-password').value = '';
document.getElementById('team-edit-avatar').value = '';
document.getElementById('team-avatar-preview-container').innerHTML = '';
document.getElementById('modal-team-edit').classList.add('show');
}
function previewTeamAvatar(input) {
const file = input.files[0];
if (!file) return;
if (!file.type.startsWith('image/')) {
alert(' Пожалуйста, выберите изображение');
return;
}
teamAvatarFile = file;
const reader = new FileReader();
reader.onload = function(e) {
const container = document.getElementById('team-avatar-preview-container');
container.innerHTML = `<img src="${e.target.result}" class="team-avatar-edit" alt="Preview">`;
};
reader.readAsDataURL(file);
}
function editTeam(teamId) {
const team = teams.find(t => t.id === teamId);
if (!team) return;
editingTeamId = teamId;
teamAvatarFile = null;
document.getElementById('team-modal-title').innerText = '✏️ Редактировать команду';
document.getElementById('team-edit-name').value = team.name;
document.getElementById('team-edit-password').value = team.password || '';
document.getElementById('team-edit-avatar').value = '';
const container = document.getElementById('team-avatar-preview-container');
if (team.avatar) {
container.innerHTML = `<img src="${team.avatar}" class="team-avatar-edit" alt="Avatar"><div style="font-size: 12px; color: #888; margin-top: 5px;">Загрузите новое, чтобы заменить</div>`;
} else {
container.innerHTML = '<div class="team-avatar-edit-placeholder"></div><div style="font-size: 12px; color: #888; margin-top: 5px;">Аватарка не установлена</div>';
}
document.getElementById('modal-team-edit').classList.add('show');
}
function saveTeamEdit() {
const newName = document.getElementById('team-edit-name').value.trim();
const newPassword = document.getElementById('team-edit-password').value.trim();
if (!newName) { alert('❌ Введите название команды!'); return; }
function finalizeSave(avatarData) {
if (editingTeamId) {
const team = teams.find(t => t.id === editingTeamId);
if (team) {
const editTimestamp = Date.now();
team.name = newName;
team.password = newPassword;
team.updatedAt = editTimestamp;
if (avatarData !== undefined) team.avatar = avatarData;
if (db && currentUser) {
console.log('DEBUG правка команды:', { teamId: team.id, uid: currentUser.uid, размерАватарки: avatarData ? avatarData.length : 'без изменений' });
db.collection('teamRegistry').doc(team.id).set({ name: newName, password: newPassword, avatar: avatarData !== undefined ? avatarData : (team.avatar || null), createdAt: team.createdAt || Date.now(), updatedAt: editTimestamp, members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) }, { merge: true })
.then(() => showToast('✅ Команда обновлена', 'success'))
.catch(err => { console.error('teamRegistry sync failed:', err); showToast('⚠️ Не синхронизировано с облаком: ' + err.message, 'error'); });
}
}
} else {
const id = 'team_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const newTeam = {
id,
name: newName,
password: newPassword,
avatar: avatarData || null,
members: [currentUser.uid],
createdAt: Date.now()
};
teams.push(newTeam);
startTeamDataListener(id);
if (db && currentUser) {
db.collection('teamRegistry').doc(id).set({ name: newName, password: newPassword, avatar: avatarData || null, createdBy: currentUser.uid, createdAt: newTeam.createdAt, members: [currentUser.uid] })
.then(() => db.collection('teamRegistry').doc(id).collection('members').doc(currentUser.uid).set({ joinedAt: Date.now(), role: 'owner' }))
.then(() => showToast('✅ Команда создана', 'success'))
.catch(err => { console.error('teamRegistry sync failed:', err.code, err); showToast('⚠️ Команда создана локально, но не в облаке: ' + err.code, 'error'); });
}
}
saveToStorage();
syncPublicProfileToTeams();
closeModal('modal-team-edit');
renderCarousel();
showTeamsView();
}
const avatarInput = document.getElementById('team-edit-avatar');
if (avatarInput.files && avatarInput.files[0]) {
compressTeamImage(avatarInput.files[0], finalizeSave);
} else {
finalizeSave(undefined);
}
}
function showTeamInvite(teamId) {
const team = teams.find(t => t.id === teamId);
if (!team) return;
const baseUrl = window.location.origin + window.location.pathname;
const inviteUrl = `${baseUrl}?invite=${team.id}${team.password ? '&pwd=1' : ''}`;
document.getElementById('team-invite-link').innerText = inviteUrl;
document.getElementById('team-invite-id').innerText = team.id;
if (team.password) {
document.getElementById('team-invite-pwd').innerText = team.password;
document.getElementById('team-invite-pwd-block').style.display = 'block';
} else {
document.getElementById('team-invite-pwd-block').style.display = 'none';
}
document.getElementById('modal-team-invite').dataset.teamId = teamId;
document.getElementById('modal-team-invite').classList.add('show');
}
function copyTeamInviteLink() {
const link = document.getElementById('team-invite-link').innerText;
navigator.clipboard.writeText(link).then(() => alert('✅ Ссылка скопирована!')).catch(() => {
const ta = document.createElement('textarea');
ta.value = link;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
document.body.removeChild(ta);
alert('✅ Ссылка скопирована!');
});
}
function deleteTeam(teamId) {
const team = teams.find(t => t.id === teamId);
if (!team) return;
const activeSetlists = setlists.filter(sl => sl.teamId === teamId && !sl.isArchived);
let warning = `Команду «${team.name}»`;
if (activeSetlists.length > 0) {
warning += `\n⚠️ В команде ${activeSetlists.length} актуальных сет-листов — они тоже будут удалены!`;
}
showDeleteConfirm('team', teamId, warning, async () => {
recentlyLeftTeams[teamId] = Date.now();
setlists = setlists.filter(sl => sl.teamId !== teamId);
songs = songs.filter(s => s.fromTeam !== teamId);
teams = teams.filter(t => t.id !== teamId);
if (teamListenerUnsubs[teamId]) { teamListenerUnsubs[teamId](); delete teamListenerUnsubs[teamId]; }
if (teamRegistryListenerUnsubs[teamId]) { teamRegistryListenerUnsubs[teamId](); delete teamRegistryListenerUnsubs[teamId]; }
if (membershipWatchUnsubs[teamId]) { membershipWatchUnsubs[teamId](); delete membershipWatchUnsubs[teamId]; }
if (teamRolesListenerUnsubs[teamId]) { teamRolesListenerUnsubs[teamId](); delete teamRolesListenerUnsubs[teamId]; }
delete teamRolesCache[teamId];
delete teamDataCache[teamId];
if (db && currentUser) {
db.collection('teamRegistry').doc(teamId).update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) }).catch(err => console.error('Не удалось убрать себя из участников:', err));
db.collection('teamRegistry').doc(teamId).collection('members').doc(currentUser.uid).delete().catch(err => console.error('Не удалось удалить пропуск участника:', err));
}
saveToStorage();
renderCarousel();
currentHomeView = 'teams';
const teamsIdx = carouselItems.findIndex(i => i.type === 'teams');
if (teamsIdx !== -1) {
carouselActiveIndex = teamsIdx;
activateCarouselItem(teamsIdx);
}
if (team.createdBy === currentUser.uid) {
alert(`✅ Команда «${team.name}» удалена`);
} else {
alert(`✅ Вы покинули команду «${team.name}»`);
}
});
}
function copyTeamInviteId() {
const id = document.getElementById('team-invite-id').innerText;
navigator.clipboard.writeText(id).then(() => alert('✅ ID команды скопирован!')).catch(() => {
const ta = document.createElement('textarea');
ta.value = id;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
document.body.removeChild(ta);
alert('✅ ID команды скопирован!');
});
}
function copyTeamInvitePassword() {
const pwd = document.getElementById('team-invite-pwd').innerText;
navigator.clipboard.writeText(pwd).then(() => alert('✅ Пароль скопирован!')).catch(() => {
const ta = document.createElement('textarea');
ta.value = pwd;
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
document.body.removeChild(ta);
alert('✅ Пароль скопирован!');
});
}
function showJoinTeamByLinkModal() {
if (teams.length >= MAX_TEAMS) {
alert(`❌ Достигнут лимит команд (${MAX_TEAMS})`);
return;
}
document.getElementById('join-team-link-input').value = '';
document.getElementById('join-team-password-input').value = '';
document.getElementById('join-team-password-row').style.display = 'block';
document.getElementById('modal-join-team-link').classList.add('show');
}
function onJoinLinkInput() {
// Поле пароля теперь всегда видно — определять по ссылке больше не требуется
}
function parseTeamLink(link) {
if (!link) return null;
try {
const url = new URL(link.trim());
const teamId = url.searchParams.get('invite');
const hasPwd = url.searchParams.get('pwd') === '1';
return { teamId, hasPwd };
} catch {
if (link.trim().startsWith('team_')) {
return { teamId: link.trim(), hasPwd: false };
}
return null;
}
}
function submitJoinTeam() {
const link = document.getElementById('join-team-link-input').value.trim();
if (!link) {
alert('❌ Введите ID команды или вставьте ссылку-приглашение');
return;
}
const parsed = parseTeamLink(link);
if (!parsed || !parsed.teamId) {
alert('❌ Не удалось распознать ID команды. Проверьте, что скопировали его полностью.');
return;
}
if (teams.find(t => t.id === parsed.teamId)) {
alert('️ Эта команда уже добавлена');
return;
}
const pwd = document.getElementById('join-team-password-input').value;
confirmJoinTeam(parsed.teamId, pwd);
}
async function confirmJoinTeam(teamId, password) {
if (teams.length >= MAX_TEAMS) {
alert(`❌ Достигнут лимит команд (${MAX_TEAMS})`);
return;
}
let registryDoc;
try {
registryDoc = await db.collection('teamRegistry').doc(teamId).get();
} catch (err) {
alert('❌ Не удалось проверить команду. Проверьте подключение к интернету.');
return;
}
if (!registryDoc.exists) {
alert('❌ Команда не найдена. Проверьте ссылку-приглашение.');
return;
}
const registry = registryDoc.data();
if (registry.password && registry.password !== password) {
alert('❌ Неверный пароль команды');
return;
}
const updatedMembers = Array.from(new Set([...(registry.members || []), registry.createdBy, currentUser.uid].filter(Boolean)));
try {
// Сначала — свой документ-пропуск (это и есть настоящее «вступление»),
// потом — обновление массива members для обратной совместимости со счётчиком в UI.
await db.collection('teamRegistry').doc(teamId).collection('members').doc(currentUser.uid).set({ joinedAt: Date.now() });
await db.collection('teamRegistry').doc(teamId).update({ members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
} catch (err) {
console.error('Не удалось зарегистрировать участие:', err);
alert('⚠️ Вступление сохранено локально, но не синхронизировалось с облаком: ' + err.message);
}
const newTeam = {
id: teamId,
name: registry.name,
password: registry.password || '',
avatar: registry.avatar || null,
members: updatedMembers,
createdAt: Date.now(),
joinedByLink: true
};
teams.push(newTeam);
startTeamDataListener(teamId);
saveToStorage();
syncPublicProfileToTeams();
closeModal('modal-join-team-link');
renderCarousel();
showTeamsView();
alert(`✅ Вы присоединились к команде «${registry.name}»!`);
}
function openSetlistModalForTeam(teamId) {
document.getElementById('sl-date').value = getNextSundayDate();
document.getElementById('sl-time').value = '11:00';
document.getElementById('sl-name').value = '';
document.getElementById('modal-setlist').dataset.teamId = teamId;
document.getElementById('modal-setlist').classList.add('show');
}
function copySetlistToPersonal(setlistId) {
const sl = setlists.find(x => x.id === setlistId);
if (!sl) return;
const newId = getNextId(setlists);
const newSongs = sl.songs.map(item => {
const teamSong = songs.find(x => x.id === item.id);
if (!teamSong) return { ...item };
const existingPersonal = songs.find(x => !x.fromTeam && x.title.toLowerCase() === teamSong.title.toLowerCase());
if (existingPersonal) {
const teamChordpro = item.chordpro || teamSong.chordpro;
const differs = teamChordpro !== existingPersonal.chordpro;
return { ...item, id: existingPersonal.id, chordpro: differs ? teamChordpro : null };
}
const newSongId = getNextId(songs);
songs.push({ id: newSongId, title: teamSong.title, author: teamSong.author || '', key: teamSong.key, bpm: teamSong.bpm || '', category: teamSong.category || '', chordpro: item.chordpro || teamSong.chordpro, images: teamSong.images || {}, cloudId: generateCloudId(), createdAt: Date.now(), columns: currentColumns, fontSize });
return { ...item, id: newSongId, chordpro: null };
});
const newSl = {
id: newId,
date: sl.date,
time: sl.time || '',
name: sl.name,
isArchived: false,
teamId: null,
songs: newSongs,
copiedFrom: sl.id,
copiedAt: Date.now()
};
setlists.push(newSl);
saveToStorage();
renderSetlists();
showTeamDetailView(sl.teamId);
alert(`✅ Сет-лист «${sl.name}» добавлен в ваши сет-листы!`);
}
function applyTeamOverlay(teamId) {
const data = teamDataCache[teamId];
if (!data) return;
songs = songs.filter(s => s.fromTeam !== teamId);
const cacheIds = new Set((data.setlists || []).map(s => s.id));
setlists = setlists.filter(sl => !(sl.teamId === teamId && (sl.fromTeamSync || cacheIds.has(sl.id))));
(data.songs || []).forEach(s => {
songs.push({ ...s, fromTeam: teamId });
// Комментарии команды для этой песни — общие, приходят вместе с песней
if (data.sectionNotes && data.sectionNotes[s.id]) sectionNotes[s.id] = data.sectionNotes[s.id];
if (data.inlineComments && data.inlineComments[s.id]) inlineComments[s.id] = data.inlineComments[s.id];
});
(data.setlists || []).forEach(sl => setlists.push({ ...sl, teamId: teamId, fromTeamSync: true }));
}
function applyAllTeamOverlays() {
Object.keys(teamDataCache).forEach(applyTeamOverlay);
}
function startTeamRegistryListener(teamId) {
if (teamRegistryListenerUnsubs[teamId] || !db || !currentUser) return;
teamRegistryListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).onSnapshot(doc => {
if (!doc.exists) return;
const data = doc.data();
const team = teams.find(t => t.id === teamId);
if (!team) return;
if (data.updatedAt && team.updatedAt && data.updatedAt < team.updatedAt) return;
team.name = data.name;
team.avatar = data.avatar || null;
team.password = data.password || '';
team.updatedAt = data.updatedAt || team.updatedAt;
team.createdBy = data.createdBy || team.createdBy;
const membersSet = new Set(data.members || []);
if (data.createdBy) membersSet.add(data.createdBy);
team.members = Array.from(membersSet);
saveToStorage();
renderCarousel();
if (currentHomeView === 'teams') showTeamsView();
if (currentTeamDetailId === teamId) showTeamDetailView(teamId);
}, err => console.error('teamRegistry listener error:', err));
}
function startMembershipWatch(teamId) {
if (membershipWatchUnsubs[teamId] || !db || !currentUser) return;
let sawExisting = false;
membershipWatchUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('members').doc(currentUser.uid)
.onSnapshot(doc => {
if (doc.exists) { sawExisting = true; return; }
if (!sawExisting) return;
handleKickedFromTeam(teamId);
}, err => console.error('membership watch error:', err));
}
function handleKickedFromTeam(teamId) {
const team = teams.find(t => t.id === teamId);
const teamName = team ? team.name : 'команда';
recentlyLeftTeams[teamId] = Date.now();
setlists = setlists.filter(sl => sl.teamId !== teamId);
songs = songs.filter(s => s.fromTeam !== teamId);
teams = teams.filter(t => t.id !== teamId);
if (teamListenerUnsubs[teamId]) { teamListenerUnsubs[teamId](); delete teamListenerUnsubs[teamId]; }
if (teamRegistryListenerUnsubs[teamId]) { teamRegistryListenerUnsubs[teamId](); delete teamRegistryListenerUnsubs[teamId]; }
if (membershipWatchUnsubs[teamId]) { membershipWatchUnsubs[teamId](); delete membershipWatchUnsubs[teamId]; }
delete teamDataCache[teamId];
saveToStorage();
renderCarousel();
if (currentTeamDetailId === teamId || currentHomeView === 'team_' + teamId) {
currentHomeView = 'teams';
const teamsIdx = carouselItems.findIndex(i => i.type === 'teams');
if (teamsIdx !== -1) { carouselActiveIndex = teamsIdx; activateCarouselItem(teamsIdx); }
} else if (currentHomeView === 'teams') {
showTeamsView();
}
alert(`⚠️ Вас удалили из команды «${teamName}»`);
}
function startTeamRolesListener(teamId) {
if (teamRolesListenerUnsubs[teamId] || !db || !currentUser) return;
teamRolesListenerUnsubs[teamId] = db.collection('teamRegistry').doc(teamId).collection('members')
.onSnapshot(snap => {
const roles = {};
snap.forEach(doc => { roles[doc.id] = { role: doc.data().role || 'member', joinedAt: doc.data().joinedAt || 0 }; });
teamRolesCache[teamId] = roles;
if (currentMembersTeamId === teamId && typeof renderTeamMembersList === 'function') renderTeamMembersList();
if (currentTeamDetailId === teamId) showTeamDetailView(teamId);
}, err => console.error('roles listener error:', err));
}
function getMyRole(teamId) {
const roles = teamRolesCache[teamId];
if (!roles || !currentUser) return 'member';
const entry = roles[currentUser.uid];
return entry ? entry.role : 'member';
}
function isTeamOwner(teamId) { return getMyRole(teamId) === 'owner'; }
function isTeamOwnerOrAdmin(teamId) { const r = getMyRole(teamId); return r === 'owner' || r === 'admin'; }
function notAllowedForRole() { alert('⛔ Недоступно для вашей роли в команде'); }
function startTeamDataListener(teamId) {
startTeamRegistryListener(teamId);
startMembershipWatch(teamId);
startTeamRolesListener(teamId);
if (teamListenerUnsubs[teamId] || !db || !currentUser) return;
teamListenerUnsubs[teamId] = db.collection('teamData').doc(teamId).onSnapshot(doc => {
teamDataCache[teamId] = doc.exists ? doc.data() : { songs: [], setlists: [] };
applyTeamOverlay(teamId);
if (currentTeamDetailId === teamId) showTeamDetailView(teamId);
if (currentHomeView === 'songs') renderSongs();
if (currentHomeView === 'setlists') renderSetlists();
renderCarousel();
}, err => console.error('teamData listener error:', err));
}
function showTeamDetailView(teamId) {
const view = document.getElementById('home-view-team-detail');
const team = teams.find(t => t.id === teamId);
if (!team) {
view.innerHTML = '<p style="color:#ef5350;text-align:center;padding:40px;">Команда не найдена</p>';
view.style.display = 'block';
return;
}
currentTeamDetailId = teamId;
startTeamDataListener(teamId);
view.style.display = 'block';
const teamSetlists = setlists.filter(sl => sl.teamId === teamId);
const activeSetlists = teamSetlists.filter(sl => !sl.isArchived);
const archivedSetlists = teamSetlists.filter(sl => sl.isArchived);
const isArchiveMode = currentTeamArchiveTeamId === teamId;
let listsToShow = isArchiveMode ? archivedSetlists : activeSetlists;
listsToShow = [...listsToShow].sort((a, b) => {
const dateA = new Date(a.date + 'T' + (a.time || '00:00')).getTime();
const dateB = new Date(b.date + 'T' + (b.time || '00:00')).getTime();
if (isArchiveMode) {
return dateB - dateA;
}
const aExpired = isSetlistExpired(a);
const bExpired = isSetlistExpired(b);
if (aExpired && !bExpired) return 1;
if (!aExpired && bExpired) return -1;
if (aExpired && bExpired) return dateB - dateA;
return dateA - dateB;
});
const isLight = document.body.classList.contains('light');
const dateColorBase = isLight ? '#7e57c2' : '#9575cd';
let html = `<div style="padding: 10px 0;">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:15px;">
<button class="btn-pastel" style="margin:0;" onclick="openSetlistModalForTeam('${team.id}')">➕ Сет-лист</button>
<button class="btn-pastel" style="margin:0;" onclick="openTeamMembers('${team.id}')">👥 Участники</button>
<button class="btn-pastel" style="margin:0;" onclick="showTeamInvite('${team.id}')">🔗 Пригласить</button>
</div>`;
html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px;">`;
html += `<button class="btn-pastel" style="margin:0;${!isArchiveMode ? 'background:rgba(179,157,219,0.35);font-weight:bold;' : 'opacity:0.6;'}" onclick="toggleTeamArchive('${team.id}')">Актуальные (${activeSetlists.length})</button>`;
html += `<button class="btn-pastel" style="margin:0;${isArchiveMode ? 'background:rgba(179,157,219,0.35);font-weight:bold;' : 'opacity:0.6;'}" onclick="toggleTeamArchive('${team.id}')">Архив (${archivedSetlists.length})</button>`;
html += `</div>`;
if (listsToShow.length === 0) {
html += `<div style="text-align: center; padding: 30px 20px; color: #888;">
<div style="font-size: 48px; margin-bottom: 15px;">📋</div>
<p>${isArchiveMode ? 'Архив пуст' : 'В этой команде пока нет сет-листов'}</p>
${!isArchiveMode ? '<p style="font-size: 13px; margin-top: 8px;">Нажмите «Создать сет-лист»</p>' : ''}
</div>`;
} else {
listsToShow.forEach(sl => {
const isExpired = !sl.isArchived && isSetlistExpired(sl);
const dateColor = isExpired ? '#ef5350' : dateColorBase;
const expiredClass = isExpired ? 'setlist-expired' : '';
const changesBadge = sl.hasChanges ? ' <span style="background: #ef5350; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">ИЗМЕНЕНО</span>' : '';
const copyBtn = `<button class="btn-icon" onclick="event.stopPropagation(); copySetlistToPersonal(${sl.id})" title="Добавить к себе в сет-листы" style="color: #4caf50;">📥</button>`;
let actions = '';
if (sl.isArchived) {
actions = `${copyBtn}`;
actions += `<button class="btn-icon" onclick="event.stopPropagation(); restoreSetlist(${sl.id})">↻</button>`;
actions += `<button class="btn-icon" onclick="event.stopPropagation(); showSetlistDeleteChoice(${sl.id}, '${sl.name.replace(/'/g, "\\'")}', false)">🗑️</button>`;
} else {
actions = `${copyBtn}`;
actions += `<button class="btn-icon" onclick="event.stopPropagation(); openEditSetlistModal(${sl.id})">✏️</button>`;
actions += `<button class="btn-icon" onclick="event.stopPropagation(); showSetlistDeleteChoice(${sl.id}, '${sl.name.replace(/'/g, "\\'")}', false)">🗑️</button>`;
}
html += `<div class="list-item ${expiredClass}" style="cursor: pointer;" onclick="clearSetlistSearchAndOpen(${sl.id})">
<div class="item-left" style="min-width: 0; flex: 1;">
<div style="min-width: 0; flex: 1;">
<div class="item-title" style="${isExpired ? 'color: #ef5350;' : ''}">${escapeHtml(sl.name)}${changesBadge}</div>
<div class="item-sub" style="color: ${dateColor};">${formatSetlistDate(sl.date, sl.time)} · ${sl.songs.length} песен</div>
</div>
</div>
<div class="item-actions" style="display: flex; gap: 4px;">${actions}</div>
</div>`;
});
}
html += `</div>`;
view.innerHTML = html;
}
function toggleTeamArchive(teamId) {
currentTeamArchiveTeamId = (currentTeamArchiveTeamId === teamId) ? null : teamId;
showTeamDetailView(teamId);
}
function createSetlistForTeam(teamId) {
const name = prompt('Название сет-листа:');
if (!name || !name.trim()) return;
const date = prompt('Дата (ДД.ММ.ГГГГ):', new Date().toLocaleDateString('ru-RU'));
if (!date) return;
const newId = getNextId(setlists);
setlists.push({
id: newId, date: date.trim(), time: '', name: name.trim(),
isArchived: false, teamId: teamId, songs: []
});
saveToStorage();
showTeamDetailView(teamId);
renderCarousel();
}
function exportSetlist() {
if (!currentSlId) return;
const sl = setlists.find(x => x.id === currentSlId);
if (!sl) return;
const modal = document.getElementById('modal-share-setlist');
if (!modal) {
exportSetlistAsFileDirect();
return;
}
const section = document.getElementById('share-to-team-section');
if (teams.length > 0) {
section.innerHTML = `
<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #444;">
<p style="color: #888; font-size: 13px; margin-bottom: 8px;">Отправить в команду:</p>
${teams.map(t => `<button class="btn-pastel" style="width: 100%; margin-bottom: 6px; text-align: left;" onclick="shareSetlistToTeam(${sl.id}, '${t.id}')">🎸 ${escapeHtml(t.name)}</button>`).join('')}
</div>
`;
} else {
section.innerHTML = `<p style="color: #888; font-size: 12px; margin-top: 10px; text-align: center;">Создайте команду, чтобы отправлять сет-листы</p>`;
}
modal.classList.add('show');
}
function exportSetlistAsFile() {
closeModal('modal-share-setlist');
exportSetlistAsFileDirect();
}
function exportSetlistAsFileDirect() {
const sl = setlists.find(x => x.id === currentSlId);
if (!sl) return;
shareFile({ version: 2, type: 'setlist', app: 'Worship SetUP', data: { date: sl.date, time: sl.time || '', name: sl.name, songs: sl.songs.map(item => { const s = songs.find(x => x.id === item.id); return s ? exportSongFromSetlist(item, s) : null; }).filter(Boolean) } }, `${sl.date}_${sl.name}.clcsetlist`);
}
async function shareSetlistViaAPI() {
const sl = setlists.find(x => x.id === currentSlId);
if (!sl) return;
closeModal('modal-share-setlist');
const fileData = { version: 2, type: 'setlist', app: 'Worship SetUP', data: { date: sl.date, time: sl.time || '', name: sl.name, songs: sl.songs.map(item => { const s = songs.find(x => x.id === item.id); return s ? exportSongFromSetlist(item, s) : null; }).filter(Boolean) } };
const filename = `${sl.date}_${sl.name}.clcsetlist`;
const file = new File([JSON.stringify(fileData, null, 2)], filename, { type: 'application/json' });
if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
try {
await navigator.share({ files: [file], title: `Сет-лист: ${sl.name}` });
return;
} catch (err) {
if (err.name === 'AbortError') return;
}
}
downloadJson(fileData, filename);
}
// Личные настройки отображения — не отправляются в команду, у каждого участника свои
const TEAM_SYNC_EXCLUDE_FIELDS = ['capo', 'fontSize', 'columns', 'accidental', 'hideChords', 'hideLyrics', 'hideArrows', 'hideComments'];
function stripPersonalSettingsForTeam(item) {
    const clean = { ...item };
    TEAM_SYNC_EXCLUDE_FIELDS.forEach(f => delete clean[f]);
    return clean;
}
async function publishSetlistToTeamData(sl, teamId) {
    if (!db || !currentUser) return false;
    const songsToShare = sl.songs.map(item => {
        const s = songs.find(x => x.id === item.id);
        return s ? stripPersonalSettingsForTeam(s) : null;
    }).filter(Boolean);
    const docRef = db.collection('teamData').doc(teamId);
    let assignedId = null;
    await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        const data = doc.exists ? doc.data() : { songs: [], setlists: [], sectionNotes: {}, inlineComments: {} };
        const teamSongs = data.songs || [];
        const teamSetlists = data.setlists || [];
        const teamSectionNotes = data.sectionNotes || {};
        const teamInlineComments = data.inlineComments || {};
        songsToShare.forEach(s => {
            const idx = teamSongs.findIndex(ts => ts.id === s.id);
            if (idx !== -1) teamSongs[idx] = s; else teamSongs.push(s);
            // Комментарии (под секциями и инлайн) — тоже общие для команды, идут вместе с песней
            if (sectionNotes[s.id] && Object.keys(sectionNotes[s.id]).length) teamSectionNotes[s.id] = sectionNotes[s.id];
            if (inlineComments[s.id] && Object.keys(inlineComments[s.id]).length) teamInlineComments[s.id] = inlineComments[s.id];
        });
        let existingIdx = teamSetlists.findIndex(ts => ts.id === sl.id);
        if (existingIdx === -1) {
            existingIdx = teamSetlists.findIndex(ts => ts.name.toLowerCase() === sl.name.toLowerCase() && ts.date === sl.date);
        }
        const sharedSetlist = { id: existingIdx !== -1 ? teamSetlists[existingIdx].id : sl.id, date: sl.date, time: sl.time || '', name: sl.name, isArchived: !!sl.isArchived, sharedBy: currentUser.uid, sharedAt: Date.now(), songs: sl.songs.map(item => stripPersonalSettingsForTeam(item)) };
        if (existingIdx !== -1) teamSetlists[existingIdx] = sharedSetlist; else teamSetlists.push(sharedSetlist);
        assignedId = sharedSetlist.id;
        tx.set(docRef, { songs: teamSongs, setlists: teamSetlists, sectionNotes: teamSectionNotes, inlineComments: teamInlineComments, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: currentUser.uid });
    });
    if (assignedId !== null && assignedId !== sl.id) sl.id = assignedId;
    sl.sharedToTeams = sl.sharedToTeams || [];
    if (!sl.sharedToTeams.includes(teamId)) sl.sharedToTeams.push(teamId);
    return true;
}
async function removeSetlistFromTeamData(setlistId, teamId) {
    if (!db || !currentUser || !teamId) return;
    const docRef = db.collection('teamData').doc(teamId);
    try {
        await db.runTransaction(async (tx) => {
            const doc = await tx.get(docRef);
            if (!doc.exists) return;
            const data = doc.data();
            const teamSetlists = (data.setlists || []).filter(ts => ts.id !== setlistId);
            tx.update(docRef, { setlists: teamSetlists, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: currentUser.uid });
        });
    } catch (err) { console.error('Team delete sync error:', err); }
}
function syncSetlistIfTeam(sl) {
    if (sl && sl.teamId) {
        publishSetlistToTeamData(sl, sl.teamId).catch(err => console.error('Team sync error:', err));
    }
}
async function shareSetlistToTeam(setlistId, teamId) {
    const sl = setlists.find(x => x.id === setlistId);
    const team = teams.find(t => t.id === teamId);
    if (!sl || !team) return;
    if (!confirm(`Отправить сет-лист «${sl.name}» в команду «${team.name}»?`)) return;
    if (!db || !currentUser) { alert('❌ Нет подключения к облаку'); return; }
    try {
        await publishSetlistToTeamData(sl, teamId);
        saveToStorage();
        closeModal('modal-share-setlist');
        renderSetlists();
        alert(`✅ Сет-лист «${sl.name}» отправлен в команду «${team.name}»!\nОн появится у всех участников автоматически.`);
    } catch (err) {
        alert('❌ Не удалось отправить сет-лист: ' + err.message);
    }
}