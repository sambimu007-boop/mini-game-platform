# 📋 GUIDE D'INTÉGRATION — Fichiers additionnels

Ces 3 fichiers corrigent deux problèmes sans modifier le code existant.
Vous n'avez qu'à les ajouter + faire 2 petites insertions dans les fichiers existants.

---

## 📁 Fichiers à ajouter dans le projet

```
mini-game-platform/
├── admin/
│   ├── admin-routes.js        ← EXISTANT, ne pas toucher
│   ├── admin.html             ← EXISTANT, ne pas toucher
│   ├── invite-route.js        ← ✅ NOUVEAU (correction invitations + accès admin)
│   └── setup-route.js         ← ✅ NOUVEAU (création admin depuis Render)
└── public/
    ├── index.html             ← EXISTANT, 1 ligne à ajouter
    ├── main.js                ← EXISTANT, ne pas toucher
    └── invite-fix.js          ← ✅ NOUVEAU (correction du lien affiché)
```

---

## ✏️ Modifications dans les fichiers EXISTANTS

### 1. Dans `server.js` — Ajouter 4 lignes après les imports existants

Trouvez ce bloc dans server.js :
```js
// Routes
app.use('/', authRoutes);
app.use('/', adminRoutes);
```

Et ajoutez juste en dessous :
```js
// ✅ Routes additionnelles (correction invitations + setup admin)
const inviteRoute = require('./admin/invite-route');
const setupRoute = require('./admin/setup-route');
app.use('/', inviteRoute);
app.use('/', setupRoute);
```

---

### 2. Dans `public/index.html` — Ajouter 1 ligne avant main.js

Trouvez la balise `<script src="main.js">` et ajoutez AVANT :
```html
<!-- ✅ Correction du lien d'invitation -->
<script src="/invite-fix.js"></script>
```

---

## ⚙️ Variable d'environnement à ajouter dans Render

Dans le dashboard Render → votre service → "Environment" :

| Variable         | Valeur                              |
|------------------|-------------------------------------|
| `SETUP_SECRET`   | Un mot de passe secret de votre choix (ex: `MonSecret2024!`) |

---

## 🚀 Procédure pour créer votre compte admin

1. Déployez le code avec les modifications ci-dessus
2. Allez sur **https://votre-site.render.com/setup**
3. Saisissez votre `SETUP_SECRET`, choisissez un nom et mot de passe admin
4. Cliquez "Créer le compte admin"
5. **Supprimez la variable `SETUP_SECRET` dans Render** (la route devient inaccessible)
6. Connectez-vous sur `/login.html` avec vos identifiants admin
7. Accédez à votre panel via **`/admin-direct`** (au lieu de `/admin`)

---

## 🎮 Comment fonctionne maintenant l'invitation

**Avant (problème) :**
- Le lien affiché était `window.location.href` = URL de la page = inutile pour inviter
- Même si le bon lien était partagé, le serveur plaçait le Joueur B dans SA propre room

**Après (corrigé) :**
1. Joueur A se connecte et voit le lobby
2. Le script `invite-fix.js` appelle `/api/my-invite-link`
3. Le serveur génère un token et retourne le lien : `https://site.com/join/inv_XXXXX`
4. Ce lien s'affiche dans le champ "Partager ce lien"
5. Joueur B clique sur le lien → `/join/inv_XXXXX`
6. Le serveur modifie temporairement la session de B pour qu'il rejoigne la room de A
7. B est redirigé vers `/room/room_ABC` → les deux joueurs sont dans la même room ✅

---

## 🔑 Accès admin

- **Panel admin** : `/admin-direct` (fonctionne sans avoir de room)
- **Ancienne route** : `/admin` continue de fonctionner pour les futurs cas

---

## ⚠️ Notes importantes

- Les tokens d'invitation expirent après **2 heures**
- Chaque token est à **usage unique** (invalidé dès que le second joueur clique)
- La route `/setup` est **désactivée automatiquement** si `SETUP_SECRET` n'est pas défini
- Aucun fichier existant n'est modifié — tout est additionnel
