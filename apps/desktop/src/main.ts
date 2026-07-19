import { dirname, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import {
  LOCAL_CANVAS_URL,
  startOrReuseLocalServer,
  stopOwnedLocalServer,
  type LocalServerHandle,
} from './localServer'
import { migrateWorkspace } from './workspaceMigration'
import {
  createBrowserWindowOptions,
  DEVELOPMENT_CANVAS_URL,
  isSafeExternalUrl,
} from './windowConfig'

const isDevelopment = process.argv.includes('--dev')
const configuredUserData = process.env.MOK_DESKTOP_USER_DATA_DIR?.trim()
if (configuredUserData) {
  app.setPath('userData', resolve(configuredUserData))
}

let serverHandle: LocalServerHandle | null = null

async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow(
    createBrowserWindowOptions(join(__dirname, 'preload.cjs')),
  )

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  await mainWindow.loadURL(
    isDevelopment ? DEVELOPMENT_CANVAS_URL : LOCAL_CANVAS_URL,
  )
  return mainWindow
}

function getLegacyWorkspaceCandidates(): string[] {
  const configuredLegacy = process.env.MOK_LEGACY_WORKSPACE_DIR?.trim()
  const candidates = [
    configuredLegacy,
    isDevelopment ? join(app.getAppPath(), 'workspace') : undefined,
    join(dirname(process.execPath), 'workspace'),
    join(process.resourcesPath, 'workspace'),
  ]
  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

async function startDesktop(): Promise<void> {
  const userDataDir = app.getPath('userData')
  const workspaceDir = join(userDataDir, 'workspace')
  await migrateWorkspace({
    legacyCandidates: getLegacyWorkspaceCandidates(),
    targetWorkspace: workspaceDir,
  })

  const projectRoot = isDevelopment ? app.getAppPath() : userDataDir
  const serverEntry = isDevelopment
    ? join(app.getAppPath(), 'apps/desktop/dist/server.cjs')
    : join(process.resourcesPath, 'server/server.cjs')
  serverHandle = await startOrReuseLocalServer({
    entryPath: serverEntry,
    execPath: process.execPath,
    projectRoot,
    webRoot: isDevelopment ? undefined : join(process.resourcesPath, 'web'),
    workspaceDir,
  })

  await createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(startDesktop).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('MO.K failed to start', message)
    app.quit()
  })
}

app.on('before-quit', () => {
  stopOwnedLocalServer(serverHandle)
  serverHandle = null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  console.error('[desktop] uncaught exception', error)
})

process.on('unhandledRejection', (error) => {
  console.error('[desktop] unhandled rejection', error)
})
