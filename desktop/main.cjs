const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require('electron');
const { pathToFileURL } = require('node:url');
const { GAME_LOG_FILE_NAME, findGameFolders, hasGameLog } = require('./game-folder.cjs');
const { createLogTail } = require('./log-tail.cjs');

const APP_SCHEME = 'app';
const APP_HOST = 'haulmate';
const DIST_FOLDER = path.join(__dirname, '..', 'dist');
const CONFIG_FILE_NAME = 'desktop-config.json';

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let activeTail = null;

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

function stopFollowing() {
  activeTail?.stop();
  activeTail = null;
}

function startFollowing(folder) {
  stopFollowing();
  const logPath = path.join(folder, GAME_LOG_FILE_NAME);
  activeTail = createLogTail(
    logPath,
    (chunk) => mainWindow?.webContents.send('log:chunk', chunk),
    (message) => mainWindow?.webContents.send('log:error', message),
  );
  return { folder, logPath };
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

  ipcMain.handle('log:follow', (_event, folder) => {
    if (typeof folder !== 'string' || !hasGameLog(folder)) {
      return { status: 'noGameLog' };
    }
    writeConfig({ ...readConfig(), gameFolder: folder });
    return { status: 'ok', ...startFollowing(folder) };
  });

  ipcMain.handle('log:stop', () => {
    stopFollowing();
    writeConfig({ ...readConfig(), gameFolder: null });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#06080C',
    title: 'Haulmate',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    stopFollowing();
    mainWindow = null;
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
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
