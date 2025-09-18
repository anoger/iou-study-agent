// Interface Opérateur - Logique de contrôle
class OperatorController {
    constructor() {
        this.state = {
            condition: 'human',
            currentState: 'idle',
            fadeSpeed: 500,
            volume: 0.8,
            isPlaying: false
        };

        this.logs = [];
        this.maxLogs = 100;
        
        this.init();
    }

    async init() {
        // Récupérer l'état initial
        try {
            this.state = await window.electronAPI.getState();
            this.updateUI();
        } catch (error) {
            this.addLog('error', 'Erreur de connexion au processus principal');
        }

        // Initialiser les listeners
        this.setupEventListeners();
        this.setupIPCListeners();
        
        // Démarrer l'horloge
        this.startClock();
        
        // Précharger les médias critiques
        this.preloadCriticalMedia();
        
        this.addLog('info', 'Interface opérateur initialisée');
    }

    setupEventListeners() {
        // Changement de condition
        document.getElementById('conditionHuman').addEventListener('click', () => {
            this.changeCondition('human');
        });

        document.getElementById('conditionAbstract').addEventListener('click', () => {
            this.changeCondition('abstract');
        });

        // Sliders
        const fadeSpeedSlider = document.getElementById('fadeSpeed');
        fadeSpeedSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('fadeSpeedValue').textContent = `${value}ms`;
            this.setFadeSpeed(value);
        });

        const volumeSlider = document.getElementById('volume');
        volumeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('volumeValue').textContent = `${value}%`;
            this.setVolume(value / 100);
        });

        // Boutons d'état
        document.getElementById('stateWelcome').addEventListener('click', () => {
            this.playMedia('welcome');
        });

        document.getElementById('stateIdle').addEventListener('click', () => {
            this.playMedia('idle');
        });

        document.getElementById('stateClosing').addEventListener('click', () => {
            this.playMedia('closing');
        });

        // Questions
        document.querySelectorAll('.question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.dataset.question;
                this.playMedia(question);
            });
        });

        // Bouton STOP
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopMedia();
        });
        
        // Bouton Reset
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToIdle();
        });
        
        // Préchargement
        document.getElementById('preloadBtn').addEventListener('click', () => {
            this.preloadAllMedia();
        });

        // Logs
        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('exportLogsBtn').addEventListener('click', () => {
            this.exportLogs();
        });
    }

    setupIPCListeners() {
        // Mise à jour d'état
        window.electronAPI.onStateUpdate((state) => {
            this.state = state;
            this.updateUI();
        });

        // Fin de média
        window.electronAPI.onMediaEnded((mediaId) => {
            this.addLog('info', `Média terminé: ${mediaId}`);
            this.updatePlayingState(null);
        });

        // Erreur média
        window.electronAPI.onMediaError((error) => {
            this.addLog('error', `Erreur média: ${error.message || error}`);
        });
    }

    async changeCondition(condition) {
        if (this.state.isPlaying) {
            this.addLog('warning', 'Arrêt du média en cours avant changement de condition');
            await this.stopMedia();
        }

        try {
            const result = await window.electronAPI.changeCondition(condition);
            if (result.success) {
                this.addLog('success', `Condition changée: ${condition === 'human' ? 'Humain' : 'Abstrait'}`);
                
                // Mise à jour UI
                document.querySelectorAll('.condition-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.getElementById(condition === 'human' ? 'conditionHuman' : 'conditionAbstract').classList.add('active');
                
                // Log pour l'expérience
                await window.electronAPI.writeLog({
                    action: 'condition_change',
                    condition: condition,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            this.addLog('error', `Erreur changement condition: ${error.message}`);
        }
    }

    async playMedia(mediaId) {
        if (this.state.isPlaying) {
            this.addLog('warning', 'Un média est déjà en cours de lecture');
            return;
        }

        try {
            const result = await window.electronAPI.playMedia(mediaId);
            if (result.success) {
                this.addLog('success', `Lecture: ${this.getMediaLabel(mediaId)}`);
                this.state.isPlaying = true;
                this.state.currentState = mediaId;
                this.updatePlayingState(mediaId);
                
                // Log pour l'expérience
                await window.electronAPI.writeLog({
                    action: 'play_media',
                    mediaId: mediaId,
                    condition: this.state.condition,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            this.addLog('error', `Erreur lecture: ${error.message}`);
        }
    }

    async stopMedia() {
        try {
            const result = await window.electronAPI.stopMedia();
            if (result.success) {
                this.addLog('info', 'Arrêt du média');
                this.state.isPlaying = false;
                this.state.currentState = 'idle';
                this.updatePlayingState(null);
                
                // Log pour l'expérience
                await window.electronAPI.writeLog({
                    action: 'stop_media',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            this.addLog('error', `Erreur arrêt: ${error.message}`);
        }
    }
    
    async resetToIdle() {
        this.addLog('info', 'Réinitialisation vers Idle...');
        
        // Arrêter d'abord tout média en cours
        await this.stopMedia();
        
        // Attendre un peu
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Relancer l'idle
        await this.playMedia('idle');
        
        this.addLog('success', 'Réinitialisation réussie');
    }

    async setFadeSpeed(speed) {
        try {
            const result = await window.electronAPI.setFadeSpeed(speed);
            if (result.success) {
                this.state.fadeSpeed = result.fadeSpeed;
                this.addLog('info', `Vitesse de fondu: ${result.fadeSpeed}ms`);
            }
        } catch (error) {
            this.addLog('error', `Erreur réglage fondu: ${error.message}`);
        }
    }

    async setVolume(volume) {
        try {
            const result = await window.electronAPI.setVolume(volume);
            if (result.success) {
                this.state.volume = result.volume;
                this.addLog('info', `Volume: ${Math.round(result.volume * 100)}%`);
            }
        } catch (error) {
            this.addLog('error', `Erreur réglage volume: ${error.message}`);
        }
    }

    async preloadCriticalMedia() {
        const criticalMedia = ['idle', 'welcome', 'closing'];
        try {
            const result = await window.electronAPI.preloadMedia(criticalMedia);
            if (result.success) {
                this.addLog('success', `Médias critiques préchargés: ${result.preloaded.join(', ')}`);
            }
        } catch (error) {
            this.addLog('error', `Erreur préchargement: ${error.message}`);
        }
    }

    async preloadAllMedia() {
        const allMedia = ['idle', 'welcome', 'closing', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
        try {
            this.addLog('info', 'Préchargement de tous les médias...');
            const result = await window.electronAPI.preloadMedia(allMedia);
            if (result.success) {
                this.addLog('success', `Tous les médias préchargés (${result.preloaded.length} fichiers)`);
            }
        } catch (error) {
            this.addLog('error', `Erreur préchargement: ${error.message}`);
        }
    }

    updateUI() {
        // Mise à jour des statuts
        document.getElementById('currentCondition').textContent = 
            this.state.condition === 'human' ? 'Humain' : 'Abstrait';
        
        document.getElementById('currentState').textContent = 
            this.getMediaLabel(this.state.currentState);
        
        document.getElementById('playStatus').textContent = 
            this.state.isPlaying ? '▶️ Lecture' : '⏸️ Arrêté';

        // Mise à jour des contrôles
        document.getElementById('fadeSpeed').value = this.state.fadeSpeed;
        document.getElementById('fadeSpeedValue').textContent = `${this.state.fadeSpeed}ms`;
        
        document.getElementById('volume').value = this.state.volume * 100;
        document.getElementById('volumeValue').textContent = `${Math.round(this.state.volume * 100)}%`;

        // Mise à jour des boutons de condition
        document.querySelectorAll('.condition-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeCondBtn = this.state.condition === 'human' ? 'conditionHuman' : 'conditionAbstract';
        document.getElementById(activeCondBtn).classList.add('active');
    }

    updatePlayingState(mediaId) {
        // Retirer tous les états playing
        document.querySelectorAll('.question-btn, .state-btn').forEach(btn => {
            btn.classList.remove('playing', 'active');
        });

        // Ajouter l'état playing au bouton actif
        if (mediaId) {
            if (mediaId.startsWith('q')) {
                const btn = document.querySelector(`[data-question="${mediaId}"]`);
                if (btn) btn.classList.add('playing');
            } else {
                const stateBtn = document.getElementById(`state${mediaId.charAt(0).toUpperCase() + mediaId.slice(1)}`);
                if (stateBtn) stateBtn.classList.add('active');
            }
        }

        // Mise à jour du statut
        document.getElementById('playStatus').textContent = 
            mediaId ? '▶️ Lecture' : '⏸️ Arrêté';
    }

    getMediaLabel(mediaId) {
        const labels = {
            'idle': 'Idle',
            'welcome': 'Welcome',
            'closing': 'Closing',
            'q1': 'Q1 - Transport',
            'q2': 'Q2 - Organisation',
            'q3': 'Q3 - Techniques',
            'q4': 'Q4 - Durée',
            'q5': 'Q5 - Ouvriers',
            'q6': 'Q6 - Mystères'
        };
        return labels[mediaId] || mediaId;
    }

    addLog(type, message) {
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        const logEntry = {
            type,
            message,
            timestamp
        };

        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        this.renderLog(logEntry);
    }

    renderLog(logEntry) {
        const container = document.getElementById('logsContainer');
        const entry = document.createElement('div');
        entry.className = `log-entry ${logEntry.type} fade-in`;
        entry.innerHTML = `
            <span class="log-time">${logEntry.timestamp}</span>
            ${logEntry.message}
        `;
        container.appendChild(entry);
        
        // Scroll vers le bas
        container.scrollTop = container.scrollHeight;

        // Limiter le nombre d'entrées affichées
        while (container.children.length > this.maxLogs) {
            container.removeChild(container.firstChild);
        }
    }

    clearLogs() {
        this.logs = [];
        document.getElementById('logsContainer').innerHTML = '';
        this.addLog('info', 'Logs effacés');
    }

    exportLogs() {
        const logText = this.logs.map(log => {
            return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`;
        }).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.addLog('success', 'Logs exportés');
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const time = now.toLocaleTimeString('fr-FR');
            document.getElementById('clock').textContent = time;
        };

        updateClock();
        setInterval(updateClock, 1000);
    }
}

// Démarrage de l'application
let controller;

document.addEventListener('DOMContentLoaded', () => {
    controller = new OperatorController();
});

// Nettoyage avant fermeture
window.addEventListener('beforeunload', () => {
    if (window.electronAPI && window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners();
    }
});
