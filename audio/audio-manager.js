class AudioManager {
    constructor() {
        this.rooms = new Map();
        this.peers = new Map();
    }

    createAudioSession(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                participants: [],
                active: false
            });
        }
        return this.rooms.get(roomId);
    }

    addParticipant(roomId, socketId, username) {
        const session = this.rooms.get(roomId);
        if (!session) return false;

        if (session.participants.length >= 2) {
            return false;
        }

        const participant = {
            socketId,
            username,
            joinedAt: Date.now()
        };

        session.participants.push(participant);

        if (session.participants.length === 2) {
            session.active = true;
        }

        return participant;
    }

    removeParticipant(roomId, socketId) {
        const session = this.rooms.get(roomId);
        if (!session) return false;

        session.participants = session.participants.filter(p => p.socketId !== socketId);

        if (session.participants.length < 2) {
            session.active = false;
        }

        if (session.participants.length === 0) {
            this.rooms.delete(roomId);
        }

        return true;
    }

    getParticipants(roomId) {
        const session = this.rooms.get(roomId);
        return session ? session.participants : [];
    }

    isAudioActive(roomId) {
        const session = this.rooms.get(roomId);
        return session ? session.active : false;
    }

    storePeer(peerId, peer, roomId) {
        this.peers.set(peerId, { peer, roomId });
    }

    getPeer(peerId) {
        return this.peers.get(peerId);
    }

    removePeer(peerId) {
        this.peers.delete(peerId);
    }

    cleanupRoom(roomId) {
        for (const [peerId, data] of this.peers.entries()) {
            if (data.roomId === roomId) {
                data.peer.destroy();
                this.peers.delete(peerId);
            }
        }
        
        this.rooms.delete(roomId);
    }
}

module.exports = new AudioManager();