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
