import { contextBridge, ipcRenderer } from 'electron'
import {
  DESKTOP_UPDATE_CHANNELS,
  type DesktopUpdateState,
} from '@jimeng-flow/shared/desktopUpdate'
import { DESKTOP_WINDOW_CHANNELS } from '@jimeng-flow/shared/desktopWindow'

contextBridge.exposeInMainWorld(
  'mokDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
    windowControls: Object.freeze({
      minimize: (): Promise<void> =>
        ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.minimize),
      toggleMaximize: (): Promise<boolean> =>
        ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.toggleMaximize),
      close: (): Promise<void> =>
        ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.close),
      isMaximized: (): Promise<boolean> =>
        ipcRenderer.invoke(DESKTOP_WINDOW_CHANNELS.isMaximized),
    }),
    updates: Object.freeze({
      getState: (): Promise<DesktopUpdateState> =>
        ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.getState),
      download: (): Promise<boolean> =>
        ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.download),
      onStateChange: (
        listener: (state: DesktopUpdateState) => void,
      ): (() => void) => {
        const handleStateChange = (
          _event: Electron.IpcRendererEvent,
          state: DesktopUpdateState,
        ) => listener(state)
        ipcRenderer.on(DESKTOP_UPDATE_CHANNELS.stateChanged, handleStateChange)
        return () => {
          ipcRenderer.removeListener(
            DESKTOP_UPDATE_CHANNELS.stateChanged,
            handleStateChange,
          )
        }
      },
    }),
  }),
)
