import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import {
  initializeAutoUpdates,
  type UpdateDialogLike,
  type UpdateLogger,
  type UpdaterLike,
} from '../src/autoUpdate'

function nextTurn(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise))
}

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = true
  autoInstallOnAppQuit = false
  checkCalls = 0
  downloadCalls = 0
  quitCalls = 0
  checkError: Error | null = null
  downloadError: Error | null = null

  async checkForUpdates(): Promise<void> {
    this.checkCalls += 1
    if (this.checkError) throw this.checkError
  }

  async downloadUpdate(): Promise<void> {
    this.downloadCalls += 1
    if (this.downloadError) throw this.downloadError
  }

  quitAndInstall(): void {
    this.quitCalls += 1
  }
}

function createLogger(): UpdateLogger & { errors: string[]; infos: string[] } {
  return {
    errors: [],
    infos: [],
    error(message, detail) {
      this.errors.push(`${message}: ${String(detail ?? '')}`)
    },
    info(message, detail) {
      this.infos.push(`${message}: ${String(detail ?? '')}`)
    },
  }
}

test('development mode never checks the real update service', async () => {
  const updater = new FakeUpdater()
  const logger = createLogger()
  const started = initializeAutoUpdates({
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    enabled: false,
    logger,
    updater,
  })
  await nextTurn()

  assert.equal(started, false)
  assert.equal(updater.checkCalls, 0)
})

test('no-update result stays silent and does not open a dialog', async () => {
  const updater = new FakeUpdater()
  let dialogCalls = 0
  initializeAutoUpdates({
    dialog: {
      showMessageBox: async () => {
        dialogCalls += 1
        return { response: 0 }
      },
    },
    enabled: true,
    logger: createLogger(),
    updater,
  })
  updater.emit('update-not-available', { version: '0.1.0' })
  await nextTurn()

  assert.equal(updater.checkCalls, 1)
  assert.equal(dialogCalls, 0)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, true)
})

test('available updates download, prompt, and can restart to install', async () => {
  const updater = new FakeUpdater()
  const prompts: Parameters<UpdateDialogLike['showMessageBox']>[0][] = []
  initializeAutoUpdates({
    dialog: {
      showMessageBox: async (options) => {
        prompts.push(options)
        return { response: 1 }
      },
    },
    enabled: true,
    logger: createLogger(),
    updater,
  })

  updater.emit('update-available', { version: '0.2.0' })
  await nextTurn()
  updater.emit('update-downloaded', { version: '0.2.0' })
  await nextTurn()

  assert.equal(updater.downloadCalls, 1)
  assert.equal(prompts.length, 1)
  assert.match(prompts[0]?.detail ?? '', /0\.2\.0/)
  assert.equal(updater.quitCalls, 1)
})

test('network, version, and download failures are logged without throwing', async () => {
  const updater = new FakeUpdater()
  const logger = createLogger()
  updater.checkError = new Error('network unavailable')
  updater.downloadError = new Error('download interrupted')
  initializeAutoUpdates({
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    enabled: true,
    logger,
    updater,
  })

  updater.emit('error', new Error('invalid version'))
  updater.emit('update-available', { version: null })
  await nextTurn()
  await nextTurn()

  assert.equal(updater.downloadCalls, 1)
  assert.equal(logger.errors.length, 3)
  assert.match(logger.errors.join('\n'), /network unavailable/)
  assert.match(logger.errors.join('\n'), /invalid version/)
  assert.match(logger.errors.join('\n'), /download interrupted/)
})
