const audioManager = require('./audio-manager');

class AudioSignaling {
    constructor(io) {
        this.io = io;
        this.setupSignalHandlers();
    }

    setupSignalHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔊 Connexion audio:', socket.id);

            socket.on('audio:join', ({ roomId, username }) => {
                try {
                    const participant = audioManager.addParticipant(roomId, socket.id, username);
                    
                    if (participant) {
                        socket.join(`audio:${roomId}`);
                        
                        socket.to(`audio:${roomId}`).emit('audio:participant-joined', {
                            socketId: socket.id,
                            username
                        });

                        const participants = audioManager.getParticipants(roomId);
                        socket.emit('audio:participants', participants);

                        console.log(`👤 ${username} a rejoint l'appel audio dans ${roomId}`);
                    }
                } catch (error) {
                    console.error('Erreur audio:join:', error);
                }
            });

            socket.on('audio:leave', ({ roomId }) => {
                audioManager.removeParticipant(roomId, socket.id);
                socket.to(`audio:${roomId}`).emit('audio:participant-left', socket.id);
                socket.leave(`audio:${roomId}`);
            });

            socket.on('audio:signal', ({ to, signal }) => {
                this.io.to(to).emit('audio:signal', {
                    from: socket.id,
                    signal
                });
            });

            socket.on('audio:ready', ({ roomId }) => {
                socket.to(`audio:${roomId}`).emit('audio:peer-ready', socket.id);
            });

            socket.on('disconnect', () => {
                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
                    if (room.startsWith('audio:')) {
                        const roomId = room.replace('audio:', '');
                        audioManager.removeParticipant(roomId, socket.id);
                    }
                });
            });
        });
    }

    startAudioCall(roomId) {
        const participants = audioManager.getParticipants(roomId);
        if (participants.length === 2) {
            this.io.to(`audio:${roomId}`).emit('audio:call-started');
            return true;
        }
        return false;
    }

    stopAudioCall(roomId) {
        audioManager.cleanupRoom(roomId);
        this.io.to(`audio:${roomId}`).emit('audio:call-ended');
    }

    isCallActive(roomId) {
        return audioManager.isAudioActive(roomId);
    }
}

module.exports = AudioSignaling;