const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { app, BrowserWindow, ipcMain } = require('electron')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dotamine-ui-test-')))
app.disableHardwareAcceleration()
const market = { completed: 0, total: 0, failed: 0, saved: false }
let state = {
  revision: 0,
  runId: null,
  status: 'idle',
  message: '',
  markets: { steam: { ...market }, dmarket: { ...market } }
}
const starts = []
let historyReads = 0
let priceReads = 0
const item = { Id: 1, ItemId: 123, Name: 'Item de teste', Purchased: false, Hero: 0 }
const deadline = setTimeout(() => {
  console.error('UI test timeout')
  app.exit(1)
}, 30000)

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      width: 1100,
      height: 650,
      webPreferences: {
        preload: path.resolve(__dirname, '../out/preload/index.js'),
        sandbox: false,
        offscreen: true,
        backgroundThrottling: false
      }
    })
    window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: /^https?:/.test(details.url) })
    })
    ipcMain.handle('getHeroes', () => [])
    ipcMain.handle('getitems', () => [item])
    ipcMain.handle('getItemDataDateNow', () => [])
    ipcMain.handle('getItemDataByDate', () => {
      priceReads++
      return []
    })
    ipcMain.handle('getItemData', () => {
      historyReads++
      return []
    })
    ipcMain.handle('collector:state', () => state)
    ipcMain.handle('collector:cancel', () => {
      state = {
        ...state,
        revision: state.revision + 1,
        status: 'cancelling',
        message: 'Cancelando…'
      }
      return state
    })
    ipcMain.handle('collector:start', (_event, itemId) => {
      starts.push(itemId)
      state = {
        ...state,
        revision: state.revision + 1,
        runId: String(starts.length),
        itemId,
        status: 'running',
        message: 'Atualizando preços…',
        markets: { steam: { ...market, total: 10 }, dmarket: { ...market, total: 10 } }
      }
      return state
    })
    const evaluate = (source) => window.webContents.executeJavaScript(source)
    async function waitFor(source) {
      for (let attempt = 0; attempt < 200; attempt++) {
        if (await evaluate(source)) return
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      throw new Error(`UI condition not met: ${source}`)
    }
    function publish(changes) {
      state = { ...state, ...changes, revision: state.revision + 1 }
      window.webContents.send('collector:state', state)
    }
    await window.loadFile(path.resolve(__dirname, '../out/renderer/index.html'))
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.textContent === 'Atualizar este item')"
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].find(b => b.textContent === 'Atualizar este item').disabled"
      ),
      true
    )
    await evaluate('document.querySelector(\'[aria-label="open drawer"]\').click()')
    await waitFor("document.querySelector('.market_listing_row_link') !== null")
    await evaluate("document.querySelector('.market_listing_row_link').click()")
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.textContent === 'Atualizar este item' && !b.disabled)"
    )
    await evaluate(
      "[...document.querySelectorAll('button')].find(b => b.textContent === 'Atualizar este item').click()"
    )
    await waitFor("document.querySelectorAll('[role=progressbar]').length === 2")
    assert.deepEqual(starts, [123])
    publish({
      markets: {
        steam: { completed: 2, total: 10, failed: 0, saved: false },
        dmarket: { completed: 8, total: 10, failed: 1, saved: false }
      }
    })
    await waitFor(
      "document.querySelector('[aria-label=\"Progresso Steam\"]').getAttribute('aria-valuenow') === '20'"
    )
    const bars =
      await evaluate(`Array.from(document.querySelectorAll('[role=progressbar]')).map(b => ({
    value: b.getAttribute('aria-valuenow'), color: getComputedStyle(b.firstElementChild).backgroundColor
  }))`)
    assert.deepEqual(bars, [
      { value: '20', color: 'rgb(66, 165, 245)' },
      { value: '80', color: 'rgb(76, 175, 80)' }
    ])
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].find(b => b.textContent === 'Atualizar este item').disabled"
      ),
      true
    )
    assert.equal(await evaluate("document.querySelector('main [role=progressbar]') === null"), true)
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].some(b => b.textContent === 'Atualizar todos os itens')"
      ),
      false
    )
    await evaluate(
      "[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'Fechar').click()"
    )
    await waitFor("document.querySelector('[role=dialog]') === null")
    assert.equal(state.status, 'running')
    assert.equal(
      await evaluate(
        'document.querySelector(\'[aria-label="Ver progresso da atualização"]\').textContent'
      ),
      'Atualizando dados…'
    )
    publish({
      markets: {
        steam: { completed: 4, total: 10, failed: 0, saved: false },
        dmarket: { completed: 9, total: 10, failed: 1, saved: false }
      }
    })
    await evaluate(
      'document.querySelector(\'[aria-label="Ver progresso da atualização"]\').click()'
    )
    await waitFor(
      "document.querySelector('[aria-label=\"Progresso Steam\"]')?.getAttribute('aria-valuenow') === '40'"
    )
    assert.deepEqual(starts, [123])
    await new Promise((resolve) => setTimeout(resolve, 300))
    fs.mkdirSync(path.resolve(__dirname, '../.integration-staging'), { recursive: true })
    fs.writeFileSync(
      path.resolve(__dirname, '../.integration-staging/collection-progress.png'),
      (await window.webContents.capturePage()).toPNG()
    )
    publish({ status: 'partial', message: 'Coleta finalizada com itens sem preço.' })
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.textContent === 'Atualizar este item' && !b.disabled)"
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal(priceReads, 1)
    assert.equal(historyReads, 2)
    await evaluate(
      "[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'Fechar').click()"
    )
    await waitFor("document.querySelector('[role=dialog]') === null")
    await evaluate("document.querySelector('#basic-button').click()")
    await waitFor("document.querySelector('[role=menu]') !== null")
    await evaluate(
      "[...document.querySelectorAll('[role=menuitem]')].find(b => b.textContent === 'Atualizar todos os itens').click()"
    )
    await waitFor("document.body.textContent.includes('Atualizando — todos os itens')")
    assert.deepEqual(starts, [123, undefined])
    await evaluate('document.querySelector(\'[aria-label="Recolher atualização"]\').click()')
    await waitFor("document.querySelectorAll('[role=progressbar]').length === 0")
    await evaluate(
      "[...document.querySelectorAll('button')].find(b => b.textContent === 'Cancelar atualização').click()"
    )
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.textContent === 'Cancelando…' && b.disabled)"
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].find(b => b.textContent === 'Atualizar este item').disabled"
      ),
      true
    )
    publish({ status: 'cancelled', message: 'Atualização cancelada. Preços coletados salvos.' })
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.textContent === 'Atualizar este item' && !b.disabled)"
    )
    console.log(
      'UI OK: item/all buttons, Steam 20% blue, DMarket 80% green, disabled state and data refresh.'
    )
    clearTimeout(deadline)
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    app.exit(1)
  })
