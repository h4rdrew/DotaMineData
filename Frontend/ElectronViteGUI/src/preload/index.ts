import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DesktopApi } from '../shared/contracts'
import type { CollectorState } from '../shared/collector'

// Custom APIs for renderer
const api: DesktopApi = {
  startCollection: (itemId) => ipcRenderer.invoke('collector:start', itemId),
  cancelCollection: () => ipcRenderer.invoke('collector:cancel'),
  getCollectionState: () => ipcRenderer.invoke('collector:state'),
  onCollectionState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: CollectorState): void =>
      listener(state)
    ipcRenderer.on('collector:state', handler)
    return () => ipcRenderer.removeListener('collector:state', handler)
  },
  getHeroes: () => ipcRenderer.invoke('getHeroes'),
  getItems: () => ipcRenderer.invoke('getitems'),
  getItemData: (itemId) => ipcRenderer.invoke('getItemData', itemId),
  getItemDataDateNow: () => ipcRenderer.invoke('getItemDataDateNow'),
  updateItemPurchased: (itemId: number, purchased: boolean): Promise<{ changes: number }> =>
    ipcRenderer.invoke('updateItemPurchased', itemId, purchased),
  addNewItem: (
    itemId: number,
    itemName: string,
    owned: boolean,
    rarity: number,
    hero: number
  ): Promise<{ changes: number }> =>
    ipcRenderer.invoke('addNewItem', itemId, itemName, owned, rarity, hero),
  fetchItemData: (itemURL) => ipcRenderer.invoke('fetchItemData', itemURL),
  saveBase64Image: (base64: string, fileName: string): Promise<{ success: true; path: string }> =>
    ipcRenderer.invoke('saveBase64Image', base64, fileName),
  getItemDataByDate: (date) => ipcRenderer.invoke('getItemDataByDate', date),
  getItemsByHero: (heroId) => ipcRenderer.invoke('getItemsByHero', heroId)
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
