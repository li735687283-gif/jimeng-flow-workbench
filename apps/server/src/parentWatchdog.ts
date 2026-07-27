// 父进程看门狗：桌面端通过 MOK_PARENT_PID 传入父进程 PID。
// Electron 异常退出（崩溃、被任务管理器结束）时 before-quit 不会触发，
// 服务进程会变成孤儿并永久占用端口；看门狗定时探测父进程，父进程消失后自行退出。

const WATCHDOG_INTERVAL_MS = 5_000

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM 表示进程存在但没有权限发信号，仍视为存活。
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function startParentWatchdog(options: {
  parentPid: number
  onParentGone: () => void | Promise<void>
  intervalMs?: number
  setIntervalImpl?: typeof setInterval
}): void {
  const timer = (options.setIntervalImpl ?? setInterval)(() => {
    if (isProcessAlive(options.parentPid)) return
    clearInterval(timer)
    void options.onParentGone()
  }, options.intervalMs ?? WATCHDOG_INTERVAL_MS)
  timer.unref?.()
}
