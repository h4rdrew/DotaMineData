import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getItems: () => Promise<ItemDB[]> // Sem argumentos
      getItemData: (itemId: number) => Promise<DataDB[]> // Recebe itemId
      getItemDataDateNow: () => Promise<ItemDataDateNow[]> // Sem argumentos
      updateItemPurchased: (itemId: number, purchased: boolean) => Promise<{ changes: number }> // Recebe itemId e purchased (boolean)
    }
    eShell: {
      openExternal: (url: string) => Promise<void>
    }
  }
}
