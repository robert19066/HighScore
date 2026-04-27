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

try { ipcRenderer.on('perf-low-power', (ev, flag) => {
  try { if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') window.postMessage({ type: 'hs_low_power', flag: !!flag }, '*'); } catch(e){}
  try { localStorage.setItem('hs_low_power', !!flag ? '1' : '0'); } catch(e){}
}); } catch(e){}

try { ipcRenderer.on('hs_play_sfx', (ev, key) => {
  try { if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') window.postMessage({ type: 'hs_play_sfx', key: key }, '*'); } catch(e){}
}); } catch(e){}

try { ipcRenderer.on('hs_message', (ev, msg) => {
  try { if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') window.postMessage(msg, '*'); } catch(e){}
}); } catch(e){}
