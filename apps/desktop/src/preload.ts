import { contextBridge, ipcRenderer } from 'electron'
import {
  DESKTOP_UPDATE_CHANNELS,
  type DesktopUpdateState,
} from '@jimeng-flow/shared/desktopUpdate'

contextBridge.exposeInMainWorld(
  'mokDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
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
