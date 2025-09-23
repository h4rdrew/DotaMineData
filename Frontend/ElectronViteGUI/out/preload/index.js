"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  getItems: () => electron.ipcRenderer.invoke("getitems"),
  getItemData: (itemId) => electron.ipcRenderer.invoke("getItemData", itemId),
  getItemDataDateNow: () => electron.ipcRenderer.invoke("getItemDataDateNow"),
  updateItemPurchased: (itemId, purchased) => electron.ipcRenderer.invoke("updateItemPurchased", itemId, purchased)
};
const eShell = {
  openExternal: (url) => electron.shell.openExternal(url)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
    electron.contextBridge.exposeInMainWorld("eShell", eShell);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
  window.shell = eShell;
}
//# sourceMappingURL=index.js.map
