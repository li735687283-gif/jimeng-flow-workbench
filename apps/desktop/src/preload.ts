import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld(
  'mokDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
  }),
)
