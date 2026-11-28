const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const ICON_SIZE_PX = 512;
const OUTPUT_PATH = path.join(__dirname, '..', 'desktop', 'icon.png');
const ICON_HTML = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${ICON_SIZE_PX}px;height:${ICON_SIZE_PX}px;border-radius:112px;display:grid;place-items:center;
background:radial-gradient(circle at 30% 20%,#2a1608,#06080C 70%);box-shadow:inset 0 0 0 10px rgba(255,160,90,0.55)">
<svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#FF7A1A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M3.5 7L12 12l8.5-5"/><path d="M12 12v10"/></svg></div></body></html>`;

app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: ICON_SIZE_PX,
    height: ICON_SIZE_PX,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  window.webContents.on('paint', (_event, _dirty, image) => {
    if (image.isEmpty() || image.getSize().width < ICON_SIZE_PX) {
      return;
    }
    fs.writeFileSync(OUTPUT_PATH, image.resize({ width: ICON_SIZE_PX, height: ICON_SIZE_PX }).toPNG());
    app.quit();
  });
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(ICON_HTML)}`);
});
