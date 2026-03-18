const express = require('express');
const router = express.Router();
const dbManager = require('../database/db-manager');
const authMiddleware = require('../auth/auth-middleware');
const path = require('path');

const requireAdmin = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    
    if (!token) {
        return res.redirect('/login.html');
    }

    const session = authMiddleware.sessions.get(token);
    if (!session || session.expires < Date.now()) {
        res.clearCookie('sessionToken');
        return res.redirect('/login.html');
    }

    const user = dbManager.getUserByUsername(session.user.username);
    if (!user || user.role !== 'admin') {
        return res.status(403).send('Accès refusé - Administration uniquement');
    }

    req.user = user;
    next();
};

router.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

router.get('/api/admin/users', requireAdmin, (req, res) => {
    const db = dbManager.readDatabase();
    const safeUsers = db.users.map(u => ({
        username: u.username,
        role: u.role,
        room: u.room,
        createdAt: u.createdAt,
        stats: u.stats
    }));
    res.json(safeUsers);
});

router.post('/api/admin/create-player', requireAdmin, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nom d\'utilisateur et mot de passe requis' 
        });
    }

    const result = await dbManager.createUser(username, password, 'player');
    res.json(result);
});

router.post('/api/admin/reset-password', requireAdmin, async (req, res) => {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nom d\'utilisateur et nouveau mot de passe requis' 
        });
    }

    const db = dbManager.readDatabase();
    const userIndex = db.users.findIndex(u => u.username === username);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.users[userIndex].password = hashedPassword;

    if (dbManager.writeDatabase(db)) {
        res.json({ success: true, message: 'Mot de passe réinitialisé' });
    } else {
        res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation' });
    }
});

router.post('/api/admin/delete-room', requireAdmin, (req, res) => {
    const { room } = req.body;

    if (!room) {
        return res.status(400).json({ success: false, message: 'Room requis' });
    }

    const io = req.app.get('io');
    
    if (io) {
        const roomSockets = io.sockets.adapter.rooms.get(room);
        if (roomSockets) {
            roomSockets.forEach(socketId => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('room-deleted', 'Cette room a été fermée par l\'administrateur');
                    socket.disconnect(true);
                }
            });
        }
    }

    dbManager.deleteRoom(room);
    res.json({ success: true, message: 'Room fermée' });
});

router.get('/api/admin/stats', requireAdmin, (req, res) => {
    const io = req.app.get('io');
    const db = dbManager.readDatabase();

    if (!io) {
        return res.json({
            totalUsers: db.users.length,
            activeRooms: 0,
            connectedPlayers: 0,
            rooms: []
        });
    }

    const rooms = Array.from(io.sockets.adapter.rooms.keys())
        .filter(room => room.startsWith('room_'));
    
    const activeRooms = [];
    rooms.forEach(room => {
        const sockets = io.sockets.adapter.rooms.get(room);
        if (sockets && sockets.size > 0) {
            const players = [];
            sockets.forEach(socketId => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket && socket.user) {
                    players.push(socket.user.username);
                }
            });

            activeRooms.push({
                name: room,
                players: sockets.size,
                playerNames: players,
                sockets: Array.from(sockets)
            });
        }
    });

    const connectedPlayers = Array.from(io.sockets.sockets.keys()).length;

    res.json({
        totalUsers: db.users.length,
        activeRooms: activeRooms.length,
        connectedPlayers,
        rooms: activeRooms,
        totalRooms: db.users.filter(u => u.room).length,
        gamesInProgress: activeRooms.filter(r => r.players === 2).length
    });
});

router.get('/api/admin/player-stats/:username', requireAdmin, (req, res) => {
    const user = dbManager.getUserByUsername(req.params.username);
    if (user) {
        res.json({
            username: user.username,
            stats: user.stats,
            room: user.room,
            createdAt: user.createdAt
        });
    } else {
        res.status(404).json({ error: 'Joueur non trouvé' });
    }
});

module.exports = router;