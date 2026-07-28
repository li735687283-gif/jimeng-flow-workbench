export interface GenerationSubscriptionRef {
  current: (() => void) | null
}

function once(cancel: () => void): () => void {
  let called = false
  return () => {
    if (called) return
    called = true
    cancel()
  }
}

export function replaceGenerationSubscription(
  ref: GenerationSubscriptionRef,
  cancel: () => void,
): () => void {
  const managedCancel = once(cancel)
  ref.current?.()
  ref.current = managedCancel
  return () => {
    managedCancel()
    if (ref.current === managedCancel) ref.current = null
  }
}

const externalGenerationSubscriptions = new Map<string, () => void>()

/**
 * 组件外（如宫格生成）发起的生成订阅登记。
 * ImageNode 的恢复订阅据此跳过已被外部跟踪的任务，
 * 避免双重订阅把节点的 success 状态覆盖回 running。
 */
export function trackExternalGenerationSubscription(
  nodeId: string,
  cancel: () => void,
): () => void {
  externalGenerationSubscriptions.get(nodeId)?.()
  externalGenerationSubscriptions.set(nodeId, cancel)
  return () => {
    if (externalGenerationSubscriptions.get(nodeId) === cancel) {
      externalGenerationSubscriptions.delete(nodeId)
    }
  }
}

export function hasExternalGenerationSubscription(nodeId: string): boolean {
  return externalGenerationSubscriptions.has(nodeId)
}
