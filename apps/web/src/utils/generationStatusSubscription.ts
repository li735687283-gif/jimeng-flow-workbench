import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import {
  getGeneration,
  subscribeGeneration,
  type GenerationSseCallback,
} from '../api/generations'

export const DEFAULT_GENERATION_FALLBACK_POLL_INTERVAL_MS = 2_000
export const DEFAULT_GENERATION_FALLBACK_MAX_WAIT_MS = 30 * 60 * 1_000

export interface GenerationStatusSubscriptionDeps {
  getGenerationImpl?: typeof getGeneration
  subscribeGenerationImpl?: typeof subscribeGeneration
  pollIntervalMs?: number
  maxWaitMs?: number
  maxPollAttempts?: number
  now?: () => number
  setTimeoutImpl?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>
  clearTimeoutImpl?: (timer: ReturnType<typeof setTimeout>) => void
}

function isTerminal(response: GenerationResponse): boolean {
  return response.status === 'success' || response.status === 'error'
}

/**
 * Prefer SSE, then continue observing the same task through the status endpoint
 * until the provider's 30 minute execution budget is exhausted.
 */
export function subscribeGenerationWithFallback(
  id: string,
  callbacks: GenerationSseCallback,
  deps: GenerationStatusSubscriptionDeps = {},
): () => void {
  const getStatus = deps.getGenerationImpl ?? getGeneration
  const subscribe = deps.subscribeGenerationImpl ?? subscribeGeneration
  const pollIntervalMs = Math.max(
    0,
    deps.pollIntervalMs ?? DEFAULT_GENERATION_FALLBACK_POLL_INTERVAL_MS,
  )
  const maxWaitMs = Math.max(
    0,
    deps.maxWaitMs ?? DEFAULT_GENERATION_FALLBACK_MAX_WAIT_MS,
  )
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimeoutImpl ?? setTimeout
  const clearTimer = deps.clearTimeoutImpl ?? clearTimeout
  const startedAt = now()
  const maxPollAttempts = deps.maxPollAttempts === undefined
    ? null
    : Math.max(1, Math.floor(deps.maxPollAttempts))

  let cancelSse: (() => void) | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackStarted = false
  let fallbackError = 'SSE 连接错误'
  let pollAttempts = 0
  let settled = false
  let cancelled = false

  const clearResources = () => {
    if (cancelSse) {
      const cancel = cancelSse
      cancelSse = null
      cancel()
    }
    if (pollTimer) {
      clearTimer(pollTimer)
      pollTimer = null
    }
  }

  const complete = (response: GenerationResponse) => {
    if (settled || cancelled) return
    settled = true
    clearResources()
    callbacks.onComplete?.(response)
  }

  const fail = () => {
    if (settled || cancelled) return
    settled = true
    clearResources()
    callbacks.onError?.(fallbackError)
  }

  const waitBudgetExpired = () =>
    now() - startedAt >= maxWaitMs ||
    (maxPollAttempts !== null && pollAttempts >= maxPollAttempts)

  const schedulePoll = () => {
    if (settled || cancelled) return
    if (waitBudgetExpired()) {
      fail()
      return
    }
    const remainingMs = maxWaitMs - (now() - startedAt)
    pollTimer = setTimer(
      () => {
        pollTimer = null
        void pollStatus()
      },
      Math.min(pollIntervalMs, remainingMs),
    )
  }

  const pollStatus = async () => {
    if (settled || cancelled) return
    if (waitBudgetExpired()) {
      fail()
      return
    }

    pollAttempts += 1
    try {
      const response = await getStatus(id)
      if (settled || cancelled) return
      callbacks.onUpdate?.(response)
      if (isTerminal(response)) {
        complete(response)
        return
      }
    } catch {
      if (settled || cancelled) return
    }

    schedulePoll()
  }

  const beginFallback = (error: string) => {
    if (fallbackStarted || settled || cancelled) return
    fallbackStarted = true
    fallbackError = error
    if (cancelSse) {
      const cancel = cancelSse
      cancelSse = null
      cancel()
    }
    void pollStatus()
  }

  const createdCancel = subscribe(id, {
    onUpdate: (response) => {
      if (fallbackStarted || settled || cancelled) return
      callbacks.onUpdate?.(response)
    },
    onComplete: (response) => {
      if (fallbackStarted || settled || cancelled) return
      complete(response)
    },
    onError: beginFallback,
  })

  if (fallbackStarted || settled || cancelled) {
    createdCancel()
  } else {
    cancelSse = createdCancel
  }

  return () => {
    if (cancelled) return
    cancelled = true
    clearResources()
  }
}
