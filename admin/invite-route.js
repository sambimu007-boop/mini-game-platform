/**
 * FICHIER ADDITIONNEL #3 — admin/invite-route.js
 * 
 * Routes supplémentaires pour corriger le système d'invitation et l'accès admin.
 * 
 * AJOUTER dans server.js (juste après les autres app.use('/')) :
 *   const inviteRoute = require('./admin/invite-route');
 *   app.use('/', inviteRoute);
 * 
 * CE QUE CE FICHIER RÉSOUT :
 * 
 * ─── PROBLÈME 1 : Liens d'invitation identiques ───────────────────────────
 * 
 *   Architecture originale :
 *   - Chaque joueur a sa propre room en base (ex: Joueur A → room_ABC)
 *   - Le serveur Socket.IO utilise socket.user.room (room DU joueur connecté)
 *   - Donc même si Joueur B clique sur le lien de la room de A (/room/room_ABC),
 *     le serveur le fait rejoindre room_XYZ (SA room), pas room_ABC.
 * 
 *   Solution : Système de tokens d'invitation temporaires
 *   - GET  /api/my-invite-link     → génère un token et retourne le lien d'invitation
 *   - GET  /join/:token            → Joueur B arrive via ce lien, son socket.userRoom
 *                                    est temporairement remplacé par la room de A
 * 
 * ─── PROBLÈME 2 : Admin bloqué par le middleware Socket.IO ────────────────
 * 
 *   L'admin n'a pas de `room` (room: null), donc le middleware Socket.IO
 *   checkRoomAccess échoue ou socket.userRoom est null.
 *   Résultat : l'admin ne peut pas se connecter au site.
 * 
 *   Solution : Route /admin-direct qui sert la page admin sans passer par
 *   la logique Socket.IO, avec vérification de session classique.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const authMiddleware = require('../auth/auth-middleware');
const dbManager = require('../database/db-manager');

// Stockage en mémoire des tokens d'invitation (token → { roomId, createdBy, expires })
const inviteTokens = new Map();

// Nettoyage automatique des tokens expirés toutes les 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of inviteTokens.entries()) {
        if (data.expires < now) {
            inviteTokens.delete(token);
        }
    }
}, 10 * 60 * 1000);

/**
 * Génère un token d'invitation unique
 */
function generateInviteToken() {
    return 'inv_' + Math.random().toString(36).substring(2, 10) +
           Math.random().toString(36).substring(2, 10);
}

/**
 * Middleware : vérifie la session via cookie (sans Socket.IO)
 */
function requireAuthHTTP(req, res, next) {
    const token = req.cookies?.sessionToken;

    if (!token) {
        return res.redirect('/login.html');
    }

    const session = authMiddleware.sessions.get(token);
    if (!session || session.expires < Date.now()) {
        res.clearCookie('sessionToken');
        return res.redirect('/login.html');
    }

    req.user = session.user;
    next();
}

// ═══════════════════════════════════════════════════════════════
// CORRECTION PROBLÈME 1 — Liens d'invitation
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/my-invite-link
 * Retourne le lien d'invitation avec token pour que le second joueur
 * rejoigne la bonne room (celle du joueur qui invite).
 */
router.get('/api/my-invite-link', requireAuthHTTP, (req, res) => {
    const user = req.user;

    if (!user.room) {
        return res.status(400).json({
            success: false,
            message: 'Vous n\'avez pas de room assignée.'
        });
    }

    // Générer un token d'invitation valable 2 heures
    const token = generateInviteToken();
    inviteTokens.set(token, {
        roomId: user.room,
        createdBy: user.username,
        expires: Date.now() + 2 * 60 * 60 * 1000 // 2 heures
    });

    const baseUrl = req.protocol + '://' + req.get('host');
    const inviteLink = `${baseUrl}/join/${token}`;

    console.log(`[Invite] ${user.username} a généré un lien d'invitation pour ${user.room}`);

    res.json({
        success: true,
        inviteLink,
        roomId: user.room,
        expiresIn: '2 heures'
    });
});

