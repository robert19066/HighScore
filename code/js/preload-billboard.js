const { contextBridge, ipcRenderer } = require('electron');

ipcRenderer.on('state-update', (event, state) => {
  try {
    const str = (typeof state === 'string') ? state : JSON.stringify(state);
    localStorage.setItem('hs_state', str);
  } catch (e) { /* ignore malformed state */ }
});