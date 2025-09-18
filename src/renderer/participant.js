// Vue Participant - Gestion des médias et animations
class ParticipantView {
    constructor() {
        this.condition = 'human';
        this.currentMedia = null;
        this.fadeSpeed = 500;
        this.volume = 0.8;
        
        // Double buffering pour les vidéos
        this.activePlayer = 1;
        this.videoPlayer1 = null;
        this.videoPlayer2 = null;
        this.nextVideoQueue = null;
        
        // Audio et Canvas pour condition abstraite
        this.audioPlayer = null;
        this.audioContext = null;
        this.analyser = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.animationId = null;
        
        // Cache des médias préchargés
        this.mediaCache = new Map();
        this.preloadPromises = new Map();
        
        // État
        this.isTransitioning = false;
        this.isIdleLooping = false;
        this.returningToIdle = false; // Flag pour savoir si on retourne à l'idle après un autre média
        
        // Protection contre les boucles infinies
        this.errorCount = 0;
        this.lastErrorTime = 0;
        this.maxErrorRetries = 3;
        this.errorCooldown = 5000; // 5 secondes entre les tentatives
        
        // Chemin des assets
        this.assetsPath = null;
        
        this.init();
    }

    async init() {
        // Références aux éléments DOM
        this.videoPlayer1 = document.getElementById('videoPlayer1');
        this.videoPlayer2 = document.getElementById('videoPlayer2');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.canvas = document.getElementById('audioCanvas');
        this.canvasCtx = this.canvas.getContext('2d');
        
        // Configuration initiale
        this.setupVideoPlayers();
        this.setupAudioContext();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupIPCListeners();
        
        // Précharger l'idle immédiatement
        console.log('[INIT] Préchargement de idle...');
        await this.preloadMedia(['idle']);
        
        // Démarrer en idle
        console.log('[INIT] Démarrage en idle...');
        setTimeout(() => {
            this.playMedia({ mediaId: 'idle', loop: true });
        }, 500); // Augmenté le délai pour laisser le temps à l'app de s'initialiser
    }

    setupVideoPlayers() {
        // Configuration pour les deux lecteurs vidéo
        [this.videoPlayer1, this.videoPlayer2].forEach((player, index) => {
            player.volume = this.volume;
            player.muted = false;
            player.setAttribute('data-player-id', index + 1);
            
            // Événements
            player.addEventListener('ended', (e) => {
                // Vérifier que c'est bien le lecteur actif qui a terminé
                // ET qu'on n'est pas en transition
                // ET que le média n'est pas null (évite les faux positifs)
                if (player === this.getActivePlayer() && 
                    player.classList.contains('active') && 
                    !this.isTransitioning &&
                    this.currentMedia) {
                    console.log(`[VIDEO ENDED] Player ${index + 1} (actif) - Média: ${this.currentMedia}`);
                    this.handleMediaEnded();
                } else {
                    console.log(`[VIDEO ENDED] Player ${index + 1} - Ignoré (transition: ${this.isTransitioning}, actif: ${player.classList.contains('active')}, média: ${this.currentMedia})`);
                }
            });
            
            player.addEventListener('error', (e) => {
                // Ne traiter que les erreurs du lecteur actif ou lors du chargement
                const error = player.error;
                let errorMsg = 'Erreur vidéo inconnue';
                
                if (error) {
                    switch(error.code) {
                        case 1:
                            errorMsg = 'Lecture interrompue par l\'utilisateur';
                            break;
                        case 2:
                            errorMsg = 'Erreur réseau lors du chargement';
                            break;
                        case 3:
                            errorMsg = 'Erreur de décodage ou codec non supporté';
                            break;
                        case 4:
                            errorMsg = `Fichier introuvable ou format non supporté`;
                            break;
                        default:
                            errorMsg = `Erreur inconnue (code ${error.code})`;
                    }
                }
                
                console.error(`[VIDEO ERROR] Player ${index + 1}:`, errorMsg);
                console.error('Source:', player.src || 'Pas de source');
                console.error('Ready State:', player.readyState, 'Network State:', player.networkState);
                
                // Ne notifier que si c'est le lecteur actif
                if (player === this.getActivePlayer()) {
                    this.handleMediaError(`Vidéo: ${errorMsg}`);
                }
            });
            
            player.addEventListener('loadeddata', () => {
                this.hideLoading();
            });
            
            player.addEventListener('waiting', () => {
                if (player === this.getActivePlayer()) {
                    this.showLoading();
                }
            });
            
            player.addEventListener('canplaythrough', () => {
                if (player === this.getActivePlayer()) {
                    this.hideLoading();
                }
            });
        });
    }

