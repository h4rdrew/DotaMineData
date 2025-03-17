"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Sqlite3 = require("sqlite3");
const icon = path.join(__dirname, "../../resources/icon.png");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("getitems", async () => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database("E:\\dotaItemCollectData.db", Sqlite3.OPEN_READONLY);
    db.all("SELECT * FROM Item", [], (err, rows) => {
      if (err) {
        console.error("Erro ao ler o DB.");
        reject(err);
      } else {
        console.log("Sucesso em ler o DB.");
        resolve(rows);
      }
    });
    db.close();
  });
});
electron.ipcMain.handle("getItemData", async (_event, itemId) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database("E:\\dotaItemCollectData.db", Sqlite3.OPEN_READONLY);
    db.all("SELECT * FROM Data WHERE ItemId = ?", [`${itemId}`], (err, rows) => {
      if (err) {
        console.error("Erro ao ler o DB.");
        reject(err);
      } else {
        console.log("Sucesso em ler o DB.");
        resolve(rows);
      }
    });
    db.close();
  });
});
//# sourceMappingURL=index.js.map
