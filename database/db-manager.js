const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'users.json');

class DatabaseManager {
    constructor() {
        this.initDatabase();
    }

    initDatabase() {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = { users: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
            console.log('📁 Base de données créée');
        }
    }

    readDatabase() {
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erreur lecture DB:', error);
            return { users: [] };
        }
    }

    writeDatabase(data) {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Erreur écriture DB:', error);
            return false;
        }
    }

    generateRoomId() {
        return 'room_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async createUser(username, password, role = 'player') {
        const db = this.readDatabase();
        
        const existingUser = db.users.find(u => u.username === username);
        if (existingUser) {
            return { success: false, message: 'Nom d\'utilisateur déjà pris' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const room = role === 'player' ? this.generateRoomId() : null;

        const newUser = {
            username,
            password: hashedPassword,
            role,
            room,
            createdAt: new Date().toISOString(),
            stats: {
                gamesPlayed: 0,
                wins: 0,
                totalScore: 0
            }
        };

        db.users.push(newUser);
        
        if (this.writeDatabase(db)) {
            return { 
                success: true, 
                message: 'Compte créé avec succès',
                user: { username, room, role }
            };
        } else {
            return { success: false, message: 'Erreur lors de la création' };
        }
    }

    async verifyUser(username, password) {
        const db = this.readDatabase();
        const user = db.users.find(u => u.username === username);

        if (!user) {
            return { success: false, message: 'Utilisateur non trouvé' };
        }

        const validPassword = await bcrypt.compare(password, user.password);
        
        if (validPassword) {
            return { 
                success: true, 
                message: 'Connexion réussie',
                user: { 
                    username: user.username, 
                    room: user.room,
                    role: user.role,
                    stats: user.stats
                }
            };
        } else {
            return { success: false, message: 'Mot de passe incorrect' };
        }
    }

    getUserByUsername(username) {
        const db = this.readDatabase();
        return db.users.find(u => u.username === username);
    }

    updateUserStats(username, gameResult) {
        const db = this.readDatabase();
        const userIndex = db.users.findIndex(u => u.username === username);
        
        if (userIndex !== -1) {
            db.users[userIndex].stats.gamesPlayed++;
            if (gameResult.won) {
                db.users[userIndex].stats.wins++;
            }
            db.users[userIndex].stats.totalScore += gameResult.score || 0;
            this.writeDatabase(db);
        }
    }

    getAllPlayers() {
        const db = this.readDatabase();
        return db.users.filter(u => u.role === 'player').map(u => ({
            username: u.username,
            room: u.room,
            stats: u.stats,
            createdAt: u.createdAt
        }));
    }

    deleteRoom(roomId) {
        const db = this.readDatabase();
        db.users.forEach(user => {
            if (user.room === roomId) {
                user.room = null;
            }
        });
        return this.writeDatabase(db);
    }
}

module.exports = new DatabaseManager();