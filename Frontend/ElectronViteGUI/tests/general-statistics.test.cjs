const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const api = {}
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(path.join(__dirname, '../src/renderer/src/utils/generalStatistics.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports: api }
)
const items = [
  { ItemId: 1, Name: 'Owned', Purchased: 1 },
  { ItemId: 2, Name: 'Wishlist', Purchased: 0 },
  { ItemId: 3, Name: 'Missing', Purchased: false }
]
const row = (ItemId, ServiceType, DateTime, Price) => ({ ItemId, ServiceType, DateTime, Price })

test('general history query returns last valid daily captures within 30 days', () => {
  const source = readFileSync(path.join(__dirname, '../src/main/ipc.ts'), 'utf8')
  const sql = source.match(/`(WITH DailyPrices AS [\s\S]*?)`/)[1]
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`
      CREATE TABLE ItemCaptured (CaptureId TEXT, ServiceType INTEGER, DateTime TEXT, ExchangeRate REAL);
      CREATE TABLE CollectData (Id INTEGER PRIMARY KEY, CaptureId TEXT, ItemId INTEGER, Price REAL);
      INSERT INTO ItemCaptured VALUES
        ('old', 1, '2026-08-30', 1), ('start', 1, '2026-08-31', 1),
        ('a', 1, '2026-09-30 10:00', 1), ('b', 1, '2026-09-30 12:00', 1),
        ('invalid', 1, '2026-09-30 13:00', 1), ('future', 1, '2026-10-01', 1),
        ('other', 2, '2026-09-30', 1);
      INSERT INTO CollectData (CaptureId, ItemId, Price) VALUES
        ('old', 1, 999), ('start', 1, 100), ('a', 1, 70), ('b', 1, 80),
        ('invalid', 1, 0), ('future', 1, 1), ('other', 1, 90);
    `)
    const rows = db.prepare(sql).all('2026-09-30', '2026-09-30')
    assert.equal(rows.length, 3)
    assert.deepEqual(
      rows.map((row) => row.Price),
      [100, 80, 90]
    )
    assert.equal(rows[0].DateTime, '2026-08-31')
  } finally {
    db.close()
  }
})

test('compares each market separately, deduplicates days and excludes invalid prices', () => {
  const { movements } = api.generalStatistics(
    items,
    [
      row(1, 1, '2026-09-27 09:00', 10),
      row(1, 1, '2026-09-27 12:00', 100),
      row(1, 1, '2026-09-28', 90),
      row(1, 1, '2026-09-30', 80),
      row(1, 1, '2026-09-30 18:00', 0),
      row(1, 1, '2026-09-30 19:00', NaN),
      row(1, 2, '2026-09-27', 50),
      row(1, 2, '2026-09-30', 75),
      row(2, 1, '2026-09-29', 25),
      row(2, 1, '2026-09-29 12:00', 20)
    ].reverse(),
    '2026-09-30',
    3,
    'all'
  )
  assert.equal(movements.length, 2)
  const steam = movements.find((entry) => entry.service === 1)
  assert.equal(steam.first, 100)
  assert.equal(steam.last, 80)
  assert.equal(steam.percent, -20)
  assert.equal(steam.drops, 2)
  assert.equal(steam.observations, 3)
  assert.equal(movements.find((entry) => entry.service === 2).percent, 50)
})

test('all periods use calendar boundaries and never import old or future prices', () => {
  const history = [
    row(1, 1, '2026-08-30', 999),
    row(1, 1, '2026-10-01', 1),
    ...['2026-08-31', '2026-09-20', '2026-09-25', '2026-09-27', '2026-09-30'].map((date, i) =>
      row(1, 1, date, 100 - i * 10)
    )
  ]
  for (const [period, first] of [
    [3, 70],
    [5, 80],
    [10, 90],
    [30, 100]
  ]) {
    const result = api.generalStatistics(items, history, '2026-09-30', period, 'all')
    assert.equal(result.movements[0].first, first)
    assert.equal(result.movements[0].last, 60)
  }
})

test('ownership handles SQLite booleans and sparse history remains explicit', () => {
  const history = items.flatMap((item) => [
    row(item.ItemId, 2, '2026-09-28', 100),
    row(item.ItemId, 2, '2026-09-30', 90)
  ])
  const owned = api.generalStatistics(items, history, '2026-09-30', 3, 'owned')
  const unowned = api.generalStatistics(items, history, '2026-09-30', 3, 'unowned')
  assert.equal(owned.items, 1)
  assert.equal(owned.movements[0].item.ItemId, 1)
  assert.equal(unowned.items, 2)
  assert.equal(unowned.movements.length, 2)
  assert.equal(owned.movements[0].firstDate, '2026-09-28')
  assert.equal(api.generalStatistics(items, [], '2026-09-30', 3, 'all').movements.length, 0)
})
