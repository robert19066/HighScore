const { contextBridge, ipcRenderer } = require('electron');

ipcRenderer.on('state-update', (event, state) => {
  localStorage.setItem('hs_state', state);
});