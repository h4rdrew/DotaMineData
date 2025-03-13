import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    getitems: Promise<SetStateAction<{ itemId: number; nome: string }[]>>
  }
}
