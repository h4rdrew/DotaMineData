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
    ipcMain.handle('getitems', () => [
      item,
      { ...item, ItemId: 124, Name: 'Z Alta' },
      { ...item, ItemId: 125, Name: 'Z Queda' },
      { ...item, ItemId: 126, Name: 'Z Sem histórico' }
    ])
    ipcMain.handle('getItemDataDateNow', () => [
      { ItemId: 123, ServiceType: 1, Price: 170, PreviousPrice: 160 },
      { ItemId: 123, ServiceType: 2, Price: 100, PreviousPrice: 100 },
      { ItemId: 124, ServiceType: 2, Price: 120, PreviousPrice: 100 },
      { ItemId: 125, ServiceType: 2, Price: 90, PreviousPrice: 100 }
    ])
    ipcMain.handle('getItemDataByDate', () => {
      priceReads++
      return []
    })
    ipcMain.handle('getItemData', () => {
      historyReads++
      return ['2026-01-01', '2026-09-24', '2026-09-25'].flatMap((date, index) => [
        { ItemId: 123, ServiceType: 1, Price: 3.91, DateTime: `${date} 09:00:00`, ExchangeRate: 1 },
        {
          ItemId: 123,
          ServiceType: 1,
          Price: 150 + index * 10,
          DateTime: `${date} 12:00:00`,
          ExchangeRate: 1
        },
        { ItemId: 123, ServiceType: 2, Price: 100 + index * 10, DateTime: date, ExchangeRate: 1 }
      ])
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
      "[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Atualizar este item')"
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Atualizar este item').disabled"
      ),
      true
    )
    await evaluate('document.querySelector(\'[aria-label="open drawer"]\').click()')
    await waitFor("document.querySelector('.market_listing_row_link') !== null")
    const sortChange = `document.querySelector('.market_listing_table_header [role="button"]').click()`
    const rowNames = `[...document.querySelectorAll('.market_listing_item_name')].map(el => el.textContent)`
    await evaluate(sortChange)
    assert.deepEqual(await evaluate(rowNames), ['Z Alta', item.Name, 'Z Queda', 'Z Sem histórico'])
    await evaluate(sortChange)
    assert.deepEqual(await evaluate(rowNames), ['Z Queda', item.Name, 'Z Alta', 'Z Sem histórico'])
    await evaluate(sortChange)
    assert.deepEqual(await evaluate(rowNames), ['Z Alta', item.Name, 'Z Queda', 'Z Sem histórico'])
    assert.equal(
      await evaluate("getComputedStyle(document.querySelector('#tab-1')).display"),
      'none'
    )
    await evaluate("document.querySelectorAll('.tablinks')[1].click()")
    assert.equal(
      await evaluate("getComputedStyle(document.querySelector('#tab-0')).display"),
      'none'
    )
    await evaluate("document.querySelectorAll('.tablinks')[0].click()")
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(
      await evaluate(`(() => {
        const table = document.querySelector('#searchResults').getBoundingClientRect()
        const drawer = document.querySelector('.MuiDrawer-paper').getBoundingClientRect()
        const main = document.querySelector('main').getBoundingClientRect()
        return Math.abs(table.width - drawer.width) < 2 && main.left >= drawer.right - 1
      })()`),
      true
    )
    await evaluate("document.querySelector('[data-sorttype=name]').click()")
    await evaluate("document.querySelector('.market_listing_row_link').click()")
    await waitFor("document.querySelectorAll('main canvas').length === 3")
    assert.equal(
      await evaluate("document.querySelector('#tab-0').textContent.includes('Menor preço')"),
      true
    )
    assert.equal(
      await evaluate(
        "document.querySelector('#tab-0').textContent.includes('Na mínima histórica')"
      ),
      true
    )
    assert.equal(
      await evaluate(
        "document.querySelector('#tab-0').textContent.includes('+13% acima da mínima histórica')"
      ),
      true
    )
    await evaluate("document.querySelector('#price-tab-1').click()")
    assert.equal(
      await evaluate(
        "document.querySelector('#tab-1').textContent.includes('Registrado em 01/01/2026')"
      ),
      true
    )
    assert.equal(
      await evaluate("document.querySelector('#tab-1 a').getAttribute('href')"),
      '#item-price-history'
    )
    await evaluate("document.querySelector('#price-tab-0').click()")
    window.setSize(1600, 1000)
    await new Promise((resolve) => setTimeout(resolve, 400))
    fs.mkdirSync(path.resolve(__dirname, '../.integration-staging'), { recursive: true })
    fs.writeFileSync(
      path.resolve(__dirname, '../.integration-staging/price-overview.png'),
      (await window.webContents.capturePage()).toPNG()
    )
    window.setSize(1100, 650)
    assert.equal(await evaluate("document.body.textContent.includes('3 dias com preço')"), true)
    await evaluate(
      "[...document.querySelectorAll('button')].find(b => b.textContent === '30 dias').click()"
    )
    await waitFor("document.body.textContent.includes('2 dias com preço')")
    await evaluate(
      "[...document.querySelectorAll('button')].find(b => b.textContent === 'Tudo').click()"
    )
    await waitFor("document.body.textContent.includes('3 dias com preço')")
    assert.equal(
      await evaluate(
        'document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth'
      ),
      true
    )
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Atualizar este item' && !b.disabled)"
    )
    await evaluate(
      "[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Atualizar este item').click()"
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
        "[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Atualizar este item').disabled"
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
      "[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Atualizar este item' && !b.disabled)"
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
        "[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Atualizar este item').disabled"
      ),
      true
    )
    publish({ status: 'cancelled', message: 'Atualização cancelada. Preços coletados salvos.' })
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Atualizar este item' && !b.disabled)"
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
