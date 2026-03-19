/**
 * FICHIER ADDITIONNEL #1 — admin/setup-route.js
 * 
 * Route /setup pour créer le compte admin depuis Render (sans terminal interactif).
 * Protégée par la variable d'environnement SETUP_SECRET.
 * 
 * UTILISATION :
 *   1. Ajouter dans .env (et dans les variables d'env Render) :
 *        SETUP_SECRET=un_mot_de_passe_secret_que_vous_choisissez
 *   2. Ajouter dans server.js (juste après les autres app.use('/') ) :
 *        const setupRoute = require('./admin/setup-route');
 *        app.use('/', setupRoute);
 *   3. Aller sur https://votre-site.render.com/setup
 *   4. Saisir le SETUP_SECRET + le nom/mdp admin souhaité
 *   5. Une fois l'admin créé, SUPPRIMER ou désactiver SETUP_SECRET dans Render
 *      pour que la route devienne inaccessible.
 */

const express = require('express');
const router = express.Router();
const dbManager = require('../database/db-manager');

// Page HTML du formulaire de setup
const setupPageHTML = (message = '', error = '') => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup Admin — Mini Game Platform</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            width: 420px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #333; margin-bottom: 8px; font-size: 1.6rem; }
        .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 28px; }
        label { display: block; font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 6px; margin-top: 16px; }
        input {
            width: 100%;
            padding: 12px 14px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 0.95rem;
            transition: border-color 0.2s;
        }
        input:focus { outline: none; border-color: #667eea; }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            margin-top: 24px;
            transition: opacity 0.2s;
        }
        button:hover { opacity: 0.9; }
        .success {
            background: #e8f5e9;
            border: 1px solid #4caf50;
            color: #2e7d32;
            padding: 14px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 0.9rem;
        }
        .error {
            background: #ffebee;
            border: 1px solid #f44336;
            color: #c62828;
            padding: 14px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 0.9rem;
        }
        .warning {
            background: #fff8e1;
            border: 1px solid #ffc107;
            color: #7c5700;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 0.85rem;
        }
        hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔐 Setup Admin</h1>
        <p class="subtitle">Création du compte administrateur</p>
        
        <div class="warning">
            ⚠️ Cette page est protégée par le <code>SETUP_SECRET</code>.<br>
            Désactivez-la après utilisation en supprimant la variable d'env.
        </div>

        ${message ? `<div class="success">${message}</div>` : ''}
        ${error ? `<div class="error">${error}</div>` : ''}

        ${!message ? `
        <form method="POST" action="/setup">
            <label>Secret de setup</label>
            <input type="password" name="setupSecret" placeholder="SETUP_SECRET défini dans Render" required>
            
            <hr>
            
            <label>Nom d'utilisateur admin</label>
            <input type="text" name="username" placeholder="ex: admin" required>
            
            <label>Mot de passe admin</label>
            <input type="password" name="password" placeholder="Choisissez un mot de passe fort" required>
            
            <button type="submit">✅ Créer le compte admin</button>
        </form>
        ` : `
        <a href="/login.html" style="display:block; text-align:center; margin-top:20px; color:#667eea; font-weight:600;">
            → Aller à la page de connexion
        </a>
        `}
    </div>
</body>
</html>
`;

// GET /setup — affiche le formulaire
router.get('/setup', (req, res) => {
    // Si SETUP_SECRET n'est pas défini dans l'environnement, la route est désactivée
    if (!process.env.SETUP_SECRET) {
        return res.status(404).send('Page non trouvée');
    }
    res.send(setupPageHTML());
});

// POST /setup — traite la création de l'admin
router.post('/setup', async (req, res) => {
    if (!process.env.SETUP_SECRET) {
        return res.status(404).send('Page non trouvée');
    }

    const { setupSecret, username, password } = req.body;

    // Vérification du secret
    if (setupSecret !== process.env.SETUP_SECRET) {
        return res.send(setupPageHTML('', '❌ Secret incorrect. Accès refusé.'));
    }

    if (!username || !password) {
        return res.send(setupPageHTML('', '❌ Nom d\'utilisateur et mot de passe requis.'));
    }

    if (password.length < 6) {
        return res.send(setupPageHTML('', '❌ Le mot de passe doit faire au moins 6 caractères.'));
    }

    // Vérifier si un admin existe déjà
    const db = dbManager.readDatabase();
    const existingAdmin = db.users.find(u => u.role === 'admin');

    if (existingAdmin) {
        return res.send(setupPageHTML(
            '',
            `❌ Un administrateur existe déjà (<strong>${existingAdmin.username}</strong>). 
             Supprimez-le manuellement de users.json si vous voulez en créer un nouveau.`
        ));
    }

    // Créer l'admin
    const result = await dbManager.createUser(username, password, 'admin');

    if (result.success) {
        console.log(`✅ [SETUP] Compte admin créé : ${username}`);
        return res.send(setupPageHTML(
            `✅ Compte admin <strong>${username}</strong> créé avec succès !<br>
             Vous pouvez maintenant vous connecter sur <a href="/login.html">/login</a>.<br><br>
             <strong>Pensez à supprimer la variable SETUP_SECRET dans Render !</strong>`
        ));
    } else {
        return res.send(setupPageHTML('', `❌ Erreur : ${result.message}`));
    }
});

module.exports = router;
