import type { ElectronAPI } from '@electron-toolkit/preload'
import type { DesktopApi } from '../shared/contracts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: DesktopApi
    eShell: { openExternal(url: string): Promise<void> }
  }
}