    setupAudioContext() {
        // Initialisation différée du contexte audio (nécessite interaction utilisateur sur Chrome)
        const initAudio = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                this.analyser.smoothingTimeConstant = 0.8;
                
                // Connecter l'audio au analyseur
                const source = this.audioContext.createMediaElementSource(this.audioPlayer);
                source.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
            }
            
            // Débloquer le contexte audio si nécessaire
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        };

        // Essayer d'initialiser au premier clic/interaction
        document.addEventListener('click', initAudio, { once: true });
        document.addEventListener('keydown', initAudio, { once: true });
        
        // Configuration du lecteur audio
        this.audioPlayer.volume = this.volume;
        
        this.audioPlayer.addEventListener('ended', () => {
            this.handleMediaEnded();
        });
        
        this.audioPlayer.addEventListener('error', (e) => {
            this.handleMediaError(`Erreur audio: ${e.message || 'Inconnue'}`);
        });
        
        this.audioPlayer.addEventListener('play', () => {
            this.startAudioVisualization();
        });
        
        this.audioPlayer.addEventListener('pause', () => {
            this.stopAudioVisualization();
        });
    }

    setupCanvas() {
        // Redimensionner le canvas
        const resizeCanvas = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Style du canvas
        this.canvasCtx.fillStyle = '#000000';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setupEventListeners() {
        // Fermeture du message d'erreur
        document.getElementById('errorClose').addEventListener('click', () => {
            this.hideError();
        });
        
        // Gestion du focus pour éviter les problèmes d'autoplay
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentMedia === 'idle' && this.condition === 'human') {
                const player = this.getActivePlayer();
                if (player.paused) {
                    player.play().catch(() => {});
                }
            }
        });
    }

    setupIPCListeners() {
        // Commande de lecture
        window.electronAPI.onPlayMedia((data) => {
            this.playMedia(data);
        });
        
        // Arrêt
        window.electronAPI.onStopMedia(() => {
            this.stopMedia();
        });
        
        // Préchargement
        window.electronAPI.onPreloadMedia((mediaIds) => {
            this.preloadMedia(mediaIds);
        });
        
        // Changement de condition
        window.electronAPI.onConditionChange((condition) => {
            this.changeCondition(condition);
        });
        
        // Changement de vitesse de fondu
        window.electronAPI.onFadeSpeedChange((speed) => {
            this.fadeSpeed = speed;
        });
        
        // Changement de volume
        window.electronAPI.onVolumeChange((volume) => {
            this.setVolume(volume);
        });
    }

    // === Gestion des médias ===
    
    async playMedia(data) {
        const { mediaId, loop = false } = data;
        
        console.log(`[PLAY MEDIA] Demande de lecture: ${mediaId}, loop: ${loop}`);
        
        // Vérifier si on n'est pas déjà en train de jouer le même média
        if (this.currentMedia === mediaId && this.isIdleLooping && mediaId === 'idle') {
            console.log('[PLAY MEDIA] Idle déjà en cours, ignoré');
            return;
        }
        
        if (this.isTransitioning) {
            // Mettre en queue si transition en cours
            console.log('[PLAY MEDIA] Transition en cours, mise en queue');
            this.nextVideoQueue = data;
            return;
        }
        
        this.currentMedia = mediaId;
        this.isIdleLooping = loop && mediaId === 'idle';
        
        if (this.condition === 'human') {
            await this.playVideo(mediaId, loop);
        } else {
            await this.playAudio(mediaId, loop);
        }
    }

    async playVideo(mediaId, loop) {
        console.log(`[PLAY VIDEO] Début lecture ${mediaId}, loop: ${loop}, returningToIdle: ${this.returningToIdle}`);
        const videoPath = this.getMediaPath(mediaId, 'video');
        
        if (!videoPath) {
            this.handleMediaError(`Impossible de construire le chemin pour ${mediaId}`);
            return;
        }
        
        // Réutilisation UNIQUEMENT pour l'idle et UNIQUEMENT lors du retour après un autre média
        if (mediaId === 'idle' && this.returningToIdle) {
            // On revient à l'idle après un autre média
            const player1HasIdle = this.videoPlayer1.src.includes('idle.mp4');
            const player2HasIdle = this.videoPlayer2.src.includes('idle.mp4');
            
            console.log(`[PLAY VIDEO] Recherche idle - Player1: ${player1HasIdle}, Player2: ${player2HasIdle}`);
            
            if (player1HasIdle && !this.videoPlayer1.classList.contains('active')) {
                console.log('[PLAY VIDEO] Retour à idle - réutilisation player1');
                await this.transitionVideos(this.getActivePlayer(), this.videoPlayer1);
                this.activePlayer = 1;
                this.videoPlayer1.loop = true;
                this.videoPlayer1.currentTime = 0;
                try {
                    await this.videoPlayer1.play();
                    this.errorCount = 0;
                    this.isIdleLooping = true;
                    this.returningToIdle = false; // Réinitialiser le flag
                } catch (error) {
                    console.error('[PLAY VIDEO] Erreur lecture idle:', error);
                }
                return;
            } else if (player2HasIdle && !this.videoPlayer2.classList.contains('active')) {
                console.log('[PLAY VIDEO] Retour à idle - réutilisation player2');
                await this.transitionVideos(this.getActivePlayer(), this.videoPlayer2);
                this.activePlayer = 2;
                this.videoPlayer2.loop = true;
                this.videoPlayer2.currentTime = 0;
                try {
                    await this.videoPlayer2.play();
                    this.errorCount = 0;
                    this.isIdleLooping = true;
                    this.returningToIdle = false; // Réinitialiser le flag
                } catch (error) {
                    console.error('[PLAY VIDEO] Erreur lecture idle:', error);
                }
                return;
            }
        }
        
        // Réinitialiser le flag si ce n'est pas un retour à l'idle
        this.returningToIdle = false;
        
        // Pour toute nouvelle lecture (idle initial ou autres médias)
        const nextPlayer = this.getInactivePlayer();
        const currentPlayer = this.getActivePlayer();
        
        console.log(`[PLAY VIDEO] Nouvelle lecture de ${mediaId} sur player ${this.activePlayer === 1 ? 2 : 1}`);
        
        // S'assurer que le prochain lecteur est bien nettoyé
        nextPlayer.pause();
        nextPlayer.currentTime = 0;
        
        // Préparer le prochain lecteur
        nextPlayer.src = videoPath;
        nextPlayer.loop = loop;
        nextPlayer.load();
        
        // Attendre que la vidéo soit prête
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error(`[TIMEOUT] Chargement de ${mediaId} : ${videoPath}`);
                reject(new Error(`Timeout après 10s: Vérifiez que le fichier existe`));
            }, 10000);
            
            const handleCanPlay = () => {
                clearTimeout(timeout);
                console.log(`[READY] Vidéo ${mediaId} prête à être lue`);
                resolve();
            };
            
            const handleError = (e) => {
                clearTimeout(timeout);
                const error = nextPlayer.error;
                let errorDetail = 'Erreur inconnue';
                
                if (error) {
                    switch(error.code) {
                        case 1: errorDetail = 'Chargement interrompu'; break;
                        case 2: errorDetail = 'Erreur réseau'; break;
                        case 3: errorDetail = 'Décodage impossible'; break;
                        case 4: errorDetail = 'Format non supporté ou fichier introuvable'; break;
                    }
                }
                
                console.error(`[LOAD ERROR] ${mediaId}: ${errorDetail}`);
                console.error(`Chemin tenté: ${videoPath}`);
                reject(new Error(`${errorDetail} - Vérifiez ${videoPath}`));
            };
            
            nextPlayer.addEventListener('canplaythrough', handleCanPlay, { once: true });
            nextPlayer.addEventListener('error', handleError, { once: true });
        }).catch((error) => {
            this.handleMediaError(`${mediaId}: ${error.message}`);
            return;
        });
        
        // Effectuer la transition
        await this.transitionVideos(currentPlayer, nextPlayer);
        
        // Basculer l'indicateur de lecteur actif
        this.activePlayer = this.activePlayer === 1 ? 2 : 1;
        
        // Lancer la lecture
        try {
            await nextPlayer.play();
            // Réinitialiser le compteur d'erreurs après un succès
            this.errorCount = 0;
            console.log(`[SUCCESS] Lecture de ${mediaId} démarrée`);
        } catch (error) {
            console.error('Erreur lecture:', error);
            // Réessayer sans son si échec (politique autoplay)
            nextPlayer.muted = true;
            await nextPlayer.play();
            nextPlayer.muted = false;
            // Réinitialiser le compteur après succès
            this.errorCount = 0;
            console.log(`[SUCCESS] Lecture de ${mediaId} démarrée (muet puis son réactivé)`);
        }
        
        // Traiter la queue si elle existe
        if (this.nextVideoQueue) {
            const next = this.nextVideoQueue;
            this.nextVideoQueue = null;
            setTimeout(() => this.playMedia(next), 50);
        }
    }

    async transitionVideos(fromPlayer, toPlayer) {
        if (this.fadeSpeed === 0) {
            // Transition instantanée
            fromPlayer.classList.remove('active');
            toPlayer.classList.add('active');
            fromPlayer.pause();
            fromPlayer.currentTime = 0; // Réinitialiser la position
            return;
        }
        
        this.isTransitioning = true;
        
        // Arrêter complètement l'ancien lecteur AVANT la transition
        fromPlayer.pause();
        
        // Préparer les styles de transition
        fromPlayer.style.transition = `opacity ${this.fadeSpeed}ms ease-in-out`;
        toPlayer.style.transition = `opacity ${this.fadeSpeed}ms ease-in-out`;
        
        // Positionner le nouveau lecteur derrière
        toPlayer.style.opacity = '0';
        toPlayer.classList.add('active');
        
        // Déclencher la transition
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                toPlayer.style.opacity = '1';
                fromPlayer.style.opacity = '0';
                
                setTimeout(() => {
                    fromPlayer.classList.remove('active');
                    
                    // Réinitialiser la position de l'ancien lecteur
                    fromPlayer.currentTime = 0;
                    
                    // Ne vider le src que si ce n'est pas l'idle
                    if (!fromPlayer.src.includes('idle.mp4')) {
                        fromPlayer.src = '';
                        fromPlayer.load(); // Force le nettoyage
                    }
                    
                    // Réinitialiser les styles
                    fromPlayer.style.opacity = '';
                    toPlayer.style.opacity = '';
                    
                    this.isTransitioning = false;
                    resolve();
                }, this.fadeSpeed);
            });
        });
    }

    async playAudio(mediaId, loop) {
        const audioPath = this.getMediaPath(mediaId, 'audio');
        
        // Masquer l'animation idle
        document.getElementById('abstractIdle').classList.add('audio-playing');
        
        // Charger et jouer l'audio
        this.audioPlayer.src = audioPath;
        this.audioPlayer.loop = loop;
        
        try {
            await this.audioPlayer.play();
        } catch (error) {
            this.handleMediaError(`Erreur lecture audio: ${error.message}`);
        }
    }

    stopMedia() {
        console.log('[STOP MEDIA] Arrêt des médias');
        
        if (this.condition === 'human') {
            // Arrêter les deux lecteurs vidéo
            if (this.videoPlayer1) {
                this.videoPlayer1.pause();
                // Ne vider que si ce n'est pas l'idle
                if (!this.videoPlayer1.src.includes('idle.mp4')) {
                    this.videoPlayer1.src = '';
                }
            }
            if (this.videoPlayer2) {
                this.videoPlayer2.pause();
                // Ne vider que si ce n'est pas l'idle
                if (!this.videoPlayer2.src.includes('idle.mp4')) {
                    this.videoPlayer2.src = '';
                }
            }
        } else {
            this.audioPlayer.pause();
            this.stopAudioVisualization();
            document.getElementById('abstractIdle').classList.remove('audio-playing');
        }
        
        this.currentMedia = null;
        this.isIdleLooping = false;
        this.isTransitioning = false;
        this.nextVideoQueue = null;
        
        console.log('[STOP MEDIA] Retour à l\'idle programmé');
        
        // Retour à l'idle avec un délai pour stabiliser
        setTimeout(() => {
            this.playMedia({ mediaId: 'idle', loop: true });
        }, 300);
    }

    // === Visualisation Audio ===
    
    startAudioVisualization() {
        if (!this.audioContext || !this.analyser) {
            // Initialiser si pas encore fait
            this.setupAudioContext();
            return;
        }
        
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            // Effacer le canvas
            this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Calculer l'intensité moyenne
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Dessiner le cercle central réactif
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const baseRadius = 100;
            const radius = baseRadius + (average / 255) * 100;
            
            // Gradient pour le cercle
            const gradient = this.canvasCtx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );
            gradient.addColorStop(0, `rgba(90, 103, 216, ${0.8 + (average / 255) * 0.2})`);
            gradient.addColorStop(0.5, `rgba(118, 75, 162, ${0.6 + (average / 255) * 0.4})`);
            gradient.addColorStop(1, 'rgba(90, 103, 216, 0)');
            
            this.canvasCtx.fillStyle = gradient;
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.canvasCtx.fill();
            
            // Dessiner les barres de fréquence autour
            const barCount = 64;
            const angleStep = (Math.PI * 2) / barCount;
            
            for (let i = 0; i < barCount; i++) {
                const value = dataArray[Math.floor(i * bufferLength / barCount)];
                const barHeight = (value / 255) * 150;
                const angle = i * angleStep;
                
                const x1 = centerX + Math.cos(angle) * (radius + 20);
                const y1 = centerY + Math.sin(angle) * (radius + 20);
                const x2 = centerX + Math.cos(angle) * (radius + 20 + barHeight);
                const y2 = centerY + Math.sin(angle) * (radius + 20 + barHeight);
                
                this.canvasCtx.strokeStyle = `hsla(${250 + (value / 255) * 60}, 70%, ${50 + (value / 255) * 30}%, ${0.5 + (value / 255) * 0.5})`;
                this.canvasCtx.lineWidth = 3;
                this.canvasCtx.lineCap = 'round';
                this.canvasCtx.beginPath();
                this.canvasCtx.moveTo(x1, y1);
                this.canvasCtx.lineTo(x2, y2);
                this.canvasCtx.stroke();
            }
            
            // Onde circulaire
            if (average > 50) {
                this.canvasCtx.strokeStyle = `rgba(90, 103, 216, ${(average - 50) / 205})`;
                this.canvasCtx.lineWidth = 2;
                this.canvasCtx.beginPath();
                this.canvasCtx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
                this.canvasCtx.stroke();
            }
        };
        
        draw();
    }

    stopAudioVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Effacer le canvas
        this.canvasCtx.fillStyle = '#000000';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // === Changement de condition ===
    
    async changeCondition(condition) {
        if (this.condition === condition) return;
        
        // Arrêter les médias actuels
        this.stopMedia();
        
        // Masquer la vue actuelle
        document.getElementById(this.condition === 'human' ? 'humanCondition' : 'abstractCondition')
            .classList.remove('active');
        
        // Changer la condition
        this.condition = condition;
        
        // Afficher la nouvelle vue
        document.getElementById(condition === 'human' ? 'humanCondition' : 'abstractCondition')
            .classList.add('active');
        
        // Redémarrer en idle
        setTimeout(() => {
            this.playMedia({ mediaId: 'idle', loop: true });
        }, 100);
    }

    // === Préchargement ===
    
    async preloadMedia(mediaIds) {
        const promises = mediaIds.map(async (mediaId) => {
            if (this.mediaCache.has(mediaId)) {
                return; // Déjà en cache
            }
            
            if (this.preloadPromises.has(mediaId)) {
                return this.preloadPromises.get(mediaId); // Déjà en cours
            }
            
            const promise = this.preloadSingleMedia(mediaId);
            this.preloadPromises.set(mediaId, promise);
            
            try {
                await promise;
                this.preloadPromises.delete(mediaId);
            } catch (error) {
                this.preloadPromises.delete(mediaId);
                console.error(`Erreur préchargement ${mediaId}:`, error);
            }
        });
        
        await Promise.all(promises);
    }

    async preloadSingleMedia(mediaId) {
        console.log(`[PRELOAD] Préchargement de ${mediaId}...`);
        
        if (this.condition === 'human') {
            const videoPath = this.getMediaPath(mediaId, 'video');
            const video = document.createElement('video');
            video.src = videoPath;
            video.preload = 'auto';
            
            // Essayer de charger
            const loadPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.error(`[PRELOAD] Timeout pour ${mediaId}`);
                    reject(new Error('Timeout préchargement'));
                }, 10000);
                
                video.addEventListener('canplaythrough', () => {
                    clearTimeout(timeout);
                    console.log(`[PRELOAD] ${mediaId} préchargé avec succès`);
                    resolve();
                }, { once: true });
                
                video.addEventListener('error', () => {
                    clearTimeout(timeout);
                    console.error(`[PRELOAD] Erreur pour ${mediaId}: ${video.error?.message || 'Inconnue'}`);
                    reject(new Error('Erreur préchargement'));
                }, { once: true });
            });
            
            video.load();
            
            try {
                await loadPromise;
                this.mediaCache.set(mediaId, video);
            } catch (error) {
                console.error(`[PRELOAD] Échec du préchargement de ${mediaId}:`, error);
                // Ne pas bloquer si le préchargement échoue
            }
        } else {
            const audioPath = this.getMediaPath(mediaId, 'audio');
            const audio = new Audio(audioPath);
            audio.preload = 'auto';
            
            await new Promise((resolve, reject) => {
                audio.addEventListener('canplaythrough', resolve, { once: true });
                audio.addEventListener('error', reject, { once: true });
                setTimeout(reject, 10000); // Timeout 10s
            }).catch(error => {
                console.error(`[PRELOAD] Échec audio ${mediaId}:`, error);
            });
            
            this.mediaCache.set(mediaId, audio);
        }
    }

    // === Utilitaires ===
    
    getMediaPath(mediaId, type) {
        // Utiliser un chemin relatif simple depuis le HTML
        // Les fichiers HTML sont dans src/renderer/, donc on remonte de 2 niveaux
        const extension = type === 'video' ? 'mp4' : 'WAV';
        const folder = type === 'video' ? 'videos' : 'audio';
        
        // Chemin relatif depuis src/renderer/
        const relativePath = `../../assets/${folder}/${mediaId}.${extension}`;
        
        console.log(`Media path for ${mediaId} (${type}): ${relativePath}`);
        return relativePath;
    }

    getActivePlayer() {
        return this.activePlayer === 1 ? this.videoPlayer1 : this.videoPlayer2;
    }

    getInactivePlayer() {
        return this.activePlayer === 1 ? this.videoPlayer2 : this.videoPlayer1;
    }

    setVolume(volume) {
        this.volume = volume;
        this.videoPlayer1.volume = volume;
        this.videoPlayer2.volume = volume;
        this.audioPlayer.volume = volume;
    }

    // === Gestion des événements ===
    
    handleMediaEnded() {
        console.log(`[MEDIA ENDED] ${this.currentMedia}`);
        
        if (this.isIdleLooping) {
            // Si c'est l'idle en boucle, ne pas notifier
            console.log('[MEDIA ENDED] Idle en boucle, pas de notification');
            return;
        }
        
        // Marquer qu'on termine un média non-idle
        const wasPlayingNonIdle = this.currentMedia && this.currentMedia !== 'idle';
        
        // Notifier le processus principal
        window.electronAPI.notifyMediaEnded(this.currentMedia);
        
        // Réinitialiser l'état
        const previousMedia = this.currentMedia;
        this.currentMedia = null;
        this.isTransitioning = false;
        this.nextVideoQueue = null;
        
        // Nettoyer les deux lecteurs
        if (this.videoPlayer1.src && !this.videoPlayer1.paused && !this.videoPlayer1.src.includes('idle.mp4')) {
            this.videoPlayer1.pause();
            this.videoPlayer1.currentTime = 0;
        }
        if (this.videoPlayer2.src && !this.videoPlayer2.paused && !this.videoPlayer2.src.includes('idle.mp4')) {
            this.videoPlayer2.pause();
            this.videoPlayer2.currentTime = 0;
        }
        
        console.log(`[MEDIA ENDED] Retour à l'idle après ${previousMedia}`);
        
        // Retour à l'idle avec un petit délai
        setTimeout(() => {
            // Marquer qu'on retourne à l'idle après un autre média
            this.returningToIdle = wasPlayingNonIdle;
            this.currentMedia = 'idle';
            this.playMedia({ mediaId: 'idle', loop: true });
        }, 200);
    }

    handleMediaError(error) {
        console.error('Erreur média:', error);
        
        // Protection contre les boucles infinies
        const now = Date.now();
        if (now - this.lastErrorTime < this.errorCooldown) {
            this.errorCount++;
        } else {
            this.errorCount = 1;
        }
        this.lastErrorTime = now;
        
        // Si trop d'erreurs, arrêter les tentatives
        if (this.errorCount >= this.maxErrorRetries) {
            console.error('Trop d\'erreurs consécutives, arrêt des tentatives');
            
            // Notifier le processus principal
            window.electronAPI.notifyMediaError(`Erreur critique: ${error}. Arrêt après ${this.errorCount} tentatives.`);
            
            // Afficher l'erreur permanente
            this.showError(`Erreur critique: Vérifiez les fichiers médias.\n${error}`);
            
            // Ne pas retenter automatiquement
            return;
        }
        
        // Notifier le processus principal
        window.electronAPI.notifyMediaError(error);
        
        // Afficher l'erreur temporairement
        this.showError(error);
        
        // Essayer de retourner à l'idle après un délai progressif
        const retryDelay = Math.min(3000 * this.errorCount, 10000); // Max 10 secondes
        console.log(`Nouvelle tentative dans ${retryDelay}ms (tentative ${this.errorCount}/${this.maxErrorRetries})`);
        
        setTimeout(() => {
            this.hideError();
            // Réinitialiser seulement si on n'a pas dépassé le max
            if (this.errorCount < this.maxErrorRetries) {
                this.playMedia({ mediaId: 'idle', loop: true });
            }
        }, retryDelay);
    }

    // === UI ===
    
    showLoading() {
        document.getElementById('loadingIndicator').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingIndicator').classList.remove('show');
    }

    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.add('show');
    }

    hideError() {
        document.getElementById('errorMessage').classList.remove('show');
    }
}

// === Initialisation ===

let participantView;

document.addEventListener('DOMContentLoaded', () => {
    participantView = new ParticipantView();
    
    // Mode développement
    if (window.location.search.includes('dev')) {
        document.body.classList.add('dev-mode');
        const indicator = document.createElement('div');
        indicator.className = 'dev-indicator';
        indicator.textContent = 'MODE DEV';
        document.body.appendChild(indicator);
    }
});

// Nettoyage avant fermeture
window.addEventListener('beforeunload', () => {
    if (participantView) {
        participantView.stopAudioVisualization();
        participantView.stopMedia();
    }
    
    if (window.electronAPI && window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners();
    }
});

// Gestion des erreurs non capturées
window.addEventListener('error', (event) => {
    console.error('Erreur non capturée:', event.error);
    if (participantView) {
        participantView.handleMediaError(`Erreur système: ${event.error.message}`);
    }
});
