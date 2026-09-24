import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project =
  process.env.DOTAMINE_PROCESSOR_PROJECT ??
  path.resolve(root, '../../ProcessaDados/ProcessaDados.App/ProcessaDados.App.csproj')
const output = path.join(root, 'processor')
if (process.platform !== 'win32')
  throw new Error('A integração com ProcessaDados é preparada no Windows.')
if (!existsSync(project)) throw new Error(`Projeto ProcessaDados não encontrado: ${project}`)
mkdirSync(output, { recursive: true })

function run(executable, args, env = process.env) {
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('dotnet', [
  'publish',
  project,
  '-c',
  'Release',
  '-r',
  'win-x64',
  '--self-contained',
  'true',
  '-o',
  output,
  '-v',
  'quiet',
  '-clp:ErrorsOnly'
])
run(
  path.join(output, '.playwright/node/win32_x64/node.exe'),
  [path.join(output, '.playwright/package/cli.js'), 'install', 'chromium', '--only-shell'],
  { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(output, 'browsers') }
)
console.log(`ProcessaDados Release pronto: ${output}`)
