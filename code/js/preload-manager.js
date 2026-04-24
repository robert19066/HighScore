const { contextBridge, ipcRenderer } = require('electron');

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
      // listen for perf flag from main and mirror into the page
      try { ipcRenderer.on('perf-low-power', (ev, flag) => {
        try { if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') window.postMessage({ type: 'hs_low_power', flag: !!flag }, '*'); } catch(e){ }
        try { originalSetItem.call(localStorage, 'hs_low_power', !!flag ? '1' : '0'); } catch(e){}
      }); } catch(e){}
    } else {
      // localStorage might not be ready yet in some contexts — defer until DOM is ready
      window.addEventListener('DOMContentLoaded', () => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
            const originalSetItem = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function(key, value) {
              originalSetItem(key, value);
              if (key === 'hs_state') safeSendState(value);
            };
          }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }
})();