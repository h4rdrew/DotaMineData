"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  getItems: () => electron.ipcRenderer.invoke("getitems"),
  getItemData: (itemId) => electron.ipcRenderer.invoke("getItemData", itemId),
  getImagePath: (itemId) => electron.ipcRenderer.invoke("getImagePath", itemId)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
//# sourceMappingURL=index.js.map
