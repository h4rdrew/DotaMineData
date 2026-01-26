import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getItems: (): Promise<unknown[]> => ipcRenderer.invoke('getitems'),
  getItemData: (itemId: number): Promise<unknown[]> => ipcRenderer.invoke('getItemData', itemId),
  getItemDataDateNow: (): Promise<unknown[]> => ipcRenderer.invoke('getItemDataDateNow'),
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
  fetchItemData: (
    itemURL: string
  ): Promise<{ id: number; name: string; imageB64: string; rarity: string; hero: string }> =>
    ipcRenderer.invoke('fetchItemData', itemURL),
  saveBase64Image: (
    base64: string,
    fileName: string
  ): Promise<{ success: boolean; path: string }> =>
    ipcRenderer.invoke('saveBase64Image', base64, fileName),
  getItemDataByDate: (date: string): Promise<unknown[]> =>
    ipcRenderer.invoke('getItemDataByDate', date),
  getItemsByHero: (heroId: number): Promise<unknown[]> =>
    ipcRenderer.invoke('getItemsByHero', heroId)
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
