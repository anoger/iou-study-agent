const { contextBridge, ipcRenderer } = require('electron');

// API exposée au renderer de l'opérateur
contextBridge.exposeInMainWorld('electronAPI', {
  // État de l'application
  getState: () => ipcRenderer.invoke('app:getState'),
  setState: (state) => ipcRenderer.invoke('app:setState', state),
  
  // Contrôle des médias
  playMedia: (mediaId) => ipcRenderer.invoke('media:play', mediaId),
  stopMedia: () => ipcRenderer.invoke('media:stop'),
  preloadMedia: (mediaIds) => ipcRenderer.invoke('media:preload', mediaIds),
  
  // Configuration
  changeCondition: (condition) => ipcRenderer.invoke('condition:change', condition),
  setFadeSpeed: (speed) => ipcRenderer.invoke('fade:setSpeed', speed),
  setVolume: (volume) => ipcRenderer.invoke('volume:set', volume),
  
  // Logging
  writeLog: (data) => ipcRenderer.invoke('log:write', data),
  
  // Événements
  onStateUpdate: (callback) => {
    ipcRenderer.on('state:update', (event, state) => callback(state));
  },
  
  onMediaEnded: (callback) => {
    ipcRenderer.on('media:ended', (event, mediaId) => callback(mediaId));
  },
  
  onMediaError: (callback) => {
    ipcRenderer.on('media:error', (event, error) => callback(error));
  },
  
  // Nettoyage
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('state:update');
    ipcRenderer.removeAllListeners('media:ended');
    ipcRenderer.removeAllListeners('media:error');
  }
});
