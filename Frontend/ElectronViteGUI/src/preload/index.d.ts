import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getItems: () => Promise<ItemDB[]> // Sem argumentos
      getItemData: (itemId: number) => Promise<DataDB[]> // Recebe itemId
    }
  }
}
