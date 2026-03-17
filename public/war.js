class WarGame {
    constructor(container, socket, roomId, player) {
        this.container = container;
        this.socket = socket;
        this.roomId = roomId;
        this.player = player;
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.classList.add('war-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        this.phase = 'preparation';
        this.soldiers = [];
        this.playerPosition = { x: 400, y: 300 };
        this.playerHealth = 100;
        this.playerShield = false;
        this.enemies = [];
        this.score = 0;
        this.bullets = [];
        
        this.keys = {};
        this.setupControls();
        
        this.generateMap();
        this.startPreparationPhase();
        this.animate();
    }
    
    setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            if (e.key.toLowerCase() === 'b') {
                this.playerShield = true;
                setTimeout(() => {
                    this.playerShield = false;
                }, 3000);
            }
            
            if (e.key.toLowerCase() === ' ') {
                this.shoot();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    generateMap() {
        this.obstacles = [];
        for (let i = 0; i < 20; i++) {
            this.obstacles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                width: 50 + Math.random() * 50,
                height: 50 + Math.random() * 50
            });
        }
    }
    
    startPreparationPhase() {
        this.phase = 'preparation';
        
        const soldierTypes = ['sniper', 'tank', 'eclaireur'];
        for (let i = 0; i < 10; i++) {
            const type = soldierTypes[Math.floor(Math.random() * soldierTypes.length)];
            this.soldiers.push({
                id: i,
                type: type,
                x: this.playerPosition.x + (Math.random() - 0.5) * 200,
                y: this.playerPosition.y + (Math.random() - 0.5) * 200,
                health: type === 'tank' ? 150 : 100,
                range: type === 'sniper' ? 300 : (type === 'eclaireur' ? 200 : 150),
                damage: type === 'sniper' ? 50 : 30,
                vision: type === 'eclaireur' ? 250 : 150
            });
        }
        
        this.showMessage('Phase de préparation: Placez vos soldats (cliquez pour déplacer)');
        
        this.canvas.addEventListener('click', (e) => {
            if (this.phase !== 'preparation') return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let closestSoldier = null;
            let closestDistance = Infinity;
            
            this.soldiers.forEach(soldier => {
                const distance = Math.sqrt(
                    Math.pow(soldier.x - x, 2) + 
                    Math.pow(soldier.y - y, 2)
                );
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestSoldier = soldier;
                }
            });
            
            if (closestSoldier && closestDistance < 50) {
                closestSoldier.x = x;
                closestSoldier.y = y;
            }
        });
        
        setTimeout(() => {
            if (this.phase === 'preparation') {
                this.startCombatPhase();
            }
        }, 30000);
    }
    
    startCombatPhase() {
        this.phase = 'combat';
        this.showMessage('Phase de combat: Commencez!');
        
        for (let i = 0; i < 5; i++) {
            this.enemies.push({
                id: i,
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                health: 100,
                damage: 20,
                vision: 150,
                speed: 2
            });
        }
    }
    
    shoot() {
        if (this.phase !== 'combat') return;
        
        this.bullets.push({
            x: this.playerPosition.x,
            y: this.playerPosition.y,
            targetX: this.playerPosition.x + 100,
            targetY: this.playerPosition.y,
            speed: 10,
            damage: 30
        });
    }
    
    update() {
        if (this.phase !== 'combat') return;
        
        const speed = 5;
        if (this.keys['z'] || this.keys['arrowup']) this.playerPosition.y -= speed;
        if (this.keys['s'] || this.keys['arrowdown']) this.playerPosition.y += speed;
        if (this.keys['q'] || this.keys['arrowleft']) this.playerPosition.x -= speed;
        if (this.keys['d'] || this.keys['arrowright']) this.playerPosition.x += speed;
        
        this.playerPosition.x = Math.max(0, Math.min(this.canvas.width, this.playerPosition.x));
        this.playerPosition.y = Math.max(0, Math.min(this.canvas.height, this.playerPosition.y));
        
        this.enemies.forEach(enemy => {
            const dx = this.playerPosition.x - enemy.x;
            const dy = this.playerPosition.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                enemy.x += (dx / distance) * enemy.speed;
                enemy.y += (dy / distance) * enemy.speed;
            }
            
            if (distance < 50 && !this.playerShield) {
                this.playerHealth -= enemy.damage / 10;
            }
        });
        
        this.bullets.forEach((bullet, index) => {
            bullet.x += bullet.speed;
            
            this.enemies.forEach(enemy => {
                const distance = Math.sqrt(
                    Math.pow(bullet.x - enemy.x, 2) + 
                    Math.pow(bullet.y - enemy.y, 2)
                );
                
                if (distance < 30) {
                    enemy.health -= bullet.damage;
                    this.bullets.splice(index, 1);
                    
                    if (enemy.health <= 0) {
                        this.enemies = this.enemies.filter(e => e.id !== enemy.id);
                        this.score += 100;
                        this.socket.emit('update-score', this.roomId, this.player.id, this.score);
                    }
                }
            });
        });
        
        if (this.playerHealth <= 0) {
            this.gameOver('Joueur 2');
        } else if (this.enemies.length === 0) {
            this.gameOver('Joueur 1');
        }
        
        this.socket.emit('game-update', this.roomId, {
            playerId: this.player.id,
            position: this.playerPosition,
            health: this.playerHealth,
            enemies: this.enemies,
            bullets: this.bullets
        });
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#8B4513';
        this.obstacles.forEach(obstacle => {
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        });
        
        this.soldiers.forEach(soldier => {
            switch(soldier.type) {
                case 'sniper':
                    this.ctx.fillStyle = '#FF0000';
                    break;
                case 'tank':
                    this.ctx.fillStyle = '#00FF00';
                    break;
                case 'eclaireur':
                    this.ctx.fillStyle = '#0000FF';
                    break;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(soldier.x, soldier.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#00FF00';
            this.ctx.fillRect(soldier.x - 15, soldier.y - 20, 30, 5);
        });
        
        this.enemies.forEach(enemy => {
            this.ctx.fillStyle = '#FF0000';
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#00FF00';
            const healthPercent = enemy.health / 100;
            this.ctx.fillRect(enemy.x - 15, enemy.y - 25, 30 * healthPercent, 5);
        });
        
        this.ctx.fillStyle = '#00FF00';
        this.ctx.beginPath();
        this.ctx.arc(this.playerPosition.x, this.playerPosition.y, 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        if (this.playerShield) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(this.playerPosition.x, this.playerPosition.y, 25, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(this.playerPosition.x - 20, this.playerPosition.y - 35, 40 * (this.playerHealth / 100), 5);
        
        this.bullets.forEach(bullet => {
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.fillRect(bullet.x, bullet.y, 5, 5);
        });
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
    }
    
    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
    
    showMessage(message) {
        console.log(message);
    }
    
    gameOver(winner) {
        this.socket.emit('game-over', this.roomId, winner);
    }
    
    destroy() {
        this.canvas.remove();
    }
}