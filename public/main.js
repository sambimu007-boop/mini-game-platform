const socket = io();
let currentRoom = null;
let currentPlayer = null;
let currentGame = null;
let gameInstance = null;

const pathParts = window.location.pathname.split('/');
const roomId = pathParts[pathParts.length - 1];

const lobbyScreen = document.getElementById('lobby-screen');
const gameSelectScreen = document.getElementById('game-select-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const roomIdSpan = document.getElementById('room-id');
const roomLinkInput = document.getElementById('room-link');
const playersList = document.getElementById('players');
const playerNameInput = document.getElementById('player-name');
const gameContainer = document.getElementById('game-container');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const gameTimer = document.getElementById('game-timer');

document.addEventListener('DOMContentLoaded', () => {
    roomIdSpan.textContent = roomId;
    roomLinkInput.value = window.location.href;
    
    const defaultName = `Joueur_${Math.random().toString(36).substring(7)}`;
    playerNameInput.value = defaultName;
    
    joinRoom();
});

function copyRoomLink() {
    roomLinkInput.select();
    document.execCommand('copy');
    alert('Lien copié dans le presse-papier!');
}

function setPlayerName() {
    if (currentPlayer) {
        currentPlayer.name = playerNameInput.value || 'Joueur';
    }
}

function joinRoom() {
    const playerName = playerNameInput.value || 'Joueur';
    
    socket.emit('join-room', roomId, playerName, (response) => {
        if (response.success) {
            currentRoom = response.roomId;
            currentPlayer = response.player;
            console.log('Rejoint la room:', currentRoom);
        } else {
            alert(response.message);
            if (response.message === 'Salle complète') {
                window.location.href = '/';
            }
        }
    });
}

socket.on('room-update', (data) => {
    updatePlayersList(data.players);
    
    if (data.players.length === 2) {
        lobbyScreen.classList.remove('active');
        gameSelectScreen.classList.add('active');
    }
    
    if (data.currentGame) {
        gameSelectScreen.classList.remove('active');
        startGame(data.currentGame);
    }
});

function updatePlayersList(players) {
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        if (player.id === currentPlayer?.id) {
            li.style.fontWeight = 'bold';
            li.style.color = '#764ba2';
        }
        playersList.appendChild(li);
    });
}

function selectGame(gameType) {
    socket.emit('select-game', currentRoom, gameType);
}

socket.on('game-selected', (gameType) => {
    startGame(gameType);
});

function startGame(gameType) {
    currentGame = gameType;
    gameSelectScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    gameContainer.innerHTML = '';
    
    switch(gameType) {
        case 'war':
            gameInstance = new WarGame(gameContainer, socket, currentRoom, currentPlayer);
            break;
        case 'maze':
            gameInstance = new MazeGame(gameContainer, socket, currentRoom, currentPlayer);
            break;
        case 'crossword':
            gameInstance = new CrosswordGame(gameContainer, socket, currentRoom, currentPlayer);
            break;
        case 'tournament':
            startTournament();
            break;
    }
    
    socket.emit('start-game', currentRoom);
}

socket.on('game-update', (gameData) => {
    if (gameInstance && gameInstance.update) {
        gameInstance.update(gameData);
    }
});

socket.on('score-update', (players) => {
    if (players.length >= 2) {
        player1Score.textContent = `${players[0].name}: ${players[0].score}`;
        player2Score.textContent = `${players[1].name}: ${players[1].score}`;
    }
});

socket.on('game-over', (winner) => {
    gameScreen.classList.remove('active');
    gameOverScreen.classList.add('active');
    
    const winnerAnnouncement = document.getElementById('winner-announcement');
    winnerAnnouncement.textContent = winner ? `${winner} a gagné!` : 'Match nul!';
    
    const finalScores = document.getElementById('final-scores');
    finalScores.innerHTML = `
        <p>${player1Score.textContent}</p>
        <p>${player2Score.textContent}</p>
    `;
});

function leaveGame() {
    if (gameInstance && gameInstance.destroy) {
        gameInstance.destroy();
    }
    gameScreen.classList.remove('active');
    lobbyScreen.classList.add('active');
}

function backToLobby() {
    gameOverScreen.classList.remove('active');
    lobbyScreen.classList.add('active');
}

function startTournament() {
    const tournamentGames = ['war', 'maze', 'crossword'];
    let currentGameIndex = 0;
    let scores = { player1: 0, player2: 0 };
    
    function playNextGame() {
        if (currentGameIndex < tournamentGames.length) {
            startGame(tournamentGames[currentGameIndex]);
            currentGameIndex++;
        } else {
            const winner = scores.player1 > scores.player2 ? 'Joueur 1' : 'Joueur 2';
            socket.emit('game-over', currentRoom, winner);
        }
    }
    
    socket.on('game-over', (winner) => {
        if (winner === 'Joueur 1') scores.player1 += 10;
        else if (winner === 'Joueur 2') scores.player2 += 10;
        
        playNextGame();
    });
    
    playNextGame();
}

let timerInterval;
socket.on('game-started', () => {
    const startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
});

socket.on('game-over', () => {
    clearInterval(timerInterval);
});