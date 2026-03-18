const express = require('express');
const router = express.Router();
const dbManager = require('../database/db-manager');
const authMiddleware = require('./auth-middleware');

router.get('/register', (req, res) => {
    res.sendFile('register.html', { root: './public' });
});

router.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nom d\'utilisateur et mot de passe requis' 
        });
    }

    if (password.length < 4) {
        return res.status(400).json({ 
            success: false, 
            message: 'Le mot de passe doit contenir au moins 4 caractères' 
        });
    }

    const result = await dbManager.createUser(username, password, 'player');
    
    if (result.success) {
        const token = authMiddleware.createSession(result.user);
        res.cookie('sessionToken', token, { 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true 
        });
        
        res.json({ 
            success: true, 
            message: 'Inscription réussie',
            redirect: '/' 
        });
    } else {
        res.status(400).json(result);
    }
});

router.get('/login', (req, res) => {
    res.sendFile('login.html', { root: './public' });
});

router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nom d\'utilisateur et mot de passe requis' 
        });
    }

    const result = await dbManager.verifyUser(username, password);
    
    if (result.success) {
        const token = authMiddleware.createSession(result.user);
        res.cookie('sessionToken', token, { 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true 
        });
        
        res.json({ 
            success: true, 
            message: 'Connexion réussie',
            redirect: '/'
        });
    } else {
        res.status(401).json(result);
    }
});

router.post('/api/logout', (req, res) => {
    const token = req.cookies?.sessionToken;
    
    if (token) {
        authMiddleware.destroySession(token);
        res.clearCookie('sessionToken');
    }
    
    res.json({ success: true, message: 'Déconnecté' });
});

router.get('/api/check-session', (req, res) => {
    const token = req.cookies?.sessionToken;
    
    if (!token) {
        return res.json({ authenticated: false });
    }

    const session = authMiddleware.sessions.get(token);
    if (!session || session.expires < Date.now()) {
        res.clearCookie('sessionToken');
        return res.json({ authenticated: false });
    }

    res.json({ 
        authenticated: true, 
        user: session.user 
    });
});

module.exports = router;