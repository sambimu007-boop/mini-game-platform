class TournamentManager {
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io;
        this.games = ['war', 'maze', 'crossword'];
        this.currentGameIndex = 0;
        this.scores = {
            player1: 0,
            player2: 0
        };
        this.playerNames = {};
        this.isActive = false;
    }

    startTournament(players) {
        this.isActive = true;
        this.playerNames = {
            player1: players[0]?.name || 'Joueur 1',
            player2: players[1]?.name || 'Joueur 2'
        };
        
        this.io.to(this.roomId).emit('tournament:started', {
            games: this.games,
            players: this.playerNames
        });

        this.startNextGame();
    }

    startNextGame() {
        if (this.currentGameIndex < this.games.length) {
            const game = this.games[this.currentGameIndex];
            this.io.to(this.roomId).emit('tournament:next-game', {
                game,
                gameNumber: this.currentGameIndex + 1,
                totalGames: this.games.length,
                scores: this.scores
            });
        } else {
            this.endTournament();
        }
    }

    onGameEnd(winner, scores) {
        if (winner === 'player1') {
            this.scores.player1 += 100;
        } else if (winner === 'player2') {
            this.scores.player2 += 100;
        }

        if (scores) {
            this.scores.player1 += scores.player1 || 0;
            this.scores.player2 += scores.player2 || 0;
        }

        this.currentGameIndex++;
        
        this.io.to(this.roomId).emit('tournament:scores-update', this.scores);

        setTimeout(() => {
            this.startNextGame();
        }, 3000);
    }

    endTournament() {
        const winner = this.scores.player1 > this.scores.player2 ? 'player1' : 
                      this.scores.player2 > this.scores.player1 ? 'player2' : 'draw';

        this.io.to(this.roomId).emit('tournament:ended', {
            winner,
            scores: this.scores,
            playerNames: this.playerNames
        });

        this.isActive = false;
    }

    getCurrentGame() {
        return this.currentGameIndex < this.games.length ? 
               this.games[this.currentGameIndex] : null;
    }
}

module.exports = TournamentManager;