const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const compiled = ts.transpileModule(
  readFileSync(path.join(__dirname, '../src/renderer/src/utils/priceStatistics.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText
const api = {}
vm.runInNewContext(compiled, { exports: api })

test('daily prices use last valid capture per market without filling missing days', () => {
  const row = (DateTime, ServiceType, Price) => ({ DateTime, ServiceType, Price, ItemId: 1 })
  const result = api.dailyPrices([
    row('2026-09-25 18:00:00', 2, 120),
    row('2026-09-25 10:00:00', 2, 100),
    row('2026-09-25 19:00:00', 2, 0),
    row('2026-09-23 10:00:00', 1, 80),
    row('2026-09-25 10:00:00', 1, 150),
    row('invalid', 2, 1),
    row('2026-09-26 10:00:00', 2, NaN)
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [
    { date: '2026-09-23', steam: 80, dmarket: null },
    { date: '2026-09-25', steam: 150, dmarket: 120 }
  ])
})

test('summary excludes missing and invalid prices and handles empty history', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.priceSummary([100, null, 200, 0, NaN, -1]))), {
    min: 100,
    max: 200,
    average: 150,
    count: 2
  })
  assert.equal(api.priceSummary([]), null)
})
