import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import {
  createBrowserWindowOptions,
  DEVELOPMENT_CANVAS_URL,
  isSafeExternalUrl,
  resolveProductionRenderer,
} from './windowConfig'

const isDevelopment = process.argv.includes('--dev')

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

  if (isDevelopment) {
    await mainWindow.loadURL(DEVELOPMENT_CANVAS_URL)
  } else {
    const renderer = resolveProductionRenderer(process.resourcesPath)
    await mainWindow.loadFile(renderer.filePath, { query: renderer.query })
  }

  return mainWindow
}

app.whenReady().then(async () => {
  await createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })
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
