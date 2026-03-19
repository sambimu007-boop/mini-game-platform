const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'users.json');
if (!fs.existsSync(dbPath) || JSON.parse(fs.readFileSync(dbPath)).users.some(u => u.password === '$2b$10$YourHashedAdminPasswordHere')) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
}

const express = require('express');

const http = require('http');
const socketIO = require('socket.io');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Imports
const authRoutes = require('./auth/auth-routes');
const authMiddleware = require('./auth/auth-middleware');
const dbManager = require('./database/db-manager');
const adminRoutes = require('./admin/admin-routes');
const AudioSignaling = require('./audio/audio-signaling');
const TournamentManager = require('./games/tournament-manager');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/', authRoutes);
app.use('/', adminRoutes);

const inviteRoute = require('./admin/invite-route');
const setupRoute = require('./admin/setup-route');
app.use('/', inviteRoute);
app.use('/', setupRoute);

// Stocker l'instance io
app.set('io', io);

// Initialiser la signalisation audio
const audioSignaling = new AudioSignaling(io);

// Stockage des rooms et tournois
const rooms = new Map();
const tournaments = new Map();

// Protection des routes
app.get('/', authMiddleware.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:roomId', authMiddleware.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware Socket.IO pour l'authentification
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    authMiddleware.checkRoomAccess(socket, (err) => {
        if (err) return next(err);
        socket.userRoom = socket.user.room;
        next();
    });
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id, 'User:', socket.user?.username);

    socket.on('join-room', (requestedRoomId, playerName, callback) => {
        const roomId = socket.userRoom;
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                players: [],
                gameState: null,
                currentGame: null,
                isLocked: false
            });
        }

        const room = rooms.get(roomId);

        if (room.players.length >= 2) {
            callback({ success: false, message: 'Salle complète' });
            return;
        }

        const player = {
            id: socket.id,
            name: playerName || `Joueur ${room.players.length + 1}`,
            username: socket.user.username,
            isReady: false,
            score: 0
        };

        room.players.push(player);
        socket.join(roomId);

        if (room.players.length === 2) {
            room.isLocked = true;
            audioSignaling.startAudioCall(roomId);
        }

        io.to(roomId).emit('room-update', {
            players: room.players,
            isLocked: room.isLocked,
            currentGame: room.currentGame
        });

        callback({ success: true, roomId, player });
    });

    socket.on('select-game', (roomId, gameType) => {
        const room = rooms.get(roomId);
        if (!room) return;

        room.currentGame = gameType;
        room.gameState = {
            players: {},
            gameStarted: false,
            gameData: {}
        };

        io.to(roomId).emit('game-selected', gameType);
    });

    socket.on('start-game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || !room.currentGame) return;

        room.gameState.gameStarted = true;
        room.gameState.startTime = Date.now();

        io.to(roomId).emit('game-started', room.gameState);
    });

    socket.on('game-update', (roomId, gameData) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState) return;

        room.gameState.gameData[gameData.playerId] = gameData;
        socket.to(roomId).emit('game-update', gameData);
        
        socket.to(`spectate:${roomId}`).emit('game-update', { roomId, ...gameData });
    });

    socket.on('update-score', (roomId, playerId, score) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.score = score;
            io.to(roomId).emit('score-update', room.players);
        }
    });

    socket.on('game-over', (roomId, winner) => {
        const room = rooms.get(roomId);
        if (!room) return;

        io.to(roomId).emit('game-over', winner);
    });

    socket.on('tournament:start', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length === 2) {
            const tournament = new TournamentManager(roomId, io);
            tournaments.set(roomId, tournament);
            tournament.startTournament(room.players);
        }
    });

    socket.on('tournament:game-end', (roomId, winner, scores) => {
        const tournament = tournaments.get(roomId);
        if (tournament) {
            tournament.onGameEnd(winner, scores);
        }
    });

    socket.on('start-spectating', (roomId) => {
        const token = socket.handshake.auth.token;
        const session = authMiddleware.sessions.get(token);
        const user = dbManager.getUserByUsername(session?.user?.username);
        
        if (user && user.role === 'admin') {
            socket.join(`spectate:${roomId}`);
            console.log(`👁️ Admin ${user.username} écoute la room ${roomId}`);
        }
    });

    socket.on('stop-spectating', (roomId) => {
        socket.leave(`spectate:${roomId}`);
    });

    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);
        
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);

                audioSignaling.stopAudioCall(roomId);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    tournaments.delete(roomId);
                } else {
                    room.isLocked = false;
                    io.to(roomId).emit('room-update', {
                        players: room.players,
                        isLocked: room.isLocked,
                        currentGame: room.currentGae
                    });
                }
                break;
            }
        }
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});