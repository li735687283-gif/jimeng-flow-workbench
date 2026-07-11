import { isFlowNotFoundError } from '../api/flows'

export type LastFlowRestoreResult =
  | { status: 'restored' }
  | { status: 'missing'; error: unknown }
  | { status: 'failed'; error: unknown }
  | { status: 'stale'; error: unknown }

type ActiveFlowIdRef = {
  current: string | null
}

type RestoreAttempt = {
  flowId: string
  token: symbol
}

type RestoreCoordinatorState = {
  activeAttempt: RestoreAttempt | null
}

const restoreStateByRef = new WeakMap<
  ActiveFlowIdRef,
  RestoreCoordinatorState
>()

function getRestoreCoordinatorState(
  activeFlowId: ActiveFlowIdRef,
): RestoreCoordinatorState {
  const existing = restoreStateByRef.get(activeFlowId)
  if (existing) return existing

  const created: RestoreCoordinatorState = {
    activeAttempt: null,
  }
  restoreStateByRef.set(activeFlowId, created)
  return created
}

type StartLastFlowRestoreOptions = {
  activeFlowId: ActiveFlowIdRef
  flowId: string
  loadFlow: (flowId: string) => Promise<void>
  getCurrentFlowId: () => string | null
  getStoredFlowId: () => string | null
  clearStoredFlowId: () => void
  onSettled?: () => void
}

export function startLastFlowRestore({
  activeFlowId,
  flowId,
  loadFlow,
  getCurrentFlowId,
  getStoredFlowId,
  clearStoredFlowId,
  onSettled,
}: StartLastFlowRestoreOptions): Promise<LastFlowRestoreResult> | null {
  const state = getRestoreCoordinatorState(activeFlowId)
  if (state.activeAttempt?.flowId === flowId) return null

  const attempt: RestoreAttempt = { flowId, token: Symbol(flowId) }
  state.activeAttempt = attempt
  activeFlowId.current = flowId

  const inFlight = (async () => {
    await loadFlow(flowId)
  })()

  const isActiveAttempt = () => state.activeAttempt?.token === attempt.token

  const restore = (async (): Promise<LastFlowRestoreResult> => {
    try {
      await inFlight
      if (!isActiveAttempt()) return { status: 'stale', error: undefined }
      return { status: 'restored' }
    } catch (error) {
      if (!isActiveAttempt()) return { status: 'stale', error }
      const currentFlowId = getCurrentFlowId()
      if (
        getStoredFlowId() !== flowId ||
        (currentFlowId !== null && currentFlowId !== flowId)
      ) {
        return { status: 'stale', error }
      }
      if (isFlowNotFoundError(error)) {
        clearStoredFlowId()
        return { status: 'missing', error }
      }
      return { status: 'failed', error }
    }
  })()

  return restore.finally(() => {
    if (!isActiveAttempt()) return
    state.activeAttempt = null
    activeFlowId.current = null
    onSettled?.()
  })
}
