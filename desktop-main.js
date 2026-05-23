const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");

require("./server");

const APP_URL = "http://localhost:4317";

function waitForServer(retries = 40) {
  return new Promise(resolve => {
    const tryOpen = remaining => {
      const req = http.get(`${APP_URL}/api/health`, res => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (remaining <= 0) return resolve(false);
        setTimeout(() => tryOpen(remaining - 1), 250);
      });
      req.setTimeout(1000, () => {
        req.destroy();
      });
    };
    tryOpen(retries);
  });
}

async function createWindow() {
  await waitForServer();

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "C盘安心管家",
    backgroundColor: "#eef3f7",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await win.loadURL(APP_URL);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
