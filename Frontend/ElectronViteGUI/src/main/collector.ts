import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { appPaths } from './config'
import { initialCollectorState, type CollectorState, type Market } from '../shared/collector'

let state: CollectorState = structuredClone(initialCollectorState)
let child: ChildProcess | undefined

function isCollecting(): boolean {
  return state.status === 'running' || state.status === 'cancelling'
}

function publish(next: CollectorState): void {
  state = { ...next, revision: state.revision + 1 }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('collector:state', state)
  }
}

export function registerCollector(): void {
  app.on('browser-window-created', (_event, window) => {
    window.on('close', (event) => {
      if (isCollecting()) {
        event.preventDefault()
        publish({
          ...state,
          message: 'Aguarde a atualização terminar antes de fechar o aplicativo.'
        })
      }
    })
  })
  ipcMain.handle('collector:state', () => state)
  ipcMain.handle('collector:cancel', async () => {
    if (state.status !== 'running' || !child?.stdin?.writable) return state
    const stream = child.stdin
    const runId = state.runId
    publish({
      ...state,
      status: 'cancelling',
      message: 'Cancelando e salvando os preços já coletados…'
    })
    await new Promise<void>((resolve, reject) => {
      stream.write('cancel\n', (error) => {
        if (error) {
          if (state.runId === runId && state.status === 'cancelling') {
            publish({
              ...state,
              status: 'running',
              message: 'Não foi possível enviar o cancelamento. Tente novamente.'
            })
          }
          reject(error)
        } else resolve()
      })
    })
    return state
  })
  ipcMain.handle('collector:start', (_event, itemId?: number) => {
    if (isCollecting()) throw new Error('Uma atualização já está em andamento.')
    if (itemId !== undefined && (!Number.isSafeInteger(itemId) || itemId <= 0)) {
      throw new Error('Item inválido.')
    }
    const executable =
      process.env.DOTAMINE_PROCESSOR_PATH ??
      path.join(
        app.isPackaged ? process.resourcesPath : app.getAppPath(),
        'processor',
        'ProcessaDados.App.exe'
      )
    if (!existsSync(executable)) {
      throw new Error(
        'ProcessaDados não encontrado. Execute npm run prepare:processor ou configure DOTAMINE_PROCESSOR_PATH.'
      )
    }
    if (!existsSync(appPaths.database))
      throw new Error('O banco de dados configurado não foi encontrado.')
    publish({
      ...structuredClone(initialCollectorState),
      runId: randomUUID(),
      itemId,
      status: 'running',
      message: 'Preparando a coleta…',
      revision: state.revision
    })
    const args = ['--integrated', '--database', path.resolve(appPaths.database)]
    const runId = state.runId
    if (itemId !== undefined) args.push('--item-id', String(itemId))
    let result:
      | { status: 'completed' | 'partial' | 'error' | 'cancelled'; message: string }
      | undefined
    let diagnostics = ''
    const browsers = path.join(path.dirname(executable), 'browsers')
    try {
      child = spawn(executable, args, {
        cwd: path.dirname(executable),
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...(existsSync(browsers) ? { PLAYWRIGHT_BROWSERS_PATH: browsers } : {})
        }
      })
      const lines = createInterface({ input: child.stdout! })
      // A process exiting while cancel is being written can close stdin first.
      child.stdin!.on('error', () => {})
      lines.on('line', (line) => {
        if (state.runId !== runId) return
        if (!line.startsWith('@dotamine:')) return
        try {
          const event = JSON.parse(line.slice('@dotamine:'.length))
          if (
            event.type === 'progress' &&
            (event.market === 'steam' || event.market === 'dmarket')
          ) {
            const { completed, total, failed, saved } = event
            if (
              ![completed, total, failed].every(Number.isSafeInteger) ||
              total < 0 ||
              completed < 0 ||
              completed > total ||
              failed < 0 ||
              failed > completed ||
              typeof saved !== 'boolean'
            )
              return
            const market: Market = event.market
            publish({
              ...state,
              message: state.status === 'cancelling' ? state.message : 'Atualizando preços…',
              markets: {
                ...state.markets,
                [market]: { completed, total, failed, saved }
              }
            })
          } else if (
            event.type === 'result' &&
            ['completed', 'partial', 'error', 'cancelled'].includes(event.status) &&
            typeof event.message === 'string'
          ) {
            result = { status: event.status, message: event.message }
          }
        } catch {
          /* Ignore output that is not a protocol event. */
        }
      })
      child.stderr!.setEncoding('utf8')
      child.stderr!.on('data', (chunk: string) => {
        diagnostics = (diagnostics + chunk).slice(-2000)
      })
      child.on('error', (error) => {
        if (state.runId !== runId) return
        publish({
          ...state,
          status: 'error',
          message: `Não foi possível iniciar a coleta: ${error.message}`
        })
      })
      child.on('close', (code) => {
        lines.close()
        if (state.runId !== runId) return
        child = undefined
        if (!isCollecting()) return
        const validResult =
          result &&
          ((code === 0 && result.status === 'completed') ||
            (code === 2 && result.status === 'partial') ||
            (code === 3 && result.status === 'cancelled') ||
            result.status === 'error')
        publish({
          ...state,
          ...(validResult
            ? result!
            : {
                status: 'error' as const,
                message: `A coleta foi interrompida (código ${code ?? 'desconhecido'}). ${diagnostics.trim() || 'Verifique a instalação do ProcessaDados.'}`
              })
        })
      })
    } catch (error) {
      child = undefined
      publish({ ...state, status: 'error', message: String(error) })
    }
    return state
  })
  // Let the collectors finish saving instead of leaving an orphaned browser/process.
  app.on('before-quit', (event) => {
    if (isCollecting()) {
      event.preventDefault()
      for (const window of BrowserWindow.getAllWindows()) window.show()
    }
  })
}
