const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Precompute common paths for small performance win
const ROOT_DIR = path.join(__dirname, '..', '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const HTML_DIR = path.join(__dirname, '..', 'html');

let splashWindow;
let managerWindow;
let billboardWindow;

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
  const splashIcon = path.join(ASSETS_DIR, 'splash.ico');
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
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
  });
}

function createWindows(version) {
  // Manager window
  const managerPreload = path.join(__dirname, 'preload-manager.js');
  const managerIcon = path.join(ASSETS_DIR, 'settings.ico');
  managerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
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
  const billboardIcon = path.join(ASSETS_DIR, 'icon.ico');
  billboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
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

  // Handle state updates from manager
  ipcMain.on('state-update', (event, state) => {
    if (billboardWindow && !billboardWindow.isDestroyed()) {
      billboardWindow.webContents.send('state-update', state);
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
  createSplash(version);
  // Shorten splash wait to improve startup latency while still showing splash
  setTimeout(() => createWindows(version), 1500);
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