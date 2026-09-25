const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

test('prices compare successive captures per item and market, including previous days', () => {
  const source = readFileSync(path.join(__dirname, '../src/main/ipc.ts'), 'utf8')
  const sql = source.match(/const latestPricesQuery = `([\s\S]*?)`/)[1]
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`
      CREATE TABLE ItemCaptured (CaptureId TEXT, ServiceType INTEGER, DateTime TEXT);
      CREATE TABLE CollectData (Id INTEGER PRIMARY KEY, CaptureId TEXT, ItemId INTEGER, Price REAL);
      INSERT INTO ItemCaptured VALUES
        ('a', 2, '2026-09-23 10:00:00'), ('b', 2, '2026-09-25 10:00:00'),
        ('c', 2, '2026-09-25 12:00:00'), ('d', 1, '2026-09-25 13:00:00'),
        ('e', 2, '2026-09-26 10:00:00');
      INSERT INTO CollectData (CaptureId, ItemId, Price) VALUES
        ('a', 1, 100), ('b', 1, 120), ('c', 1, 90), ('d', 1, 500), ('e', 1, 200),
        ('a', 2, 50), ('b', 2, 60), ('b', 3, 30), ('a', 4, 40);
    `)
    const rows = db.prepare(sql).all('2026-09-25', '2026-09-25')
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [
        { ServiceType: 1, Price: 500, ItemId: 1, PreviousPrice: null },
        { ServiceType: 2, Price: 90, ItemId: 1, PreviousPrice: 120 },
        { ServiceType: 2, Price: 60, ItemId: 2, PreviousPrice: 50 },
        { ServiceType: 2, Price: 30, ItemId: 3, PreviousPrice: null }
      ]
    )
    const historical = db.prepare(sql).all('2026-09-23', '2026-09-23')
    assert.ok(historical.every((row) => row.PreviousPrice === null))
  } finally {
    db.close()
  }
})

test('DMarket change displays direction, percentage, unchanged and missing data', () => {
  const source = readFileSync(
    path.join(__dirname, '../src/renderer/src/components/DmarketPriceChange.tsx'),
    'utf8'
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, require })
  const render = (Price, PreviousPrice) =>
    renderToStaticMarkup(
      React.createElement(exports.DmarketPriceChange, {
        data: [{ ItemId: 1, ServiceType: 2, Price, PreviousPrice }]
      })
    )
  assert.match(render(120, 100), /Variação DMarket: \+20%/)
  assert.doesNotMatch(render(120, 100), /<svg/)
  assert.match(render(90, 120), /Variação DMarket: −25%/)
  assert.doesNotMatch(render(90, 120), /<svg/)
  assert.match(render(100, 100), /Variação DMarket: 0%/)
  assert.doesNotMatch(render(100, 100), /Arrow(?:Upward|Downward)Icon/)
  for (const [current, previous] of [
    [100, null],
    [100, 0],
    [0, 100],
    [100, undefined]
  ]) {
    assert.match(render(current, previous), /Sem capturas válidas para comparação/)
  }
})
