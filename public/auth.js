class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        await this.checkSession();
        this.setupLogoutButton();
    }

    async checkSession() {
        try {
            const response = await fetch('/api/check-session');
            const data = await response.json();
            
            if (data.authenticated) {
                this.user = data.user;
                this.displayUserInfo();
            } else {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Erreur vérification session:', error);
            window.location.href = '/login.html';
        }
    }

    displayUserInfo() {
        if (this.user) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `👤 ${this.user.username} | Room: ${this.user.room}`;
            document.body.appendChild(userInfo);
        }
    }

    setupLogoutButton() {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'auth-button-logout';
        logoutBtn.innerHTML = '🚪 Se déconnecter';
        logoutBtn.onclick = () => this.logout();
        document.body.appendChild(logoutBtn);
    }

    async logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Erreur déconnexion:', error);
        }
    }

    getRoom() {
        return this.user ? this.user.room : null;
    }
}

const authManager = new AuthManager();