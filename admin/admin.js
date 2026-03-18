const socket = io({
    auth: {
        token: document.cookie.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1]
    }
});

let currentSpectating = null;
let roomsChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadPlayers();
    setupSocketListeners();
    initializeChart();
});

function setupSocketListeners() {
    socket.on('game-update', (data) => {
        if (currentSpectating && data.roomId === currentSpectating) {
            addToSpectateLog(`📊 Mise à jour: ${JSON.stringify(data)}`);
        }
    });

    socket.on('player-joined', (data) => {
        if (currentSpectating && data.roomId === currentSpectating) {
            addToSpectateLog(`👤 Joueur rejoint: ${data.playerName}`);
        }
        loadStats();
    });

    socket.on('player-left', (data) => {
        if (currentSpectating && data.roomId === currentSpectating) {
            addToSpectateLog(`🚪 Joueur parti: ${data.playerName}`);
        }
        loadStats();
    });

    socket.on('game-started', (data) => {
        if (currentSpectating && data.roomId === currentSpectating) {
            addToSpectateLog(`🎮 Partie commencée: ${data.gameType}`);
        }
        loadStats();
    });

    socket.on('game-over', (data) => {
        if (currentSpectating && data.roomId === currentSpectating) {
            addToSpectateLog(`🏁 Partie terminée, gagnant: ${data.winner}`);
        }
        loadStats();
    });

    socket.on('room-deleted', (message) => {
        if (currentSpectating) {
            addToSpectateLog(`⚠️ ${message}`);
            stopSpectating();
        }
        loadStats();
    });

    setInterval(loadStats, 3000);
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('active-rooms').textContent = stats.activeRooms;
        document.getElementById('connected-players').textContent = stats.connectedPlayers;
        document.getElementById('games-in-progress').textContent = stats.gamesInProgress || 0;
        
        updateRoomsList(stats.rooms);
        updateRoomSelect(stats.rooms);
        updateChart(stats.rooms);
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
}

function updateRoomsList(rooms) {
    const container = document.getElementById('active-rooms-list');
    container.innerHTML = '';

    if (rooms.length === 0) {
        container.innerHTML = '<p class="no-data">Aucune room active</p>';
        return;
    }

    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        
        const playerList = room.playerNames?.map(name => 
            `<span class="player-badge">${name}</span>`
        ).join('') || 'Joueurs anonymes';

        roomCard.innerHTML = `
            <div class="room-header">
                <h3>🏠 ${room.name}</h3>
                <span class="room-status ${room.players === 2 ? 'full' : 'waiting'}">
                    ${room.players}/2
                </span>
            </div>
            <div class="room-players">
                ${playerList}
            </div>
            <div class="room-actions">
                <button onclick="spectateRoom('${room.name}')" class="btn-small btn-primary">👁️ Écouter</button>
                <button onclick="deleteRoom('${room.name}')" class="btn-small btn-delete">🗑️ Fermer</button>
            </div>
        `;
        container.appendChild(roomCard);
    });
}

function updateRoomSelect(rooms) {
    const select = document.getElementById('room-select');
    select.innerHTML = '<option value="">Choisir une room...</option>';
    
    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.textContent = `${room.name} (${room.players}/2 joueurs)`;
        select.appendChild(option);
    });
}

async function loadPlayers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('players-list');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td><span class="badge-${user.role}">${user.role}</span></td>
                <td>${user.room || '-'}</td>
                <td>${user.stats?.gamesPlayed || 0}</td>
                <td>${user.stats?.wins || 0}</td>
                <td>${user.stats?.totalScore || 0}</td>
                <td>
                    ${user.role !== 'admin' ? `
                        <button onclick="resetPassword('${user.username}')" class="btn-small btn-reset">🔑 Reset</button>
                        ${user.room ? `<button onclick="deleteRoom('${user.room}')" class="btn-small btn-delete">🗑️ Room</button>` : ''}
                        <button onclick="viewPlayerStats('${user.username}')" class="btn-small btn-info">📊 Stats</button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erreur chargement joueurs:', error);
    }
}

async function createPlayer() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const resultDiv = document.getElementById('create-result');

    if (!username || !password) {
        showResult('Veuillez remplir tous les champs', 'error');
        return;
    }

    if (password.length < 4) {
        showResult('Le mot de passe doit contenir au moins 4 caractères', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/create-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            showResult(`✅ Joueur créé! Room: ${data.user.room}`, 'success');
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            loadPlayers();
            loadStats();
        } else {
            showResult(data.message, 'error');
        }
    } catch (error) {
        showResult('❌ Erreur de connexion', 'error');
    }
}

async function resetPassword(username) {
    const newPassword = prompt(`Nouveau mot de passe pour ${username}:`, '1234');
    
    if (!newPassword) return;

    try {
        const response = await fetch('/api/admin/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, newPassword })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Mot de passe réinitialisé!');
        } else {
            alert('❌ Erreur: ' + data.message);
        }
    } catch (error) {
        alert('❌ Erreur de connexion');
    }
}

async function deleteRoom(room) {
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir fermer la room ${room} ?\nLes joueurs seront déconnectés.`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/delete-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Room fermée!');
            loadStats();
            loadPlayers();
        } else {
            alert('❌ Erreur: ' + data.message);
        }
    } catch (error) {
        alert('❌ Erreur de connexion');
    }
}

function spectateRoom(room) {
    if (currentSpectating) {
        socket.emit('stop-spectating', currentSpectating);
    }
    
    currentSpectating = room;
    socket.emit('start-spectating', room);
    addToSpectateLog(`👁️ Commence à écouter ${room}...`);
    document.getElementById('room-select').value = room;
}

function startSpectating() {
    const select = document.getElementById('room-select');
    if (select.value) {
        spectateRoom(select.value);
    }
}

function stopSpectating() {
    if (currentSpectating) {
        socket.emit('stop-spectating', currentSpectating);
        currentSpectating = null;
        addToSpectateLog('⏹️ Arrêt de l\'écoute');
    }
}

function addToSpectateLog(message) {
    const log = document.getElementById('spectate-log');
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

function showResult(message, type) {
    const resultDiv = document.getElementById('create-result');
    resultDiv.textContent = message;
    resultDiv.className = `result-message ${type}`;
    resultDiv.style.display = 'block';
    
    setTimeout(() => {
        resultDiv.style.display = 'none';
    }, 5000);
}

function initializeChart() {
    const ctx = document.getElementById('rooms-chart').getContext('2d');
    roomsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Joueurs par room',
                data: [],
                backgroundColor: 'rgba(52, 152, 219, 0.5)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 2
                }
            }
        }
    });
}

function updateChart(rooms) {
    if (!roomsChart) return;
    
    roomsChart.data.labels = rooms.map(r => r.name);
    roomsChart.data.datasets[0].data = rooms.map(r => r.players);
    roomsChart.update();
}

function viewPlayerStats(username) {
    fetch(`/api/admin/player-stats/${username}`)
        .then(res => res.json())
        .then(data => {
            alert(`
                📊 Statistiques de ${username}:
                
                Parties jouées: ${data.stats?.gamesPlayed || 0}
                Victoires: ${data.stats?.wins || 0}
                Score total: ${data.stats?.totalScore || 0}
                Room: ${data.room || 'Aucune'}
                Inscrit le: ${new Date(data.createdAt).toLocaleDateString()}
            `);
        })
        .catch(err => console.error(err));
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Erreur déconnexion:', error);
    }
}