class AudioClient {
    constructor(roomId, username, socket) {
        this.roomId = roomId;
        this.username = username;
        this.socket = socket;
        this.peer = null;
        this.stream = null;
        this.connected = false;
        this.peers = new Map();
        
        this.setupSocketListeners();
    }

    async setupSocketListeners() {
        this.socket.on('audio:participants', (participants) => {
            console.log('Participants dans l\'appel:', participants);
            this.initializeCall(participants);
        });

        this.socket.on('audio:participant-joined', (participant) => {
            console.log('Nouveau participant:', participant);
            this.createPeerConnection(participant.socketId, true);
        });

        this.socket.on('audio:participant-left', (socketId) => {
            console.log('Participant parti:', socketId);
            this.closePeerConnection(socketId);
        });

        this.socket.on('audio:signal', async ({ from, signal }) => {
            console.log('Signal reçu de:', from);
            
            if (!this.peers.has(from)) {
                await this.createPeerConnection(from, false);
            }
            
            const peer = this.peers.get(from);
            if (peer) {
                peer.signal(signal);
            }
        });

        this.socket.on('audio:peer-ready', (socketId) => {
            console.log('Peer prêt:', socketId);
        });

        this.socket.on('audio:call-started', () => {
            console.log('🎤 Appel démarré!');
            this.connected = true;
        });

        this.socket.on('audio:call-ended', () => {
            console.log('🔇 Appel terminé');
            this.cleanup();
        });
    }

    async initialize() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Microphone accessible');

            this.socket.emit('audio:join', {
                roomId: this.roomId,
                username: this.username
            });

            return true;
        } catch (error) {
            console.error('❌ Erreur accès microphone:', error);
            return false;
        }
    }

    async createPeerConnection(peerId, initiator) {
        const Peer = window.SimplePeer;
        
        const peer = new Peer({
            initiator,
            stream: this.stream,
            trickle: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('signal', (signal) => {
            this.socket.emit('audio:signal', {
                to: peerId,
                signal
            });
        });

        peer.on('connect', () => {
            console.log('🔊 Connexion WebRTC établie avec', peerId);
        });

        peer.on('stream', (remoteStream) => {
            console.log('📻 Flux audio reçu de', peerId);
            this.playRemoteStream(remoteStream);
        });

        peer.on('error', (err) => {
            console.error('Erreur WebRTC:', err);
        });

        peer.on('close', () => {
            console.log('Connexion fermée avec', peerId);
            this.peers.delete(peerId);
        });

        this.peers.set(peerId, peer);
        return peer;
    }

    closePeerConnection(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.destroy();
            this.peers.delete(peerId);
        }
    }

    playRemoteStream(stream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        
        if (!this.remoteAudioElements) {
            this.remoteAudioElements = [];
        }
        this.remoteAudioElements.push(audio);
    }

    initializeCall(participants) {
        participants.forEach(participant => {
            if (participant.socketId !== this.socket.id) {
                this.createPeerConnection(participant.socketId, true);
            }
        });
    }

    mute() {
        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    unmute() {
        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }

    cleanup() {
        this.peers.forEach(peer => peer.destroy());
        this.peers.clear();

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.remoteAudioElements) {
            this.remoteAudioElements.forEach(audio => {
                audio.pause();
                audio.srcObject = null;
            });
        }

        this.connected = false;
    }
}

window.SimplePeer = window.SimplePeer || SimplePeer;