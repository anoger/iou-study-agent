const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Configuration globale
const CONFIG = {
  DEV_MODE: process.argv.includes('--dev'),
  OPERATOR_WIDTH: 1200,
  OPERATOR_HEIGHT: 800,
  PARTICIPANT_MIN_WIDTH: 1024,
  PARTICIPANT_MIN_HEIGHT: 768,
  VIDEO_PRELOAD_COUNT: 3, // Nombre de vidéos à précharger
};

// Variables globales pour les fenêtres
let operatorWindow = null;
let participantWindow = null;

// État global de l'application
let appState = {
  condition: 'human', // 'human' ou 'abstract'
  currentState: 'idle', // 'idle', 'welcome', 'closing', 'q1', 'q2', etc.
  fadeSpeed: 500, // Durée du fondu en ms
  volume: 0.8,
  isPlaying: false,
  preloadedVideos: new Set()
};

// Création de la fenêtre opérateur
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: CONFIG.OPERATOR_WIDTH,
    height: CONFIG.OPERATOR_HEIGHT,
    title: 'Virtual Agent - Opérateur',
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload-operator.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !CONFIG.DEV_MODE
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false
  });

  operatorWindow.loadFile(path.join(__dirname, 'renderer', 'operator.html'));
  
  operatorWindow.once('ready-to-show', () => {
    operatorWindow.show();
    if (CONFIG.DEV_MODE) {
      operatorWindow.webContents.openDevTools();
    }
  });

  operatorWindow.on('closed', () => {
    operatorWindow = null;
    if (participantWindow) {
      participantWindow.close();
    }
  });
}

