import fs from 'fs/promises'
import path from 'path'
import { ipcMain } from 'electron'
import type { Hero, Item, ItemHistory, ItemPrice } from '../shared/contracts'
import { appPaths } from './config'
import { execute, queryAll } from './database'
import { fetchItemData } from './item-scraper'

const latestPricesQuery = `WITH LatestCapture AS (
 SELECT cd.ItemId, cd.Price, ic.ServiceType,
 ROW_NUMBER() OVER (PARTITION BY cd.ItemId, ic.ServiceType ORDER BY ic.DateTime DESC) AS rowNumber
 FROM CollectData cd JOIN ItemCaptured ic ON cd.CaptureId = ic.CaptureId
 WHERE ic.ServiceType IN (1, 2) AND DATE(ic.DateTime) = DATE(?)
) SELECT ServiceType, Price, ItemId FROM LatestCapture
WHERE rowNumber = 1 ORDER BY ItemId, ServiceType`

export function registerIpcHandlers(): void {
  ipcMain.handle('saveBase64Image', async (_event, base64: string, fileName: string) => {
    const match = /^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(base64)
    if (!match || !/^\d+\.png$/.test(path.basename(fileName))) throw new Error('Imagem inválida.')
    await fs.mkdir(appPaths.images, { recursive: true })
    const filePath = path.join(appPaths.images, path.basename(fileName))
    await fs.writeFile(filePath, Buffer.from(match[1], 'base64'))
    return { success: true as const, path: filePath }
  })
  ipcMain.handle('fetchItemData', (_event, url: string) => fetchItemData(url))
  ipcMain.handle('getHeroes', () => queryAll<Hero>('SELECT * FROM Heroes ORDER BY Name'))
  ipcMain.handle('getitems', () => queryAll<Item>('SELECT * FROM Item ORDER BY Name'))
  ipcMain.handle('getItemsByHero', (_event, heroId: number) =>
    queryAll<Item>('SELECT * FROM Item WHERE Hero = ? ORDER BY Name', [heroId])
  )
  ipcMain.handle('updateItemPurchased', async (_event, itemId: number, purchased: boolean) => ({
    changes: await execute('UPDATE Item SET Purchased = ? WHERE ItemId = ?', [
      purchased ? 1 : 0,
      itemId
    ])
  }))
  ipcMain.handle(
    'addNewItem',
    async (_event, itemId: number, name: string, owned: boolean, rarity: number, hero: number) => ({
      changes: await execute(
        'INSERT INTO Item (ItemId, Name, Purchased, Rarity, Hero) VALUES (?, ?, ?, ?, ?)',
        [itemId, name, owned ? 1 : 0, rarity, hero]
      )
    })
  )
  ipcMain.handle('getItemData', (_event, itemId: number) =>
    queryAll<ItemHistory>(
      `SELECT ItemCaptured.DateTime, ItemCaptured.ExchangeRate, ItemCaptured.ServiceType, CollectData.Price, CollectData.ItemId FROM CollectData INNER JOIN ItemCaptured ON CollectData.CaptureId = ItemCaptured.CaptureId WHERE ItemCaptured.DateTime != 0 AND CollectData.ItemId = ? ORDER BY date(ItemCaptured.DateTime)`,
      [itemId]
    )
  )
  ipcMain.handle('getItemDataByDate', (_event, date: string) =>
    queryAll<ItemPrice>(latestPricesQuery, [date])
  )
  ipcMain.handle('getItemDataDateNow', () =>
    queryAll<ItemPrice>(latestPricesQuery, [new Date().toISOString().slice(0, 10)])
  )
}
