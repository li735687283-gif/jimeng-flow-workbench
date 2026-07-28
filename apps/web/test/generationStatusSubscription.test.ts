import test from 'node:test'
import assert from 'node:assert/strict'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type { GenerationSseCallback } from '../src/api/generations'
import {
  DEFAULT_GENERATION_FALLBACK_MAX_WAIT_MS,
  subscribeGenerationWithFallback,
} from '../src/utils/generationStatusSubscription'

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function running(id = 'gen-fallback'): GenerationResponse {
  return { id, nodeId: 'node-1', status: 'running', results: [] }
}

function success(id = 'gen-fallback'): GenerationResponse {
  return {
    id,
    nodeId: 'node-1',
    status: 'success',
    results: [{ assetId: 'asset-done' }],
  }
}

test('default fallback duration matches the 30 minute provider timeout', () => {
  assert.equal(DEFAULT_GENERATION_FALLBACK_MAX_WAIT_MS, 30 * 60 * 1000)
})

test('SSE disconnect polls through five minutes and still completes successfully', async () => {
  let sseCallbacks: GenerationSseCallback | undefined
  let nowMs = 0
  let pollCount = 0
  const timers: Array<() => void> = []
  const events: string[] = []

  subscribeGenerationWithFallback(
    'gen-fallback',
    {
      onUpdate: (response) => events.push('update:' + response.status),
      onComplete: (response) => events.push('complete:' + response.status),
      onError: (message) => events.push('error:' + message),
    },
    {
      subscribeGenerationImpl: (_id, callbacks) => {
        sseCallbacks = callbacks
        return () => undefined
      },
      getGenerationImpl: async () => {
        pollCount += 1
        return pollCount >= 6 ? success() : running()
      },
      pollIntervalMs: 60_000,
      maxWaitMs: 30 * 60 * 1000,
      now: () => nowMs,
      setTimeoutImpl: (callback) => {
        timers.push(callback)
        return callback as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeoutImpl: (handle) => {
        const index = timers.indexOf(handle as unknown as () => void)
        if (index >= 0) timers.splice(index, 1)
      },
    },
  )

  sseCallbacks?.onError?.('SSE 连接错误')
  await tick()
  for (let minute = 1; minute <= 5; minute += 1) {
    nowMs = minute * 60_000
    const timer = timers.shift()
    assert.ok(timer)
    timer()
    await tick()
  }

  assert.equal(pollCount, 6)
  assert.equal(events.at(-1), 'complete:success')
  assert.equal(events.some((event) => event.startsWith('error:')), false)
  assert.equal(timers.length, 0)
})

test('fallback reports the original SSE error only after its wait budget expires', async () => {
  let sseCallbacks: GenerationSseCallback | undefined
  let nowMs = 0
  const timers: Array<() => void> = []
  const errors: string[] = []

  subscribeGenerationWithFallback(
    'gen-timeout',
    { onError: (message) => errors.push(message) },
    {
      subscribeGenerationImpl: (_id, callbacks) => {
        sseCallbacks = callbacks
        return () => undefined
      },
      getGenerationImpl: async () => running('gen-timeout'),
      pollIntervalMs: 60_000,
      maxWaitMs: 120_000,
      now: () => nowMs,
      setTimeoutImpl: (callback) => {
        timers.push(callback)
        return callback as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeoutImpl: () => undefined,
    },
  )

  sseCallbacks?.onError?.('SSE 已断开')
  await tick()
  assert.deepEqual(errors, [])

  nowMs = 60_000
  timers.shift()?.()
  await tick()
  assert.deepEqual(errors, [])

  nowMs = 120_000
  timers.shift()?.()
  await tick()
  assert.deepEqual(errors, ['SSE 已断开'])
})

test('cancelling fallback clears the pending poll and ignores late responses', async () => {
  let sseCallbacks: GenerationSseCallback | undefined
  let resolvePoll: ((response: GenerationResponse) => void) | undefined
  let sseCancelled = 0
  const completed: GenerationResponse[] = []

  const cancel = subscribeGenerationWithFallback(
    'gen-cancel',
    { onComplete: (response) => completed.push(response) },
    {
      subscribeGenerationImpl: (_id, callbacks) => {
        sseCallbacks = callbacks
        return () => { sseCancelled += 1 }
      },
      getGenerationImpl: () => new Promise((resolve) => { resolvePoll = resolve }),
    },
  )

  sseCallbacks?.onError?.('SSE 连接错误')
  await tick()
  cancel()
  resolvePoll?.(success('gen-cancel'))
  await tick()

  assert.equal(sseCancelled, 1)
  assert.deepEqual(completed, [])
})
