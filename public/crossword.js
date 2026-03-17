class CrosswordGame {
    constructor(container, socket, roomId, player) {
        this.container = container;
        this.socket = socket;
        this.roomId = roomId;
        this.player = player;
        
        this.grid = [];
        this.words = [
            { word: 'CHAT', clue: 'Animal domestique qui miaule', x: 0, y: 0, direction: 'across' },
            { word: 'CHIEN', clue: 'Meilleur ami de l\'homme', x: 0, y: 2, direction: 'across' },
            { word: 'SOLEIL', clue: 'Il brille dans le ciel', x: 0, y: 4, direction: 'across' },
            { word: 'LUNE', clue: 'Elle éclaire la nuit', x: 3, y: 0, direction: 'down' },
            { word: 'ETOILE', clue: 'Point lumineux dans le ciel', x: 5, y: 0, direction: 'down' }
        ];
        
        this.playerAnswers = {};
        this.startTime = Date.now();
        this.score = 0;
        
        this.createUI();
        this.generateGrid();
        this.setupTimer();
    }
    
    createUI() {
        const gameDiv = document.createElement('div');
        gameDiv.classList.add('crossword-game');
        
        this.gridContainer = document.createElement('div');
        this.gridContainer.classList.add('crossword-grid');
        
        const cluesDiv = document.createElement('div');
        cluesDiv.classList.add('crossword-clues');
        
        const acrossClues = document.createElement('div');
        acrossClues.classList.add('clues-across');
        acrossClues.innerHTML = '<h3>Horizontal</h3><ul id="across-clues"></ul>';
        
        const downClues = document.createElement('div');
        downClues.classList.add('clues-down');
        downClues.innerHTML = '<h3>Vertical</h3><ul id="down-clues"></ul>';
        
        cluesDiv.appendChild(acrossClues);
        cluesDiv.appendChild(downClues);
        
        gameDiv.appendChild(this.gridContainer);
        gameDiv.appendChild(cluesDiv);
        
        this.container.appendChild(gameDiv);
    }
    
    generateGrid() {
        let maxX = 0;
        let maxY = 0;
        
        this.words.forEach(word => {
            if (word.direction === 'across') {
                maxX = Math.max(maxX, word.x + word.word.length);
                maxY = Math.max(maxY, word.y + 1);
            } else {
                maxX = Math.max(maxX, word.x + 1);
                maxY = Math.max(maxY, word.y + word.word.length);
            }
        });
        
        for (let y = 0; y < maxY; y++) {
            this.grid[y] = [];
            for (let x = 0; x < maxX; x++) {
                this.grid[y][x] = '';
            }
        }
        
        this.words.forEach(word => {
            for (let i = 0; i < word.word.length; i++) {
                if (word.direction === 'across') {
                    this.grid[word.y][word.x + i] = word.word[i];
                } else {
                    this.grid[word.y + i][word.x] = word.word[i];
                }
            }
        });
        
        this.gridContainer.style.gridTemplateColumns = `repeat(${maxX}, 40px)`;
        
        for (let y = 0; y < maxY; y++) {
            for (let x = 0; x < maxX; x++) {
                const cell = document.createElement('div');
                cell.classList.add('crossword-cell');
                
                if (this.grid[y][x] !== '') {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.maxLength = 1;
                    input.dataset.x = x;
                    input.dataset.y = y;
                    input.addEventListener('input', (e) => this.checkAnswer(e, x, y));
                    cell.appendChild(input);
                }
                
                this.gridContainer.appendChild(cell);
            }
        }
        
        const acrossList = document.getElementById('across-clues');
        const downList = document.getElementById('down-clues');
        
        this.words.forEach((word, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${word.clue}`;
            
            if (word.direction === 'across') {
                acrossList.appendChild(li);
            } else {
                downList.appendChild(li);
            }
        });
    }
    
    checkAnswer(event, x, y) {
        const input = event.target;
        const value = input.value.toUpperCase();
        const correctLetter = this.grid[y][x];
        
        if (value === correctLetter) {
            input.style.backgroundColor = '#90EE90';
            this.playerAnswers[`${x},${y}`] = true;
            this.checkWordCompletion();
        } else {
            input.style.backgroundColor = '#FFB6C1';
        }
    }
    
    checkWordCompletion() {
        let allCorrect = true;
        
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                if (this.grid[y][x] !== '' && !this.playerAnswers[`${x},${y}`]) {
                    allCorrect = false;
                    break;
                }
            }
        }
        
        if (allCorrect) {
            const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.score = Math.max(0, 1000 - timeElapsed * 10);
            this.socket.emit('update-score', this.roomId, this.player.id, this.score);
            this.socket.emit('game-over', this.roomId, this.player.name);
        }
    }
    
    setupTimer() {
        const timerDiv = document.getElementById('game-timer');
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerDiv.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    destroy() {
        clearInterval(this.timerInterval);
        this.container.innerHTML = '';
    }
}
