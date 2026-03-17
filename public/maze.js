class MazeGame {
    constructor(container, socket, roomId, player) {
        this.container = container;
        this.socket = socket;
        this.roomId = roomId;
        this.player = player;
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.classList.add('maze-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        this.maze = [];
        this.cellSize = 40;
        this.playerPosition = { x: 1, y: 1 };
        this.enemyPosition = { x: 15, y: 15 };
        this.exitPosition = { x: 18, y: 18 };
        this.gameActive = true;
        
        this.keys = {};
        this.setupControls();
        
        this.generateMaze(20, 20);
        this.animate();
    }
    
    setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    generateMaze(width, height) {
        for (let y = 0; y < height; y++) {
            this.maze[y] = [];
            for (let x = 0; x < width; x++) {
                this.maze[y][x] = 1;
            }
        }
        
        function carve(x, y) {
            const directions = [
                [0, -2], [2, 0], [0, 2], [-2, 0]
            ];
            
            directions.sort(() => Math.random() - 0.5);
            
            for (let [dx, dy] of directions) {
                const nx = x + dx;
                const