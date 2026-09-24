const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

function load(file, dependencies) {
  const source = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
    process,
    structuredClone,
    console
  })
  return exports
}

function setup() {
  const handlers = new Map()
  const app = Object.assign(new EventEmitter(), { isPackaged: false, getAppPath: () => 'C:/app' })
  const subprocess = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough()
  })
  const messages = []
  const calls = []
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: { send: (_channel, state) => messages.push(state) }
  })
  const shared = load('src/shared/collector.ts', {})
  load('src/main/collector.ts', {
    electron: {
      app,
      BrowserWindow: { getAllWindows: () => [window] },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) }
    },
    'node:child_process': {
      spawn: (...args) => {
        calls.push(args)
        return subprocess
      }
    },
    'node:fs': { existsSync: () => true },
    './config': { appPaths: { database: 'C:/data/items.db' } },
    '../shared/collector': shared
  }).registerCollector()
  app.emit('browser-window-created', {}, window)
  return {
    start: (id) => handlers.get('collector:start')({}, id),
    cancel: () => handlers.get('collector:cancel')(),
    state: () => handlers.get('collector:state')(),
    subprocess,
    calls,
    messages,
    window,
    event: (value) => subprocess.stdout.write(`@dotamine:${JSON.stringify(value)}\n`)
  }
}

test('cancels cooperatively, blocks restarts until exit and retains saved progress', async () => {
  const h = setup()
  h.start()
  h.event({ type: 'progress', market: 'dmarket', completed: 2, total: 10, failed: 0, saved: false })
  await h.cancel()
  assert.equal(h.subprocess.stdin.read().toString(), 'cancel\n')
  assert.equal(h.state().status, 'cancelling')
  assert.throws(() => h.start(), /andamento/)
  await h.cancel()
  assert.equal(h.subprocess.stdin.read(), null)
  h.event({ type: 'progress', market: 'dmarket', completed: 2, total: 10, failed: 0, saved: true })
  assert.match(h.state().message, /Cancelando/)
  h.event({ type: 'result', status: 'cancelled', message: 'Cancelada.' })
  h.subprocess.emit('close', 3)
  assert.equal(h.state().status, 'cancelled')
  assert.equal(h.state().markets.dmarket.saved, true)
  h.start()
  assert.equal(h.state().status, 'running')
})

test('natural completion wins when cancel arrives after the work has finished', async () => {
  const h = setup()
  h.start()
  h.event({ type: 'result', status: 'completed', message: 'Salvo.' })
  await h.cancel()
  h.subprocess.emit('close', 0)
  assert.equal(h.state().status, 'completed')
})

test('runs only one collection and passes the selected item as an argument', () => {
  const h = setup()
  h.start(123)
  assert.equal(h.state().status, 'running')
  assert.deepEqual(Array.from(h.calls[0][1]).slice(-2), ['--item-id', '123'])
  assert.equal(h.calls[0][2].shell, false)
  assert.equal(h.calls[0][2].windowsHide, true)
  assert.throws(() => h.start(), /andamento/)
  let prevented = false
  h.window.emit('close', {
    preventDefault: () => {
      prevented = true
    }
  })
  assert.equal(prevented, true)
})

test('streams independent progress, ignores malformed events and waits for process exit', () => {
  const h = setup()
  h.start()
  h.subprocess.stdout.write('log line\n@dotamine:{invalid}\n@dotamine:')
  h.subprocess.stdout.write(
    JSON.stringify({
      type: 'progress',
      market: 'steam',
      completed: 2,
      total: 10,
      failed: 1,
      saved: false
    }) + '\n'
  )
  h.event({ type: 'progress', market: 'dmarket', completed: 8, total: 10, failed: 0, saved: false })
  h.event({ type: 'progress', market: 'steam', completed: 99, total: 10, failed: 0, saved: false })
  assert.equal(h.state().markets.steam.completed, 2)
  assert.equal(h.state().markets.dmarket.completed, 8)
  h.event({ type: 'result', status: 'partial', message: 'Alguns itens sem preço.' })
  assert.equal(h.state().status, 'running')
  h.subprocess.emit('close', 2)
  assert.equal(h.state().status, 'partial')
  h.start()
  assert.equal(h.state().markets.steam.completed, 0)
})

test('rejects invalid identifiers and treats missing or inconsistent results as failure', () => {
  const h = setup()
  for (const id of [0, -1, '123', 1.5, NaN]) assert.throws(() => h.start(id), /inválido/)
  h.start()
  h.subprocess.emit('close', 0)
  assert.equal(h.state().status, 'error')
  const other = setup()
  other.start()
  other.event({ type: 'result', status: 'completed', message: 'ok' })
  other.subprocess.emit('close', 1)
  assert.equal(other.state().status, 'error')
})

test('handles launch failures and successful completion', () => {
  const h = setup()
  h.start()
  h.subprocess.emit('error', new Error('ENOENT'))
  h.subprocess.emit('close', -1)
  assert.match(h.state().message, /ENOENT/)
  const success = setup()
  success.start()
  success.event({ type: 'result', status: 'completed', message: 'Salvo.' })
  success.subprocess.emit('close', 0)
  assert.equal(success.state().status, 'completed')
})
