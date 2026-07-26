import type { DesktopUpdateState } from '@jimeng-flow/shared/desktopUpdate'

export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  on(event: string, listener: (value: unknown) => void): unknown
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface AutoUpdateController {
  download(): Promise<boolean>
  getState(): DesktopUpdateState
}

export interface UpdateLogger {
  error(message: string, detail?: unknown): void
  info(message: string, detail?: unknown): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function updateVersion(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const version = (value as { version?: unknown }).version
  return typeof version === 'string' && version.trim() ? version.trim() : null
}

function updatePercent(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const percent = (value as { percent?: unknown }).percent
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null
  return Math.min(100, Math.max(0, percent))
}

async function checkForUpdates(
  updater: UpdaterLike,
  logger: UpdateLogger,
): Promise<void> {
  try {
    await updater.checkForUpdates()
  } catch (error) {
    logger.error('[updater] update check failed', errorMessage(error))
  }
}

function installDownloadedUpdate(
  updater: UpdaterLike,
  logger: UpdateLogger,
): void {
  try {
    updater.quitAndInstall(false, true)
  } catch (error) {
    logger.error('[updater] update install failed', errorMessage(error))
  }
}

export function initializeAutoUpdates(options: {
  enabled: boolean
  logger?: UpdateLogger
  onStateChange?: (state: DesktopUpdateState) => void
  updater: UpdaterLike
}): AutoUpdateController | null {
  const logger = options.logger ?? console
  if (!options.enabled) {
    logger.info('[updater] disabled outside packaged production')
    return null
  }

  const { updater } = options
  let state: DesktopUpdateState = { status: 'idle' }
  let availableVersion: string | null = null
  let downloadRequested = false
  let downloadPromise: Promise<boolean> | null = null

  const setState = (nextState: DesktopUpdateState) => {
    state = nextState
    options.onStateChange?.(state)
  }

  const controller: AutoUpdateController = {
    getState: () => state,
    download: () => {
      if (downloadPromise) return downloadPromise
      if (state.status !== 'available') return Promise.resolve(false)

      downloadRequested = true
      setState({
        status: 'downloading',
        version: availableVersion,
        percent: 0,
      })
      downloadPromise = updater.downloadUpdate()
        .then(() => true)
        .catch((error) => {
          logger.error('[updater] update download failed', errorMessage(error))
          downloadRequested = false
          setState({ status: 'available', version: availableVersion })
          return false
        })
        .finally(() => {
          downloadPromise = null
        })
      return downloadPromise
    },
  }

  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.on('error', (error) => {
    logger.error('[updater] updater error', errorMessage(error))
  })
  updater.on('update-not-available', () => {
    logger.info('[updater] no update available')
    setState({ status: 'idle' })
  })
  updater.on('update-available', (info) => {
    if (downloadRequested) return
    availableVersion = updateVersion(info)
    logger.info('[updater] update available', availableVersion ?? 'unknown')
    setState({ status: 'available', version: availableVersion })
  })
  updater.on('download-progress', (info) => {
    if (!downloadRequested) return
    const percent = updatePercent(info)
    if (percent === null) return
    setState({
      status: 'downloading',
      version: availableVersion,
      percent,
    })
  })
  updater.on('update-downloaded', (info) => {
    logger.info('[updater] update downloaded', updateVersion(info) ?? 'unknown')
    if (!downloadRequested) return
    setState({ status: 'installing', version: availableVersion })
    installDownloadedUpdate(updater, logger)
  })

  void checkForUpdates(updater, logger)
  return controller
}
