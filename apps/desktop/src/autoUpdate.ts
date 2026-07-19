export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  on(event: string, listener: (value: unknown) => void): unknown
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdateDialogLike {
  showMessageBox(options: {
    buttons: string[]
    cancelId: number
    defaultId: number
    detail: string
    message: string
    noLink: boolean
    title: string
    type: 'info'
  }): Promise<{ response: number }>
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

async function downloadUpdate(
  updater: UpdaterLike,
  logger: UpdateLogger,
): Promise<void> {
  try {
    await updater.downloadUpdate()
  } catch (error) {
    logger.error('[updater] update download failed', errorMessage(error))
  }
}

async function showDownloadedUpdate(
  updater: UpdaterLike,
  dialog: UpdateDialogLike,
  logger: UpdateLogger,
  info: unknown,
): Promise<void> {
  const version = updateVersion(info)
  const detail = version
    ? `MO.K ${version} has been downloaded. Choose restart now, or close MO.K later to install it for the next launch.`
    : 'A MO.K update has been downloaded. Choose restart now, or close MO.K later to install it for the next launch.'
  try {
    const result = await dialog.showMessageBox({
      buttons: ['Later', 'Restart and install'],
      cancelId: 0,
      defaultId: 0,
      detail,
      message: 'MO.K update is ready',
      noLink: true,
      title: 'MO.K Update',
      type: 'info',
    })
    if (result.response === 1) {
      updater.quitAndInstall(false, true)
    }
  } catch (error) {
    logger.error('[updater] update prompt failed', errorMessage(error))
  }
}

export function initializeAutoUpdates(options: {
  dialog: UpdateDialogLike
  enabled: boolean
  logger?: UpdateLogger
  updater: UpdaterLike
}): boolean {
  const logger = options.logger ?? console
  if (!options.enabled) {
    logger.info('[updater] disabled outside packaged production')
    return false
  }

  const { updater } = options
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.on('error', (error) => {
    logger.error('[updater] updater error', errorMessage(error))
  })
  updater.on('update-not-available', () => {
    logger.info('[updater] no update available')
  })
  updater.on('update-available', (info) => {
    logger.info('[updater] update available', updateVersion(info) ?? 'unknown')
    void downloadUpdate(updater, logger)
  })
  updater.on('update-downloaded', (info) => {
    void showDownloadedUpdate(updater, options.dialog, logger, info)
  })

  void checkForUpdates(updater, logger)
  return true
}
