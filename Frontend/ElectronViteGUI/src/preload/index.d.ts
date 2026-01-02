import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getItems: () => Promise<ItemDB[]> // Sem argumentos
      getItemData: (itemId: number) => Promise<DataDB[]> // Recebe itemId
      getItemDataDateNow: () => Promise<ItemDataDateNow[]> // Sem argumentos
      updateItemPurchased: (itemId: number, purchased: boolean) => Promise<{ changes: number }> // Recebe itemId e purchased (boolean)
      addNewItem: (itemId: number, itemName: string, owned: boolean) => Promise<{ changes: number }> // Recebe itemId, itemName e owned (boolean)
      fetchItemData: (itemURL: string) => Promise<{ id: number; name: string; imageB64: string }> // Recebe itemURL e retorna id e name
      saveBase64Image: (
        base64: string,
        fileName: string
      ) => Promise<{ success: boolean; path: string }> // Recebe base64 e fileName e retorna sucesso e caminho
    }
    eShell: {
      openExternal: (url: string) => Promise<void>
    }
  }
}
