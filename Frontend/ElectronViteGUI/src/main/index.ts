import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Sqlite3 from 'sqlite3'
import fs from 'fs'

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

ipcMain.handle('getitems', async () => {
  return new Promise((resolve, reject) => {
    const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

    db.all('SELECT * FROM Item ORDER BY Name', [], (err, rows) => {
      if (err) {
        console.error('Erro ao ler o DB.')
        reject(err)
      } else {
        console.log('Sucesso em ler o DB.')
        resolve(rows)
      }
    })
    db.close()
  })
})

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
          console.error('Erro ao ler o DB.')
          reject(err)
        } else {
          console.log('Sucesso em ler o DB.')
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

// async function loadDB(): Promise<unknown> {
//   return new Promise((resolve, reject) => {
//     const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

//     db.all('SELECT * FROM Item', [], (err, rows) => {
//       if (err) {
//         console.error('Erro ao ler o DB.')
//         reject(err)
//       } else {
//         console.log('Sucesso em ler o DB.')
//         resolve(rows)
//       }
//     })
//     db.close()
//   })
// }

// ipcMain.handle('get-chart-data', async () => loadDB())

// function loadDB(): void {
//   ipcMain.handle('get-chart-data', async () => {
//     return new Promise((resolve, reject) => {
//       const db = new Sqlite3.Database('E:\\dotaItemCollectData.db', Sqlite3.OPEN_READONLY)

//       db.all('SELECT * FROM Item', [], (err, rows) => {
//         if (err) {
//           console.error('Erro ao ler o DB.')
//           reject(err)
//         } else {
//           console.log('Sucesso em ler o DB.')
//           resolve(rows)
//         }
//       })
//       db.close()
//     })
//   })
// }
