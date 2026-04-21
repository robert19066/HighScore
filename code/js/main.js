const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let splashWindow;
let managerWindow;
let billboardWindow;

function readVersion() {
  try {
    const vpath = path.join(__dirname, '..', '..', 'assets', 'vrsn.txt');
    if (fs.existsSync(vpath)) return fs.readFileSync(vpath, 'utf8').trim();
  } catch (e) {}
  return '';
}

function fileUrlWithQuery(filePath, query) {
  const base = pathToFileURL(filePath).toString();
  if (!query) return base;
  const qs = new URLSearchParams(query).toString();
  return base + (qs ? ('?' + qs) : '');
}

function createSplash(version) {
  const splashIcon = path.join(__dirname, '..', '..', 'assets', 'splash.ico');
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

  const splashFile = path.join(__dirname, '..', 'html', 'splash.html');
  splashWindow.loadURL(fileUrlWithQuery(splashFile, { v: version }));

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

function createWindows(version) {
  // Manager window
  const managerPreload = path.join(__dirname, 'preload-manager.js');
  const managerIcon = path.join(__dirname, '..', '..', 'assets', 'settings.ico');
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

  const managerFile = path.join(__dirname, '..', 'html', 'manager.html');
  managerWindow.loadURL(fileUrlWithQuery(managerFile, { v: version }));

  // Billboard window
  const billboardPreload = path.join(__dirname, 'preload-billboard.js');
  const billboardIcon = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
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

  const billboardFile = path.join(__dirname, '..', 'html', 'billboard.html');
  billboardWindow.loadURL(fileUrlWithQuery(billboardFile, { v: version }));

  // Handle state updates from manager
  ipcMain.on('state-update', (event, state) => {
    // Send to billboard
    if (billboardWindow && !billboardWindow.isDestroyed()) {
      billboardWindow.webContents.send('state-update', state);
    }
  });

  // Close both windows when one is closed
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

  // Show windows after loading
  managerWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.close();
    managerWindow.show();
  });

  billboardWindow.once('ready-to-show', () => {
    billboardWindow.show();
  });
}

app.whenReady().then(() => {
  const version = readVersion() || '';
  createSplash(version);
  setTimeout(() => createWindows(version), 7500); // Show splash for 7.5 seconds
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