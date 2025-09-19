import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getItems: (): Promise<unknown[]> => ipcRenderer.invoke('getitems'),
  getItemData: (itemId: number): Promise<unknown[]> => ipcRenderer.invoke('getItemData', itemId),
  getItemDataDateNow: (): Promise<unknown[]> => ipcRenderer.invoke('getItemDataDateNow')
}

const eShell = {
  openExternal: (url: string): Promise<void> => shell.openExternal(url)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('eShell', eShell)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.shell = eShell
}