/**
 * GET /join/:token
 * Point d'entrée pour le second joueur qui clique sur le lien d'invitation.
 * Stocke la room cible dans la session, puis redirige vers la page de jeu.
 */
router.get('/join/:token', requireAuthHTTP, (req, res) => {
    const { token } = req.params;
    const inviteData = inviteTokens.get(token);

    // Token invalide ou expiré
    if (!inviteData || inviteData.expires < Date.now()) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Lien expiré</title>
                <style>
                    body { font-family: sans-serif; background: #667eea; display:flex; 
                           align-items:center; justify-content:center; min-height:100vh; }
                    .card { background:white; padding:40px; border-radius:16px; text-align:center; }
                    h2 { color:#333; }
                    p { color:#666; margin:10px 0; }
                    a { color:#667eea; font-weight:600; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>⏰ Lien expiré ou invalide</h2>
                    <p>Ce lien d'invitation n'est plus valide.</p>
                    <p>Demandez un nouveau lien à votre ami.</p>
                    <a href="/">← Retour à l'accueil</a>
                </div>
            </body>
            </html>
        `);
    }

    const targetRoom = inviteData.roomId;
    const sessionToken = req.cookies?.sessionToken;

    // On stocke la room cible dans la session de l'invité
    // (surcharge temporaire pour que Socket.IO le place dans la bonne room)
    if (sessionToken) {
        const session = authMiddleware.sessions.get(sessionToken);
        if (session) {
            // On sauvegarde la room originale et on met la room cible
            session._originalRoom = session.user.room;
            session.user.room = targetRoom;
            session._invitedTo = targetRoom;
            session._inviteToken = token;

            console.log(`[Invite] ${req.user.username} rejoint la room ${targetRoom} via invitation de ${inviteData.createdBy}`);
        }
    }

    // Invalider le token (usage unique)
    inviteTokens.delete(token);

    // Rediriger vers la page de jeu avec la room cible
    res.redirect(`/room/${targetRoom}`);
});

// ═══════════════════════════════════════════════════════════════
// CORRECTION PROBLÈME 2 — Accès admin sans second joueur
// ═══════════════════════════════════════════════════════════════

/**
 * Middleware admin strict (vérifie le rôle en base, pas en session)
 */
function requireAdminDirect(req, res, next) {
    const token = req.cookies?.sessionToken;

    if (!token) {
        return res.redirect('/login.html');
    }

    const session = authMiddleware.sessions.get(token);
    if (!session || session.expires < Date.now()) {
        res.clearCookie('sessionToken');
        return res.redirect('/login.html');
    }

    // Vérification du rôle directement en base (source de vérité)
    const userInDB = dbManager.getUserByUsername(session.user.username);
    if (!userInDB || userInDB.role !== 'admin') {
        return res.status(403).send(`
            <h2 style="font-family:sans-serif;text-align:center;margin-top:100px;color:#c00">
                ⛔ Accès refusé — Administrateurs uniquement
            </h2>
            <p style="text-align:center"><a href="/">← Retour</a></p>
        `);
    }

    req.user = session.user;
    next();
}

/**
 * GET /admin-direct
 * Version de /admin accessible sans Socket.IO actif.
 * L'admin n'a pas de room, donc il ne peut pas rejoindre une room de jeu,
 * mais il peut accéder à son panel d'administration.
 * 
 * UTILISATION : aller sur /admin-direct au lieu de /admin
 */
router.get('/admin-direct', requireAdminDirect, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

/**
 * GET /api/admin-check
 * Vérifie si l'utilisateur courant est admin (utile pour le client JS).
 */
router.get('/api/admin-check', requireAuthHTTP, (req, res) => {
    const userInDB = dbManager.getUserByUsername(req.user.username);
    res.json({
        isAdmin: userInDB?.role === 'admin',
        username: req.user.username
    });
});

// Exposer la map des tokens pour que server.js puisse l'utiliser si besoin
router.inviteTokens = inviteTokens;

module.exports = router;
