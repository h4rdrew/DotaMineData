"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Sqlite3 = require("sqlite3");
const fs = require("fs");
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
      sandbox: false,
      webSecurity: false
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
    db.all("SELECT * FROM Item ORDER BY Name", [], (err, rows) => {
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
electron.ipcMain.handle("updateItemPurchased", async (_event, itemId, purchased) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database("E:\\dotaItemCollectData.db", Sqlite3.OPEN_READWRITE);
    db.run(
      `UPDATE Item
       SET Purchased = ?
       WHERE ItemId = ?`,
      [purchased ? 1 : 0, itemId],
      function(err) {
        if (err) {
          console.error("Erro ao atualizar o DB.");
          reject(err);
        } else {
          console.log(`Sucesso em atualizar o DB. Linhas afetadas: ${this.changes}`);
          resolve({ changes: this.changes });
        }
      }
    );
    db.close();
  });
});
electron.ipcMain.handle("getItemData", async (_event, itemId) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database("E:\\dotaItemCollectData.db", Sqlite3.OPEN_READONLY);
    db.all(
      `SELECT
ItemCaptured.DateTime,
ItemCaptured.ExchangeRate,
ItemCaptured.ServiceType,
CollectData.Price,
CollectData.ItemId
FROM CollectData
INNER JOIN ItemCaptured ON CollectData.CaptureId = ItemCaptured.CaptureId
WHERE ItemCaptured.DateTime != 0
AND CollectData.ItemId = ?
ORDER BY date(ItemCaptured.DateTime)
      `,
      [`${itemId}`],
      (err, rows) => {
        if (err) {
          console.error("Erro ao ler o DB.");
          reject(err);
        } else {
          console.log("Sucesso em ler o DB.");
          resolve(rows);
        }
      }
    );
    db.close();
  });
});
electron.ipcMain.handle("getItemDataDateNow", async () => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database("E:\\dotaItemCollectData.db", Sqlite3.OPEN_READONLY);
    db.all(
      `WITH UltimoCapture AS (
    SELECT
        cd.ItemId,
        cd.Price,
        ic.ServiceType,
        ROW_NUMBER() OVER (
            PARTITION BY cd.ItemId, ic.ServiceType
            ORDER BY ic.DateTime DESC
        ) AS rn
    FROM CollectData cd
    JOIN ItemCaptured ic
        ON cd.CaptureId = ic.CaptureId
    WHERE ic.DateTime != 0
      AND ic.ServiceType IN (1, 2)
)
SELECT ServiceType, Price, ItemId
FROM UltimoCapture
WHERE rn = 1
ORDER BY ItemId, ServiceType;
      `,
      [],
      (err, rows) => {
        if (err) {
          console.error("Erro ao ler o DB.");
          reject(err);
        } else {
          console.log("Sucesso em ler o DB.");
          resolve(rows);
        }
      }
    );
    db.close();
  });
});
electron.ipcMain.handle("getImagePath", (event, itemId) => {
  const imagePath = path.join("E:\\DotaMine\\img", `${itemId}.png`);
  return fs.existsSync(imagePath) ? `file://${imagePath}` : null;
});
//# sourceMappingURL=index.js.map
