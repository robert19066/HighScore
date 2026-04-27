const { contextBridge, ipcRenderer } = require('electron');

try {
  // Expose a minimal bridge for the manager renderer to request billboard actions
  // without using window.open (prevents creating new windows on SFX).
  contextBridge.exposeInMainWorld('HighScoreBridge', {
    playSfx: (key) => { try { ipcRenderer.send('hs_play_sfx', key); } catch (e) {} },
    openBillboard: () => { try { ipcRenderer.send('open-billboard'); } catch (e) {} },
    sendMessage: (msg) => { try { ipcRenderer.send('hs_message', msg); } catch (e) {} }
  });
} catch (e) {}

(function(){
  function safeSendState(val) {
    try {
      const str = (typeof val === 'string') ? val : JSON.stringify(val);
      ipcRenderer.send('state-update', str);
    } catch (e) { /* ignore */ }
  }

  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (key === 'hs_state') safeSendState(value);
      };
      try { ipcRenderer.on('perf-low-power', (ev, flag) => {
        try { if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') window.postMessage({ type: 'hs_low_power', flag: !!flag }, '*'); } catch(e){ }
        try { originalSetItem.call(localStorage, 'hs_low_power', !!flag ? '1' : '0'); } catch(e){}
      }); } catch(e){}
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
            const originalSetItem = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function(key, value) {
              originalSetItem(key, value);
              if (key === 'hs_state') safeSendState(value);
            };
          }
        } catch (e) { }
      });
    }
  } catch (e) { }
})();
