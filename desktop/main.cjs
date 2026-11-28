const fs = require('node:fs');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  net,
  protocol,
  screen: electronScreen,
  shell,
} = require('electron');
const { pathToFileURL } = require('node:url');
const { GAME_LOG_FILE_NAME, findGameFolders, hasGameLog } = require('./game-folder.cjs');
const { createLogTail } = require('./log-tail.cjs');

const APP_SCHEME = 'app';
const APP_HOST = 'haulmate';
const DIST_FOLDER = path.join(__dirname, '..', 'dist');
const CONFIG_FILE_NAME = 'desktop-config.json';
const HOTKEYS = { confirmLoaded: 'F8', toggleOverlay: 'Shift+F8' };
const OVERLAY_WIDTH_PX = 400;
const OVERLAY_HEIGHT_PX = 540;
const OVERLAY_MARGIN_PX = 24;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let overlayWindow = null;
const tailsBySender = new Map();

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), CONFIG_FILE_NAME), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(path.join(app.getPath('userData'), CONFIG_FILE_NAME), JSON.stringify(config, null, 2));
}

function resolveDistFile(requestUrl) {
  const { pathname } = new URL(requestUrl);
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.normalize(path.join(DIST_FOLDER, relative));
  return filePath.startsWith(DIST_FOLDER) ? filePath : null;
}

function stopFollowing(sender) {
  tailsBySender.get(sender.id)?.stop();
  tailsBySender.delete(sender.id);
}

function startFollowing(sender, folder) {
  stopFollowing(sender);
  const logPath = path.join(folder, GAME_LOG_FILE_NAME);
  const send = (channel, payload) => {
    if (!sender.isDestroyed()) {
      sender.send(channel, payload);
    }
  };
  tailsBySender.set(
    sender.id,
    createLogTail(
      logPath,
      (chunk) => send('log:chunk', chunk),
      (message) => send('log:error', message),
    ),
  );
  sender.once('destroyed', () => stopFollowing(sender));
  return { folder, logPath };
}

function createSecureWindow(options) {
  return new BrowserWindow({
    ...options,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
}

function createOverlayWindow() {
  const { workArea } = electronScreen.getPrimaryDisplay();
  overlayWindow = createSecureWindow({
    width: OVERLAY_WIDTH_PX,
    height: OVERLAY_HEIGHT_PX,
    x: workArea.x + OVERLAY_MARGIN_PX,
    y: workArea.y + workArea.height - OVERLAY_HEIGHT_PX - OVERLAY_MARGIN_PX,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    title: 'Haulmate overlay',
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.once('ready-to-show', () => overlayWindow?.showInactive());
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
  void overlayWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/?view=overlay`);
}

function toggleOverlay() {
  const isVisible = overlayWindow === null;
  if (isVisible) {
    createOverlayWindow();
  } else {
    overlayWindow.close();
  }
  writeConfig({ ...readConfig(), overlayVisible: isVisible });
  return isVisible;
}

function registerHotkeys() {
  globalShortcut.register(HOTKEYS.confirmLoaded, () => mainWindow?.webContents.send('hotkey:confirm-loaded'));
  globalShortcut.register(HOTKEYS.toggleOverlay, () => toggleOverlay());
}

function registerIpcHandlers() {
  ipcMain.handle('folder:get-initial', () => {
    const saved = readConfig().gameFolder;
    if (typeof saved === 'string' && hasGameLog(saved)) {
      return saved;
    }
    return findGameFolders()[0] ?? null;
  });

  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'StarCitizen\\LIVE',
      properties: ['openDirectory'],
    });
    const folder = result.canceled ? null : (result.filePaths[0] ?? null);
    if (folder === null) {
      return { status: 'cancelled' };
    }
    if (!hasGameLog(folder)) {
      return { status: 'noGameLog', folder };
    }
    writeConfig({ ...readConfig(), gameFolder: folder });
    return { status: 'ok', folder };
  });

  ipcMain.handle('log:follow', (event, folder) => {
    if (typeof folder !== 'string' || !hasGameLog(folder)) {
      return { status: 'noGameLog' };
    }
    if (event.sender === mainWindow?.webContents) {
      writeConfig({ ...readConfig(), gameFolder: folder });
    }
    return { status: 'ok', ...startFollowing(event.sender, folder) };
  });

  ipcMain.handle('log:stop', (event) => {
    stopFollowing(event.sender);
    if (event.sender === mainWindow?.webContents) {
      writeConfig({ ...readConfig(), gameFolder: null });
    }
  });

  ipcMain.handle('overlay:toggle', () => toggleOverlay());
  ipcMain.handle('overlay:hotkeys', () => HOTKEYS);
}

function createWindow() {
  mainWindow = createSecureWindow({
    width: 1480,
    height: 960,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#06080C',
    title: 'Haulmate',
    autoHideMenuBar: true,
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  void mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
}

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveDistFile(request.url);
    if (filePath === null || !fs.existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
  registerIpcHandlers();
  registerHotkeys();
  createWindow();
  if (readConfig().overlayVisible === true) {
    createOverlayWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
