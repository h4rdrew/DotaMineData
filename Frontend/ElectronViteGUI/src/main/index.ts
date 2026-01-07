import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Sqlite3 from 'sqlite3'
import fs from 'fs'
import { JSDOM } from 'jsdom'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.handle('saveBase64Image', async (_event, base64: string, fileName: string) => {
  try {
    // Remove header "data:image/png;base64,"
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')

    const buffer = Buffer.from(base64Data, 'base64')

    const dir = 'E:\\DotaMine\\img'
    const filePath = path.join(dir, fileName)

    // Garante que a pasta existe
    fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(filePath, buffer)

    return { success: true, path: filePath }
  } catch (error) {
    console.error(error)
    throw error
  }
})

ipcMain.handle('fetchItemData', async (_event, itemURL: string) => {
  // Apenas faz o fetch para a URL, exemplo: https://liquipedia.net/dota2/Item_Name
  try {
    const response = await fetch(itemURL)
    const text = await response.text()

    const dom = new JSDOM(text)
    const document = dom.window.document

    // Nome do item, exemplo: <span class="mw-page-title-main">White Sentry</span>
    const nameMatch = text.match(/<span class="mw-page-title-main">(.*?)<\/span>/)
    const itemName = nameMatch ? nameMatch[1] : 'Unknown'

    // ID do item, exemplo: <div class="infobox-image-text">ID: 6784</div>
    const idMatch = text.match(/<div class="infobox-image-text">ID:\s*(\d+)<\/div>/)
    const itemId = idMatch ? parseInt(idMatch[1], 10) : -1

    // Raridade do item, exemplo: <a href="/dota2/Arcana" title="Arcana">
    const rarityMatch = text.match(
      /<a href="\/dota2\/(Common|Uncommon|Rare|Mythical|Legendary|Ancient|Immortal|Arcana)" title="(Common|Uncommon|Rare|Mythical|Legendary|Ancient|Immortal|Arcana)">/
    )
    const itemRarity = rarityMatch ? rarityMatch[1] : 'Unknown'

    // Nome do heroi, exemplo: <div class="heroes-panel__hero-card"><img alt="" src="/commons/images/thumb/c/c4/Vengeful_Spirit_icon_dota2_gameasset.png/100px-Vengeful_Spirit_icon_dota2_gameasset.png" decoding="async" width="100" height="56" srcset="/commons/images/thumb/c/c4/Vengeful_Spirit_icon_dota2_gameasset.png/150px-Vengeful_Spirit_icon_dota2_gameasset.png 1.5x, /commons/images/thumb/c/c4/Vengeful_Spirit_icon_dota2_gameasset.png/199px-Vengeful_Spirit_icon_dota2_gameasset.png 2x"><div class="heroes-panel__hero-card__title"><a href="/dota2/Vengeful_Spirit" title="Vengeful Spirit">Vengeful Spirit</a></div></div>
    const heroElement = document.querySelector('.heroes-panel__hero-card__title a')
    const itemHero = heroElement?.getAttribute('title') ?? 'Unknown'

    // Monta a URL da imagem do item, exemplo do url: https://liquipedia.net/commons/images/6/6f/Cosmetic_icon_White_Sentry.png
    // Só vai alterar a partir de https://liquipedia.net/commons/images/...
    // exmplo do elemento: <img alt="" src="/commons/images/6/6f/Cosmetic_icon_White_Sentry.png" decoding="async" width="600" height="400">
    const imageMatch = text.match(/src="(\/commons\/images\/[a-zA-Z0-9/_%-]+\.png)"/)
    const imageUrl = imageMatch ? `https://liquipedia.net${imageMatch[1]}` : ''

    // Faz o download da imagem e converte para base64
    let imageB64 = ''
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl)
      const imageBuffer = await imageResponse.arrayBuffer()
      const base64String = Buffer.from(imageBuffer).toString('base64')
      const contentType = imageResponse.headers.get('content-type') || 'image/png'
      imageB64 = `data:${contentType};base64,${base64String}`
    }

    return { id: itemId, name: itemName, imageB64: imageB64, rarity: itemRarity, hero: itemHero }
  } catch (error) {
    console.error('Error fetching item data:', error)
    throw error
  }
})

