const { contextBridge, ipcRenderer } = require('electron');

// API exposée au renderer du participant
contextBridge.exposeInMainWorld('electronAPI', {
  // Obtenir le chemin des assets
  getAssetsPath: () => ipcRenderer.invoke('app:getAssetsPath'),
  
  // Notifications au main process
  notifyMediaEnded: (mediaId) => ipcRenderer.send('media:ended', mediaId),
  notifyMediaError: (error) => ipcRenderer.send('media:error', error),
  
  // Réception des commandes
  onPlayMedia: (callback) => {
    ipcRenderer.on('media:play', (event, data) => callback(data));
  },
  
  onStopMedia: (callback) => {
    ipcRenderer.on('media:stop', () => callback());
  },
  
  onPreloadMedia: (callback) => {
    ipcRenderer.on('media:preload', (event, mediaIds) => callback(mediaIds));
  },
  
  onConditionChange: (callback) => {
    ipcRenderer.on('condition:change', (event, condition) => callback(condition));
  },
  
  onFadeSpeedChange: (callback) => {
    ipcRenderer.on('fade:setSpeed', (event, speed) => callback(speed));
  },
  
  onVolumeChange: (callback) => {
    ipcRenderer.on('volume:set', (event, volume) => callback(volume));
  },
  
  onToggleVeil: (callback) => {
    ipcRenderer.on('veil:toggle', (event, show) => callback(show));
  },
  
  onStateUpdate: (callback) => {
    ipcRenderer.on('state:update', (event, state) => callback(state));
  },
  
  // Nettoyage
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('media:play');
    ipcRenderer.removeAllListeners('media:stop');
    ipcRenderer.removeAllListeners('media:preload');
    ipcRenderer.removeAllListeners('condition:change');
    ipcRenderer.removeAllListeners('fade:setSpeed');
    ipcRenderer.removeAllListeners('volume:set');
    ipcRenderer.removeAllListeners('veil:toggle');
    ipcRenderer.removeAllListeners('state:update');
  }
});
