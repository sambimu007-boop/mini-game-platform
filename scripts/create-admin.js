const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function createAdmin() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise(resolve => readline.question(query, resolve));

    console.log('🔐 Création d\'un compte administrateur\n');

    const username = await question('Nom d\'utilisateur admin: ');
    const password = await question('Mot de passe admin: ');

    const dbPath = path.join(__dirname, '..', 'database', 'users.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    const existingAdmin = db.users.find(u => u.role === 'admin');
    if (existingAdmin) {
        console.log('❌ Un administrateur existe déjà!');
        readline.close();
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = {
        username,
        password: hashedPassword,
        role: 'admin',
        room: null,
        createdAt: new Date().toISOString(),
        stats: {
            gamesPlayed: 0,
            wins: 0,
            totalScore: 0
        }
    };

    db.users.push(newAdmin);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    console.log(`\n✅ Compte admin créé avec succès!`);
    console.log(`Nom d'utilisateur: ${username}`);

    readline.close();
}

createAdmin();