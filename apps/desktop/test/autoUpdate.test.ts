import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import type { DesktopUpdateState } from '@jimeng-flow/shared/desktopUpdate'
import {
  initializeAutoUpdates,
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
  const controller = initializeAutoUpdates({
    enabled: false,
    logger,
    updater,
  })
  await nextTurn()

  assert.equal(controller, null)
  assert.equal(updater.checkCalls, 0)
})

test('no-update result stays idle and never downloads', async () => {
  const updater = new FakeUpdater()
  const controller = initializeAutoUpdates({
    enabled: true,
    logger: createLogger(),
    updater,
  })
  updater.emit('update-not-available', { version: '0.1.0' })
  await nextTurn()

  assert.equal(updater.checkCalls, 1)
  assert.deepEqual(controller?.getState(), { status: 'idle' })
  assert.equal(updater.downloadCalls, 0)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, true)
})

test('available update publishes a passive state and waits for a click', async () => {
  const updater = new FakeUpdater()
  const states: DesktopUpdateState[] = []
  const controller = initializeAutoUpdates({
    enabled: true,
    logger: createLogger(),
    onStateChange: (state) => states.push(state),
    updater,
  })

  updater.emit('update-available', { version: '0.2.0' })
  await nextTurn()

  assert.equal(updater.downloadCalls, 0)
  assert.equal(updater.quitCalls, 0)
  assert.deepEqual(controller?.getState(), {
    status: 'available',
    version: '0.2.0',
  })
  assert.deepEqual(states.at(-1), {
    status: 'available',
    version: '0.2.0',
  })
})

test('clicked update reports progress and installs after download completes', async () => {
  const updater = new FakeUpdater()
  const states: DesktopUpdateState[] = []
  const controller = initializeAutoUpdates({
    enabled: true,
    logger: createLogger(),
    onStateChange: (state) => states.push(state),
    updater,
  })

  updater.emit('update-available', { version: '0.2.0' })
  assert.equal(await controller?.download(), true)
  assert.equal(updater.downloadCalls, 1)
  assert.equal(updater.quitCalls, 0)

  updater.emit('download-progress', { percent: 46.4 })
  assert.deepEqual(controller?.getState(), {
    status: 'downloading',
    version: '0.2.0',
    percent: 46.4,
  })

  updater.emit('update-downloaded', { version: '0.2.0' })
  await nextTurn()

  assert.deepEqual(states.at(-1), {
    status: 'installing',
    version: '0.2.0',
  })
  assert.equal(updater.quitCalls, 1)
})

test('repeated clicks reuse one download', async () => {
  const updater = new FakeUpdater()
  let resolveDownload: (() => void) | undefined
  updater.downloadUpdate = () => {
    updater.downloadCalls += 1
    return new Promise<void>((resolve) => {
      resolveDownload = resolve
    })
  }
  const controller = initializeAutoUpdates({
    enabled: true,
    logger: createLogger(),
    updater,
  })

  updater.emit('update-available', { version: '0.2.0' })
  const firstDownload = controller?.download()
  const secondDownload = controller?.download()

  assert.equal(updater.downloadCalls, 1)
  resolveDownload?.()
  assert.equal(await firstDownload, true)
  assert.equal(await secondDownload, true)
})

test('network, version, and download failures are logged and allow retry', async () => {
  const updater = new FakeUpdater()
  const logger = createLogger()
  updater.checkError = new Error('network unavailable')
  updater.downloadError = new Error('download interrupted')
  const controller = initializeAutoUpdates({
    enabled: true,
    logger,
    updater,
  })

  updater.emit('error', new Error('invalid version'))
  updater.emit('update-available', { version: null })
  assert.equal(await controller?.download(), false)
  await nextTurn()

  assert.equal(updater.downloadCalls, 1)
  assert.equal(logger.errors.length, 3)
  assert.match(logger.errors.join('\n'), /network unavailable/)
  assert.match(logger.errors.join('\n'), /invalid version/)
  assert.match(logger.errors.join('\n'), /download interrupted/)
  assert.deepEqual(controller?.getState(), {
    status: 'available',
    version: null,
  })
})
