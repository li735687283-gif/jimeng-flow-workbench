export {}

declare global {
  interface Window {
    /** 由桌面端 preload 注入；浏览器开发模式下为 undefined */
    mokDesktop?: {
      isDesktop: boolean
      platform: string
      electronVersion: string
    }
  }
}
