import type { DesktopUpdateState } from '@jimeng-flow/shared/desktopUpdate'

export {}

declare global {
  interface Window {
    /** 由桌面端 preload 注入；浏览器开发模式下为 undefined */
    mokDesktop?: {
      isDesktop: boolean
      platform: string
      electronVersion: string
      windowControls: {
        minimize(): Promise<void>
        /** 返回切换后的最大化状态 */
        toggleMaximize(): Promise<boolean>
        close(): Promise<void>
        isMaximized(): Promise<boolean>
      }
      updates: {
        getState(): Promise<DesktopUpdateState>
        download(): Promise<boolean>
        onStateChange(
          listener: (state: DesktopUpdateState) => void,
        ): () => void
      }
    }
  }
}
