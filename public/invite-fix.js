/**
 * FICHIER ADDITIONNEL #2 — public/invite-fix.js
 * 
 * Script client à ajouter dans index.html (AVANT main.js) :
 *   <script src="/invite-fix.js"></script>
 * 
 * Ce script corrige le lien d'invitation affiché dans le lobby.
 * 
 * PROBLÈME ORIGINAL :
 *   Le lobby affiche window.location.href comme lien d'invitation,
 *   ce qui donne l'URL de la page principale (/) — pas un lien de room.
 *   Les deux joueurs arrivent donc au même endroit sans être reconnus
 *   comme appartenant à la même room.
 * 
 * SOLUTION :
 *   On interroge l'API /api/my-invite-link qui retourne le vrai lien
 *   de room de l'utilisateur connecté (basé sur son champ `room` en base).
 *   Ce lien est de la forme : https://votre-site.com/room/room_XXXXXX
 *   C'est CE lien qu'il faut envoyer au second joueur.
 * 
 * COMMENT ÇA MARCHE :
 *   - Joueur A s'inscrit → sa room est room_ABC → son lien d'invitation = /room/room_ABC
 *   - Joueur A envoie ce lien au Joueur B
 *   - Joueur B clique sur le lien → il arrive sur /room/room_ABC
 *   - Le serveur lit le cookie de session de B et... 
 *     ATTEND : le serveur utilise socket.userRoom = socket.user.room (la room de B, pas de A)
 *     Donc B rejoindrait SA propre room, pas celle de A.
 * 
 *   C'est pourquoi ce fichier inclut AUSSI la route serveur (invite-route.js)
 *   qui permet de rejoindre la room d'un autre joueur via un token d'invitation.
 */

(function() {
    'use strict';

    // On attend que le DOM soit prêt
    document.addEventListener('DOMContentLoaded', async () => {
        await fixInviteLink();
    });

    async function fixInviteLink() {
        const roomLinkInput = document.getElementById('room-link');
        if (!roomLinkInput) return;

        try {
            const response = await fetch('/api/my-invite-link');
            const data = await response.json();

            if (data.success && data.inviteLink) {
                roomLinkInput.value = data.inviteLink;
                console.log('[InviteFix] Lien d\'invitation corrigé :', data.inviteLink);

                // On réécrit aussi la fonction copyRoomLink pour copier le bon lien
                window.copyRoomLink = function() {
                    roomLinkInput.select();
                    document.execCommand('copy');
                    
                    // Feedback visuel
                    const btn = roomLinkInput.nextElementSibling;
                    if (btn) {
                        const original = btn.textContent;
                        btn.textContent = '✅ Copié !';
                        setTimeout(() => { btn.textContent = original; }, 2000);
                    }
                };
            }
        } catch (err) {
            console.warn('[InviteFix] Impossible de récupérer le lien d\'invitation :', err);
        }
    }
})();
