export interface Hero {
  Id: number
  HeroId: number
  Name: string
  PersonaName: string | null
}
export interface Item {
  Id: number
  ItemId: number
  Name: string
  Purchased: boolean
  Hero: number
}
export interface ItemPrice {
  ItemId: number
  Price: number
  ServiceType: number
}
export interface ItemHistory extends ItemPrice {
  ExchangeRate: number
  DateTime: string
}
export interface ScrapedItem {
  id: number
  name: string
  imageB64: string
  rarity: string
  hero: string
  slot?: string
}
export interface MutationResult {
  changes: number
}

export interface DesktopApi {
  getHeroes(): Promise<Hero[]>
  getItems(): Promise<Item[]>
  getItemData(itemId: number): Promise<ItemHistory[]>
  getItemDataDateNow(): Promise<ItemPrice[]>
  getItemDataByDate(date: string): Promise<ItemPrice[]>
  getItemsByHero(heroId: number): Promise<Item[]>
  updateItemPurchased(itemId: number, purchased: boolean): Promise<MutationResult>
  addNewItem(
    itemId: number,
    itemName: string,
    owned: boolean,
    rarity: number,
    hero: number
  ): Promise<MutationResult>
  fetchItemData(itemUrl: string): Promise<ScrapedItem>
  saveBase64Image(base64: string, fileName: string): Promise<{ success: true; path: string }>
}
