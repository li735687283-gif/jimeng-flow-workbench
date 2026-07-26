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

async function confirmUpdateDownload(
  dialog: UpdateDialogLike,
  logger: UpdateLogger,
  info: unknown,
): Promise<boolean> {
  const version = updateVersion(info)
  const detail = version
    ? `发现 MO.K ${version}。确认后将自动下载，下载完成时会关闭并重启应用以完成安装。`
    : '发现 MO.K 新版本。确认后将自动下载，下载完成时会关闭并重启应用以完成安装。'
  try {
    const result = await dialog.showMessageBox({
      buttons: ['暂不更新', '下载并安装'],
      cancelId: 0,
      defaultId: 1,
      detail,
      message: 'MO.K 有可用更新',
      noLink: true,
      title: 'MO.K 更新',
      type: 'info',
    })
    return result.response === 1
  } catch (error) {
    logger.error('[updater] update prompt failed', errorMessage(error))
    return false
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
  let downloadApproved = false
  let updatePromptShown = false
  updater.on('update-available', (info) => {
    logger.info('[updater] update available', updateVersion(info) ?? 'unknown')
    if (updatePromptShown) return
    updatePromptShown = true
    void confirmUpdateDownload(options.dialog, logger, info).then((approved) => {
      if (!approved) return
      downloadApproved = true
      return downloadUpdate(updater, logger)
    })
  })
  updater.on('update-downloaded', (info) => {
    logger.info('[updater] update downloaded', updateVersion(info) ?? 'unknown')
    if (downloadApproved) {
      installDownloadedUpdate(updater, logger)
    }
  })

  void checkForUpdates(updater, logger)
  return true
}
