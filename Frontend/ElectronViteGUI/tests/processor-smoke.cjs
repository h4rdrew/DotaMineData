const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { test } = require('node:test')

const executable = path.resolve(__dirname, '../processor/ProcessaDados.App.exe')
const directory = mkdtempSync(path.join(os.tmpdir(), 'dotamine-processor-test-'))
const database = path.join(directory, 'empty database.db')
writeFileSync(database, '')
function run(args) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000
  })
  assert.ifError(result.error)
  const events = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('@dotamine:'))
    .map((line) => JSON.parse(line.slice(10)))
  return { code: result.status, events, final: events.at(-1) }
}

test('published Release handles an empty database without network or console input', () => {
  const result = run(['--integrated', '--database', database])
  assert.equal(result.code, 0)
  assert.equal(result.final.status, 'completed')
  assert.equal(result.events.filter((event) => event.type === 'progress' && event.saved).length, 2)
})
test('selected item is filtered before collection and invalid input returns structured errors', () => {
  const missing = run(['--integrated', '--database', database, '--item-id', '123'])
  assert.equal(missing.code, 1)
  assert.match(missing.final.message, /não encontrado/)
  const invalid = run(['--integrated', '--database', database, '--item-id', '-1'])
  assert.equal(invalid.code, 1)
  assert.equal(invalid.final.status, 'error')
  const absent = run(['--integrated', '--database', path.join(directory, 'missing.db')])
  assert.equal(absent.code, 1)
})