ipcMain.handle('getitems', async () => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

    db.all('SELECT * FROM Item ORDER BY Name', [], (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
    db.close()
  })
})

ipcMain.handle('updateItemPurchased', async (_event, itemId: number, purchased: boolean) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READWRITE)

    db.run(
      `UPDATE Item
       SET Purchased = ?
       WHERE ItemId = ?`,
      [purchased ? 1 : 0, itemId],
      function (err) {
        if (err) {
          console.error('Erro ao atualizar o DB.')
          reject(err)
        } else {
          console.log(`Sucesso em atualizar o DB. Linhas afetadas: ${this.changes}`)
          resolve({ changes: this.changes })
        }
      }
    )
    db.close()
  })
})

ipcMain.handle(
  'addNewItem',
  async (
    _event,
    itemId: number,
    itemName: string,
    owned: boolean,
    rarity: string,
    hero: string
  ) => {
    return new Promise((resolve, reject) => {
      const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READWRITE)

      db.run(
        `INSERT INTO Item (ItemId, Name, Purchased, Rarity, Hero) VALUES (?, ?, ?, ?, ?)`,
        [itemId, itemName, owned ? 1 : 0, rarity, hero],
        function (err) {
          if (err) {
            console.error('Erro ao inserir no DB.')
            reject(err)
          } else {
            console.log(`Sucesso em inserir no DB. Linhas afetadas: ${this.changes}`)
            resolve({ changes: this.changes })
          }
        }
      )
      db.close()
    })
  }
)

ipcMain.handle('getItemData', async (_event, itemId: number) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

    db.all(
      `SELECT
ItemCaptured.DateTime,
ItemCaptured.ExchangeRate,
ItemCaptured.ServiceType,
CollectData.Price,
CollectData.ItemId
FROM CollectData
INNER JOIN ItemCaptured ON CollectData.CaptureId = ItemCaptured.CaptureId
WHERE ItemCaptured.DateTime != 0
AND CollectData.ItemId = ?
ORDER BY date(ItemCaptured.DateTime)
      `,
      [`${itemId}`],
      (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      }
    )
    db.close()
  })
})

ipcMain.handle('getItemDataByDate', async (_event, dateString: string) => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

    db.all(
      `WITH UltimoCapture AS (
    SELECT
        cd.ItemId,
        cd.Price,
        ic.ServiceType,
        ROW_NUMBER() OVER (
            PARTITION BY cd.ItemId, ic.ServiceType
            ORDER BY ic.DateTime DESC
        ) AS rn
    FROM CollectData cd
    JOIN ItemCaptured ic
        ON cd.CaptureId = ic.CaptureId
    WHERE ic.ServiceType IN (1, 2)
      AND DATE(ic.DateTime) = DATE(?)
)
SELECT ServiceType, Price, ItemId
FROM UltimoCapture
WHERE rn = 1
ORDER BY ItemId, ServiceType;
      `,
      [dateString],
      (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      }
    )
    db.close()
  })
})

ipcMain.handle('getItemDataDateNow', async () => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

    db.all(
      `WITH UltimoCapture AS (
    SELECT
        cd.ItemId,
        cd.Price,
        ic.ServiceType,
        ROW_NUMBER() OVER (
            PARTITION BY cd.ItemId, ic.ServiceType
            ORDER BY ic.DateTime DESC
        ) AS rn
    FROM CollectData cd
    JOIN ItemCaptured ic
        ON cd.CaptureId = ic.CaptureId
    WHERE ic.ServiceType IN (1, 2)
      AND DATE(ic.DateTime) = DATE('now', 'localtime')
)
SELECT ServiceType, Price, ItemId
FROM UltimoCapture
WHERE rn = 1
ORDER BY ItemId, ServiceType;
      `,
      [],
      (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      }
    )
    db.close()
  })
})

// Expor o caminho das imagens
ipcMain.handle('getImagePath', (event, itemId) => {
  const imagePath = path.join('E:\\DotaMine\\img', `${itemId}.png`)
  return fs.existsSync(imagePath) ? `file://${imagePath}` : null
})
