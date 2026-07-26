export const DESKTOP_UPDATE_CHANNELS = {
  download: 'mok:update:download',
  getState: 'mok:update:get-state',
  stateChanged: 'mok:update:state-changed',
} as const

export type DesktopUpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string | null }
  | { status: 'downloading'; version: string | null; percent: number }
  | { status: 'installing'; version: string | null }
