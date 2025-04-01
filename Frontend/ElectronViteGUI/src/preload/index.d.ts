import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getItems: () => Promise<ItemDB[]> // Sem argumentos
      getItemData: (itemId: number) => Promise<DataDB[]> // Recebe itemId
      getImagePath: (itemId: number) => Promise<string> // Recebe itemId
    }
  }
}
