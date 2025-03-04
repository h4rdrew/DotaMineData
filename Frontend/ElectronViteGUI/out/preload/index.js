"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {};
const getItems = electron.ipcRenderer.invoke("get-items");
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
    electron.contextBridge.exposeInMainWorld("getitems", getItems);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
  window.getItems = getItems;
}
//# sourceMappingURL=index.js.map
