const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let splashWindow;
let managerWindow;
let billboardWindow;

function createSplash() {
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
    icon: path.join(__dirname, 'splash.ico'), // Add icon
  });

  splashWindow.loadFile('splash.html');

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

function createWindows() {
  // Manager window
  managerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload-manager.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'HighScore Manager(DO NOT SHOW ME!)',
    show: false,
    icon: path.join(__dirname, 'settings.ico'),
  });

  managerWindow.loadFile('manager.html');

  // Billboard window
  billboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload-billboard.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'HighScore Billboard(SHOW ME!)',
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
  });

  billboardWindow.loadFile('billboard.html');

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
  createSplash();
  setTimeout(createWindows, 7500); // Show splash for 6.5 seconds
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindows();
});