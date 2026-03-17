const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    const newRoomId = generateRoomId();
    res.redirect(`/room/${newRoomId}`);
});

io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);

    socket.on('join-room', (roomId, playerName, callback) => {
        try {
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

            if (room.isLocked) {
                callback({ success: false, message: 'Salle verrouillée' });
                return;
            }

            const player = {
                id: socket.id,
                name: playerName || `Joueur ${room.players.length + 1}`,
                isReady: false,
                score: 0
            };

            room.players.push(player);
            socket.join(roomId);

            if (room.players.length === 2) {
                room.isLocked = true;
            }

            console.log(`Joueur ${player.name} a rejoint la room ${roomId}`);

            io.to(roomId).emit('room-update', {
                players: room.players,
                isLocked: room.isLocked,
                currentGame: room.currentGame
            });

            callback({ success: true, roomId, player });
        } catch (error) {
            console.error('Erreur join-room:', error);
            callback({ success: false, message: 'Erreur serveur' });
        }
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

    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);

        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    room.isLocked = false;
                    io.to(roomId).emit('room-update', {
                        players: room.players,
                        isLocked: room.isLocked,
                        currentGame: room.currentGame
                    });
                }

                console.log(`Joueur ${player.name} a quitté la room ${roomId}`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});