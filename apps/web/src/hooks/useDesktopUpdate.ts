import { useCallback, useEffect, useState } from 'react'
import type { DesktopUpdateState } from '@jimeng-flow/shared/desktopUpdate'

const IDLE_UPDATE_STATE: DesktopUpdateState = { status: 'idle' }

export function useDesktopUpdate(): {
  downloadUpdate: () => Promise<void>
  updateState: DesktopUpdateState
} {
  const [updateState, setUpdateState] =
    useState<DesktopUpdateState>(IDLE_UPDATE_STATE)

  useEffect(() => {
    const updates = window.mokDesktop?.updates
    if (!updates) return

    let disposed = false
    const unsubscribe = updates.onStateChange((state) => {
      if (!disposed) setUpdateState(state)
    })
    void updates.getState()
      .then((state) => {
        if (!disposed) setUpdateState(state)
      })
      .catch((error: unknown) => {
        console.error('[updater] 获取更新状态失败:', error)
      })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    try {
      await window.mokDesktop?.updates.download()
    } catch (error: unknown) {
      console.error('[updater] 启动更新下载失败:', error)
    }
  }, [])

  return { downloadUpdate, updateState }
}
