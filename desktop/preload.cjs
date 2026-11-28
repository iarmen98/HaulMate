const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('haulmateDesktop', {
  getInitialFolder: () => ipcRenderer.invoke('folder:get-initial'),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  follow: (folder) => ipcRenderer.invoke('log:follow', folder),
  stop: () => ipcRenderer.invoke('log:stop'),
  onChunk: (listener) => {
    const handler = (_event, chunk) => listener(chunk);
    ipcRenderer.on('log:chunk', handler);
    return () => ipcRenderer.removeListener('log:chunk', handler);
  },
  onError: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on('log:error', handler);
    return () => ipcRenderer.removeListener('log:error', handler);
  },
});
