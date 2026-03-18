#!/bin/bash
echo "🚀 Construction de l'application..."
npm install
mkdir -p database
mkdir -p logs
if [ ! -f database/users.json ]; then
    echo '{"users":[]}' > database/users.json
fi
chmod +x build.sh
echo "✅ Build terminé !"