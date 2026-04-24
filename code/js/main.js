const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Optional persistent store (guarded) — electron-store if installed
let Store = null;
try { Store = require('electron-store'); } catch (e) { Store = null; }
let store = Store ? new Store({ name: 'highscore' }) : null;

// Precompute common paths for small performance win
const ROOT_DIR = path.join(__dirname, '..', '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const HTML_DIR = path.join(__dirname, '..', 'html');

let splashWindow;
let managerWindow;
let billboardWindow;
let createWindowsTimer = null;
let windowsCreated = false;
let lastVersion = '';
let windowsBlocked = false;

function readVersion() {
  try {
    const vpath = path.join(ASSETS_DIR, 'vrsn.txt');
    if (fs.existsSync(vpath)) return fs.readFileSync(vpath, 'utf8').trim();
  } catch (e) {}
  return '';
}

async function readVersionAsync(){
  try{
    const vpath = path.join(ASSETS_DIR, 'vrsn.txt');
    const txt = await fs.promises.readFile(vpath,'utf8');
    return txt.trim();
  }catch(e){
    return readVersion();
  }
}

function fileUrlWithQuery(filePath, query) {
  const base = pathToFileURL(filePath).toString();
  if (!query) return base;
  const qs = new URLSearchParams(query).toString();
  return base + (qs ? ('?' + qs) : '');
}

function createSplash(version) {
  const splashPreload = path.join(__dirname, 'preload-splash.js');
  const splashIcon = path.join(ASSETS_DIR, 'icons', 'splash.ico');
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      // keep timers throttled when background to save CPU
      backgroundThrottling: true,
      preload: splashPreload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    resizable: false,
    show: false,
    icon: splashIcon,
  });

  const splashFile = path.join(HTML_DIR, 'splash.html');
  splashWindow.loadURL(fileUrlWithQuery(splashFile, { v: version }));

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
    // Start the fallback timer to create main windows only after splash is visible.
    if (!windowsCreated && !windowsBlocked) {
      if (createWindowsTimer) { clearTimeout(createWindowsTimer); createWindowsTimer = null; }
      createWindowsTimer = setTimeout(() => {
        if (windowsCreated) return;
        windowsCreated = true;
        createWindows(lastVersion);
      }, 6200);
    }
  });
}

function createWindows(version) {
  // Manager window
  const managerPreload = path.join(__dirname, 'preload-manager.js');
  const managerIcon = path.join(ASSETS_DIR, 'icons', 'settings.ico');
  managerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      backgroundThrottling: true,
      preload: managerPreload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'HighScore Manager (Manager)',
    show: false,
    icon: managerIcon,
  });

  // CRITICAL FIX: Intercept window.open and route external links to the default system browser
  managerWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const managerFile = path.join(HTML_DIR, 'manager.html');
  managerWindow.loadURL(fileUrlWithQuery(managerFile, { v: version }));

  // Billboard window
  const billboardPreload = path.join(__dirname, 'preload-billboard.js');
  const billboardIcon = path.join(ASSETS_DIR, 'icons', 'icon.ico');
  billboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      backgroundThrottling: true,
      preload: billboardPreload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'HighScore Billboard',
    show: false,
    icon: billboardIcon,
  });

  // Apply the same external link protection to the Billboard
  billboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const billboardFile = path.join(HTML_DIR, 'billboard.html');
  billboardWindow.loadURL(fileUrlWithQuery(billboardFile, { v: version }));

  // Immediately send persisted lowPower flag to newly created windows (best-effort)
  const persistedLow = store ? !!store.get('lowPower') : false;
  try{ managerWindow.webContents.once('did-finish-load', ()=>{ managerWindow.webContents.send('perf-low-power', persistedLow); }); }catch(e){}
  try{ billboardWindow.webContents.once('did-finish-load', ()=>{ billboardWindow.webContents.send('perf-low-power', persistedLow); }); }catch(e){}

  // Handle state updates from manager
  ipcMain.on('state-update', (event, state) => {
    if (billboardWindow && !billboardWindow.isDestroyed()) {
      billboardWindow.webContents.send('state-update', state);
    }
  });

  // Expose install date for update checker
  ipcMain.handle('get-install-date', async () => {
    // Try electron-store persisted install date first
    if (store) {
      let installDate = store.get('installDate');
      if (!installDate) {
        // First run — record it now
        installDate = new Date().toISOString();
        store.set('installDate', installDate);
      }
      return installDate;
    }
    // Fallback: use app exe stat mtime
    try {
      const exePath = app.getPath('exe');
      const stat = await fs.promises.stat(exePath);
      return stat.mtime.toISOString();
    } catch(e) {
      return null;
    }
  });

  managerWindow.on('closed', () => {
    if (billboardWindow && !billboardWindow.isDestroyed()) {
      billboardWindow.close();
    }
  });

  billboardWindow.on('closed', () => {
    if (managerWindow && !managerWindow.isDestroyed()) {
      managerWindow.close();
    }
  });

  managerWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.close();
    managerWindow.show();
  });

  billboardWindow.once('ready-to-show', () => {
    billboardWindow.show();
  });
}

app.whenReady().then(async () => {
  const version = (await readVersionAsync()) || '';
  lastVersion = version;
  // Persist last-known assets version (best-effort)
  try{ if(store) store.set('lastVersion', version); }catch(e){}
  createSplash(version);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const version = readVersion() || '';
    createWindows(version);
  }
});

// IPC: read/write DSCP config and handle splash decisions
ipcMain.handle('dscp-read', async () => {
  try {
    const cfgPath = path.join(ASSETS_DIR, 'DSCPconfig.txt');
    const txt = await fs.promises.readFile(cfgPath, 'utf8');
    return txt.trim();
  } catch (e) {
    return 'WN';
  }
});

ipcMain.handle('dscp-write', async (event, val) => {
  try {
    const cfgPath = path.join(ASSETS_DIR, 'DSCPconfig.txt');
    await fs.promises.writeFile(cfgPath, String(val || '').trim(), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.on('splash-blocking', (event, flagged) => {
  try {
    if (flagged) {
      windowsBlocked = true;
      if (createWindowsTimer) { clearTimeout(createWindowsTimer); createWindowsTimer = null; }
    } else {
      windowsBlocked = false;
    }
  } catch (e) { /* ignore */ }
});

ipcMain.on('splash-allow', () => {
  if (windowsCreated) return;
  windowsCreated = true;
  if (createWindowsTimer) { clearTimeout(createWindowsTimer); createWindowsTimer = null; }
  createWindows(lastVersion || readVersion());
});

ipcMain.on('splash-exit', () => {
  app.quit();
});

// Persist and broadcast a low-power / reduced-mode flag
ipcMain.handle('set-low-power', async (event, flag) => {
  try {
    const val = !!flag;
    // persist best-effort
    try { if (store) store.set('lowPower', val); } catch (e) {}
    // broadcast to existing windows
    try { if (managerWindow && !managerWindow.isDestroyed()) managerWindow.webContents.send('perf-low-power', val); } catch (e) {}
    try { if (billboardWindow && !billboardWindow.isDestroyed()) billboardWindow.webContents.send('perf-low-power', val); } catch (e) {}
    return true;
  } catch (e) { return false; }
});