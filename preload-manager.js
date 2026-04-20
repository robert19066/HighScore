const { contextBridge, ipcRenderer } = require('electron');

const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
  originalSetItem.call(localStorage, key, value);
  if (key === 'hs_state') {
    ipcRenderer.send('state-update', value);
  }
};