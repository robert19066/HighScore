const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DSCP', {
  readConfig: () => ipcRenderer.invoke('dscp-read'),
  writeConfig: (val) => ipcRenderer.invoke('dscp-write', val),
  blocking: (flag) => ipcRenderer.send('splash-blocking', flag),
  setLowPower: (flag) => ipcRenderer.invoke('set-low-power', !!flag),
  allow: () => ipcRenderer.send('splash-allow'),
  exit: () => ipcRenderer.send('splash-exit'),
});
