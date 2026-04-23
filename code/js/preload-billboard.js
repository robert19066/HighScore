const { contextBridge, ipcRenderer } = require('electron');

ipcRenderer.on('state-update', (event, state) => {
  try {
    const str = (typeof state === 'string') ? state : JSON.stringify(state);
    // Persist for other windows
    localStorage.setItem('hs_state', str);
    // Notify the renderer immediately (avoids continuous polling)
    try {
      if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') {
        window.postMessage({ type: 'hs_state_update', data: str }, '*');
      }
    } catch (e) { /* best-effort notify */ }
  } catch (e) { /* ignore malformed state */ }
});