// Création de la fenêtre participant
function createParticipantWindow() {
  // Obtenir le deuxième écran si disponible
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const targetDisplay = externalDisplay || displays[0];
  
  participantWindow = new BrowserWindow({
    x: targetDisplay.bounds.x + 100, // Décalage pour pouvoir la déplacer
    y: targetDisplay.bounds.y + 100,
    width: Math.min(targetDisplay.bounds.width - 200, 1280), // Taille initiale raisonnable
    height: Math.min(targetDisplay.bounds.height - 200, 720), // Format 16:9
    minWidth: 640,
    minHeight: 360,
    fullscreen: false, // Démarrer en mode fenêtré
    fullscreenable: true,
    movable: true, // Permettre le déplacement
    resizable: true, // Permettre le redimensionnement
    title: 'Virtual Agent - Participant',
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload-participant.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Désactiver pour permettre le chargement des fichiers locaux
      allowRunningInsecureContent: true, // Permettre le contenu non sécurisé
      backgroundThrottling: false, // Empêche le throttling en arrière-plan
      autoplayPolicy: 'no-user-gesture-required' // Autorise l'autoplay
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
    frame: true, // Toujours afficher le cadre pour pouvoir déplacer
    skipTaskbar: false,
    backgroundColor: '#000000'
  });

  participantWindow.loadFile(path.join(__dirname, 'renderer', 'participant.html'));
  
  participantWindow.once('ready-to-show', () => {
    participantWindow.show();
    if (!CONFIG.DEV_MODE) {
      participantWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  participantWindow.on('closed', () => {
    participantWindow = null;
  });
}

// === Gestion IPC ===

// Canal de communication entre les fenêtres
ipcMain.handle('app:getState', () => {
  return appState;
});

ipcMain.handle('app:setState', (event, newState) => {
  appState = { ...appState, ...newState };
  
  // Propager les changements aux deux fenêtres
  if (operatorWindow) {
    operatorWindow.webContents.send('state:update', appState);
  }
  if (participantWindow) {
    participantWindow.webContents.send('state:update', appState);
  }
  
  return appState;
});

// Contrôle des médias
ipcMain.handle('media:play', (event, mediaId) => {
  appState.currentState = mediaId;
  appState.isPlaying = true;
  
  if (participantWindow) {
    participantWindow.webContents.send('media:play', {
      mediaId,
      condition: appState.condition,
      fadeSpeed: appState.fadeSpeed
    });
  }
  
  return { success: true };
});

ipcMain.handle('media:stop', () => {
  appState.isPlaying = false;
  appState.currentState = 'idle';
  
  if (participantWindow) {
    participantWindow.webContents.send('media:stop');
  }
  
  return { success: true };
});

// Préchargement des médias
ipcMain.handle('media:preload', (event, mediaIds) => {
  if (participantWindow) {
    participantWindow.webContents.send('media:preload', mediaIds);
  }
  
  mediaIds.forEach(id => appState.preloadedVideos.add(id));
  
  return { success: true, preloaded: Array.from(appState.preloadedVideos) };
});

// Changement de condition
ipcMain.handle('condition:change', (event, condition) => {
  if (condition !== 'human' && condition !== 'abstract') {
    return { success: false, error: 'Invalid condition' };
  }
  
  appState.condition = condition;
  appState.currentState = 'idle';
  appState.isPlaying = false;
  
  // Notifier la fenêtre participant
  if (participantWindow) {
    participantWindow.webContents.send('condition:change', condition);
  }
  
  // Notifier la fenêtre opérateur
  if (operatorWindow) {
    operatorWindow.webContents.send('state:update', appState);
  }
  
  return { success: true, condition };
});

// Changement de la vitesse de fondu
ipcMain.handle('fade:setSpeed', (event, speed) => {
  const validSpeed = Math.max(100, Math.min(2000, speed)); // Entre 100ms et 2s
  appState.fadeSpeed = validSpeed;
  
  if (participantWindow) {
    participantWindow.webContents.send('fade:setSpeed', validSpeed);
  }
  
  return { success: true, fadeSpeed: validSpeed };
});

// Contrôle du volume
ipcMain.handle('volume:set', (event, volume) => {
  const validVolume = Math.max(0, Math.min(1, volume));
  appState.volume = validVolume;
  
  if (participantWindow) {
    participantWindow.webContents.send('volume:set', validVolume);
  }
  
  return { success: true, volume: validVolume };
});

// Contrôle du voile noir
ipcMain.handle('veil:toggle', (event, show) => {
  if (participantWindow) {
    participantWindow.webContents.send('veil:toggle', show);
  }
  
  // Notifier l'opérateur aussi
  if (operatorWindow && event.sender !== operatorWindow.webContents) {
    operatorWindow.webContents.send('veil:changed', show);
  }
  
  return { success: true, show };
});

// Gestion des logs
ipcMain.handle('log:write', (event, logData) => {
  const timestamp = new Date().toISOString();
  const log = {
    timestamp,
    ...logData,
    source: event.sender === operatorWindow?.webContents ? 'operator' : 'participant'
  };
  
  console.log('[LOG]', JSON.stringify(log));
  
  // Ici on pourrait écrire dans un fichier de log
  
  return { success: true };
});

// Notification de fin de média
ipcMain.on('media:ended', (event, mediaId) => {
  appState.currentState = 'idle';
  appState.isPlaying = false;
  
  // Notifier l'opérateur
  if (operatorWindow) {
    operatorWindow.webContents.send('media:ended', mediaId);
    operatorWindow.webContents.send('state:update', appState);
  }
  
  // Déclencher le retour à l'idle
  if (participantWindow) {
    participantWindow.webContents.send('media:play', {
      mediaId: 'idle',
      condition: appState.condition,
      fadeSpeed: appState.fadeSpeed,
      loop: true
    });
  }
});

// Erreur média
ipcMain.on('media:error', (event, error) => {
  console.error('[MEDIA ERROR]', error);
  
  if (operatorWindow) {
    operatorWindow.webContents.send('media:error', error);
  }
});

// Contrôle du plein écran
ipcMain.handle('window:toggleFullscreen', () => {
  if (participantWindow) {
    const isFullscreen = participantWindow.isFullScreen();
    participantWindow.setFullScreen(!isFullscreen);
    
    // Notifier l'opérateur du changement
    if (operatorWindow) {
      operatorWindow.webContents.send('fullscreen:changed', !isFullscreen);
    }
    
    return { success: true, isFullscreen: !isFullscreen };
  }
  return { success: false, error: 'Participant window not found' };
});

ipcMain.handle('window:setFullscreen', (event, fullscreen) => {
  if (participantWindow) {
    participantWindow.setFullScreen(fullscreen);
    
    // Notifier l'opérateur du changement
    if (operatorWindow) {
      operatorWindow.webContents.send('fullscreen:changed', fullscreen);
    }
    
    return { success: true, isFullscreen: fullscreen };
  }
  return { success: false, error: 'Participant window not found' };
});

ipcMain.handle('window:isFullscreen', () => {
  if (participantWindow) {
    return { success: true, isFullscreen: participantWindow.isFullScreen() };
  }
  return { success: false, error: 'Participant window not found' };
});

// Obtenir le chemin des assets
ipcMain.handle('app:getAssetsPath', () => {
  const isDev = CONFIG.DEV_MODE;
  const assetsPath = isDev 
    ? path.join(__dirname, '..', 'assets')
    : path.join(process.resourcesPath, 'assets');
  
  console.log('[MAIN] Assets path:', assetsPath);
  console.log('[MAIN] Dev mode:', isDev);
  
  // Vérifier l'existence du dossier
  const fs = require('fs');
  if (fs.existsSync(assetsPath)) {
    console.log('[MAIN] Assets folder exists');
    const videosPath = path.join(assetsPath, 'videos');
    const audioPath = path.join(assetsPath, 'audio');
    console.log('[MAIN] Videos path:', videosPath, 'Exists:', fs.existsSync(videosPath));
    console.log('[MAIN] Audio path:', audioPath, 'Exists:', fs.existsSync(audioPath));
  } else {
    console.error('[MAIN] Assets folder NOT FOUND!');
  }
  
  return assetsPath;
});

// === Application Lifecycle ===

app.whenReady().then(() => {
  createOperatorWindow();
  setTimeout(() => {
    createParticipantWindow();
  }, 500); // Délai pour éviter les conflits de focus
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOperatorWindow();
    setTimeout(() => {
      createParticipantWindow();
    }, 500);
  }
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export pour les tests
module.exports = { CONFIG, appState };
