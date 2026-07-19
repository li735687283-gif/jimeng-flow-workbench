import { join } from 'node:path'
import type { BrowserWindowConstructorOptions } from 'electron'

export const DEVELOPMENT_CANVAS_URL = 'http://127.0.0.1:5174/canvas'

export function createBrowserWindowOptions(
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0b0b0c',
    show: false,
    title: 'MO.K',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}

export function resolveProductionRenderer(resourcesPath: string): {
  filePath: string
  query: Record<string, string>
} {
  return {
    filePath: join(resourcesPath, 'web', 'index.html'),
    query: { view: 'canvas' },
  }
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
