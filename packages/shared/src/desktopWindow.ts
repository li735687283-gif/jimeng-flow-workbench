// 桌面端自绘窗口控制按钮（最小化/最大化/关闭）的 IPC 通道。
// 原生 titleBarOverlay 无法做悬停动画与自动隐藏，故改为渲染层自绘。

export const DESKTOP_WINDOW_CHANNELS = {
  minimize: 'mok:window:minimize',
  toggleMaximize: 'mok:window:toggle-maximize',
  close: 'mok:window:close',
  isMaximized: 'mok:window:is-maximized',
} as const
