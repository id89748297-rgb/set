
// === CLOUD DATA SYNC ===

function mergeTeamsFromCloud(remoteTeams) {
    if (!remoteTeams) return false;
    let changed = false;
    const localIds = new Set(teams.map(t => t.id));
    remoteTeams.forEach(rt => { if (!localIds.has(rt.id)) { teams.push(rt); changed = true; } });
    const remoteIds = new Set(remoteTeams.map(t => t.id));
    const filtered = teams.filter(t => remoteIds.has(t.id));
    if (filtered.length !== teams.length) { teams = filtered; changed = true; }
    return changed;
}
// Load user data from cloud
async function loadUserDataFromCloud() {
    if (!currentUser) return;
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            let updated = false;

            // ✅ Обновляем только если данные ДЕЙСТВИТЕЛЬНО изменились
            if (data.songs && JSON.stringify(data.songs) !== JSON.stringify(songs)) {
                songs = data.songs;
                localStorage.setItem('clc_songs', JSON.stringify(songs));
                updated = true;
            }
if (data.setlists) {
    const teamSetlists = setlists.filter(sl => sl.fromTeamSync);
    const personalLocal = setlists.filter(sl => !sl.fromTeamSync);
    if (JSON.stringify(data.setlists) !== JSON.stringify(personalLocal)) {
        setlists = [...data.setlists, ...teamSetlists];
        localStorage.setItem('clc_setlists', JSON.stringify(setlists));
        updated = true;
    }
}
           if (data.teams && mergeTeamsFromCloud(data.teams)) {
                localStorage.setItem('clc_teams', JSON.stringify(teams));
                updated = true;
            }
            if (data.sectionNotes && JSON.stringify(data.sectionNotes) !== JSON.stringify(sectionNotes)) {
                sectionNotes = data.sectionNotes;
                localStorage.setItem('clc_section_notes', JSON.stringify(sectionNotes));
                updated = true;
            }
            if (data.inlineComments && JSON.stringify(data.inlineComments) !== JSON.stringify(inlineComments)) {
                inlineComments = data.inlineComments;
                localStorage.setItem('clc_inline_comments', JSON.stringify(inlineComments));
                updated = true;
            }
            if (data.avatar) {
                localStorage.setItem('clc_avatar_' + currentUser.uid, data.avatar);
                updateAvatarsInUI(data.avatar);
            }
 
            teams.forEach(t => startTeamDataListener(t.id));
            applyAllTeamOverlays();
 
            // ✅ ПЕРЕРИСОВЫВАЕМ ТОЛЬКО ОДИН РАЗ, если что-то изменилось
            if (updated) {
                renderSongs();
                renderSetlists();
                console.log('✅ Данные загружены из облака');
            } else {
                console.log('✅ Данные актуальны, загрузка не требуется');
            }
        } else {
            // ✅ Новый пользователь — сохраняем локальные данные в облако
            console.log('📝 Новый пользователь — сохраняем локальные данные в облако');
            await saveUserDataToCloud();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        throw error; // Пробрасываем ошибку, чтобы показать toast
    }
}

// Save user data to cloud
async function saveUserDataToCloud() {
    if (!currentUser) return;
    try {
        // Получаем аватарку из localStorage
        const localAvatar = localStorage.getItem('clc_avatar_' + currentUser.uid);
        
        await db.collection('users').doc(currentUser.uid).set({
            songs: songs.filter(s => !s.fromTeam),
            setlists: setlists.filter(sl => !sl.fromTeamSync),
            teams: teams.map(t => ({ id: t.id, createdAt: t.createdAt || null, joinedByLink: t.joinedByLink || false })),
            sectionNotes: sectionNotes,
            inlineComments: inlineComments,
            avatar: localAvatar || null,  // === НОВОЕ: Сохраняем аватарку ===
            lastSync: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ Данные сохранены в облако');
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
    }
}
// === ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ ===
let unsubscribeCloudSync = null;

function startCloudSync() {
    if (!currentUser || unsubscribeCloudSync) return;
    
    unsubscribeCloudSync = db.collection('users').doc(currentUser.uid)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                let needsRender = false;

                if (data.songs && JSON.stringify(data.songs) !== JSON.stringify(songs)) {
                    songs = data.songs; needsRender = true;
                }
if (data.setlists) {
    const teamSetlists = setlists.filter(sl => sl.fromTeamSync);
    const personalLocal = setlists.filter(sl => !sl.fromTeamSync);
    if (JSON.stringify(data.setlists) !== JSON.stringify(personalLocal)) {
        setlists = [...data.setlists, ...teamSetlists];
        needsRender = true;
    }
}
               if (data.teams && mergeTeamsFromCloud(data.teams)) {
                    needsRender = true;
                }
                teams.forEach(t => startTeamDataListener(t.id));
                if (data.sectionNotes) { sectionNotes = data.sectionNotes; needsRender = true; }
                if (data.inlineComments) { inlineComments = data.inlineComments; needsRender = true; }
                if (data.avatar && !localStorage.getItem('clc_avatar_' + currentUser.uid)) {
                    localStorage.setItem('clc_avatar_' + currentUser.uid, data.avatar);
                    updateAvatarsInUI(data.avatar);
                }

                if (needsRender) {
                    applyAllTeamOverlays();
                    originalSaveToStorage(); 
                    renderSongs();
                    renderSetlists();
                    console.log("✅ Данные синхронизированы из облака в реальном времени");
                }
            }
        }, (error) => {
            console.error("Ошибка синхронизации:", error);
        });
}

function stopCloudSync() {
    if (unsubscribeCloudSync) {
        unsubscribeCloudSync();
        unsubscribeCloudSync = null;
    }
    if (unsubscribeSessionWatch) {
        unsubscribeSessionWatch();
        unsubscribeSessionWatch = null;
    }
}