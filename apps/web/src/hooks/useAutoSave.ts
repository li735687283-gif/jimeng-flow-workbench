// 即梦 Flow 前端 - useAutoSave 自动保存 hook
// 订阅 canvasStore 的 nodes / edges 变化，节流（1.5s）后调用 flowStore.saveCurrent()。
// 首次挂载时若无 currentFlowId，先尝试恢复最近工作流（updatedAt 最大项），
// 列表为空时才 createFlow 一个空工作流。
// 参考 PRD 8.5、10.2、11.1。

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'

/** 节流延迟（ms） */
const AUTOSAVE_DELAY = 1500

/**
 * 自动保存 hook。
 * - 挂载时若 currentFlowId 为空，先 loadFlowList 取最近工作流恢复；
 *   列表为空时才 createFlow 新建空工作流。
 * - 订阅画布 nodes/edges 变化，节流后保存到后端
 * 仅需在顶层组件调用一次：useAutoSave(enabled)
 */
export function useAutoSave(enabled = true): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    // 首次加载：恢复最近工作流或新建空 flow
    if (!initializedRef.current) {
      initializedRef.current = true
      const { currentFlowId, loadFlowList, loadFlow, createFlow } =
        useFlowStore.getState()
      if (!currentFlowId) {
        loadFlowList()
          .then((list) => {
            if (list.length === 0) {
              return createFlow()
            }
            // 取 updatedAt 最大项恢复
            const latest = list.reduce((acc, cur) =>
              cur.updatedAt > acc.updatedAt ? cur : acc,
            )
            return loadFlow(latest.id)
          })
          .catch((err: unknown) => {
            console.error('[useAutoSave] 初始化加载工作流失败:', err)
          })
      }
    }

    // 订阅画布变化（节流保存）
    // zustand 的 subscribe 会在每次 set 时触发，listener 收到 (state, prevState)
    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      // 仅在 nodes 或 edges 引用变化时调度保存
      if (state.nodes === prevState.nodes && state.edges === prevState.edges) {
        return
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        const { currentFlowId, saveCurrent } = useFlowStore.getState()
        if (!currentFlowId) return
        saveCurrent().catch((err: unknown) => {
          console.error('[useAutoSave] 自动保存失败:', err)
        })
      }, AUTOSAVE_DELAY)
    })

    return () => {
      unsubscribe()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled])
}
