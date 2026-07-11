import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FlowApiError } from '../src/api/flows'

function createDeferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function loadRestoreModule() {
  const restoreModule = await import('../src/utils/lastFlowRestore').catch(
    () => null,
  )
  assert.ok(restoreModule, 'last-flow restore coordinator should exist')
  return restoreModule
}

test('deduplicates concurrent restoration of the same flow id', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const deferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let loadCalls = 0

  const options = {
    activeFlowId,
    flowId: 'stale-flow',
    loadFlow: () => {
      loadCalls += 1
      return deferred.promise
    },
    getCurrentFlowId: () => null,
    getStoredFlowId: () => 'stale-flow',
    clearStoredFlowId: () => undefined,
  }

  const first = startLastFlowRestore(options)
  const second = startLastFlowRestore(options)

  assert.ok(first)
  assert.equal(second, null)
  assert.equal(loadCalls, 1)
  assert.equal(activeFlowId.current, 'stale-flow')

  deferred.resolve()
  assert.deepEqual(await first, { status: 'restored' })
  assert.equal(activeFlowId.current, null)
})

test('clears the matching stored id when the flow is missing', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'missing-flow'
  let clearCalls = 0

  const restore = startLastFlowRestore({
    activeFlowId,
    flowId: 'missing-flow',
    loadFlow: async () => {
      throw new FlowApiError('missing', 404, 'FLOW_NOT_FOUND')
    },
    getCurrentFlowId: () => null,
    getStoredFlowId: () => storedFlowId,
    clearStoredFlowId: () => {
      clearCalls += 1
      storedFlowId = null
    },
  })

  assert.ok(restore)
  const result = await restore
  assert.equal(result.status, 'missing')
  assert.equal(clearCalls, 1)
  assert.equal(storedFlowId, null)
  assert.equal(activeFlowId.current, null)
})

test('keeps the stored id after a non-404 restore failure', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const activeFlowId = { current: null as string | null }
  let clearCalls = 0

  const restore = startLastFlowRestore({
    activeFlowId,
    flowId: 'retry-flow',
    loadFlow: async () => {
      throw new Error('network unavailable')
    },
    getCurrentFlowId: () => null,
    getStoredFlowId: () => 'retry-flow',
    clearStoredFlowId: () => {
      clearCalls += 1
    },
  })

  assert.ok(restore)
  const result = await restore
  assert.equal(result.status, 'failed')
  assert.equal(clearCalls, 0)
  assert.equal(activeFlowId.current, null)
})

test('does not clear a newer stored id after a slow 404', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const deferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'old-flow'
  let clearCalls = 0

  const restore = startLastFlowRestore({
    activeFlowId,
    flowId: 'old-flow',
    loadFlow: () => deferred.promise,
    getCurrentFlowId: () => null,
    getStoredFlowId: () => storedFlowId,
    clearStoredFlowId: () => {
      clearCalls += 1
      storedFlowId = null
    },
  })

  assert.ok(restore)
  storedFlowId = 'new-flow'
  deferred.reject(new FlowApiError('missing', 404, 'FLOW_NOT_FOUND'))

  const result = await restore
  assert.equal(result.status, 'stale')
  assert.equal(clearCalls, 0)
  assert.equal(storedFlowId, 'new-flow')
  assert.equal(activeFlowId.current, null)
})

test('treats an already loaded newer flow as newer than stale storage', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const deferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let currentFlowId: string | null = null
  let clearCalls = 0

  const restore = startLastFlowRestore({
    activeFlowId,
    flowId: 'old-flow',
    loadFlow: () => deferred.promise,
    getCurrentFlowId: () => currentFlowId,
    getStoredFlowId: () => 'old-flow',
    clearStoredFlowId: () => {
      clearCalls += 1
    },
  })

  assert.ok(restore)
  currentFlowId = 'new-flow'
  deferred.reject(new FlowApiError('missing', 404, 'FLOW_NOT_FOUND'))

  const result = await restore
  assert.equal(result.status, 'stale')
  assert.equal(clearCalls, 0)
})

test('only the newest overlapping restore attempt can settle restoring state', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const oldDeferred = createDeferred()
  const newDeferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'old-flow'
  const settled: string[] = []

  const oldRestore = startLastFlowRestore({
    activeFlowId,
    flowId: 'old-flow',
    loadFlow: () => oldDeferred.promise,
    getCurrentFlowId: () => null,
    getStoredFlowId: () => storedFlowId,
    clearStoredFlowId: () => undefined,
    onSettled: () => settled.push('old-flow'),
  })
  storedFlowId = 'new-flow'
  const newRestore = startLastFlowRestore({
    activeFlowId,
    flowId: 'new-flow',
    loadFlow: () => newDeferred.promise,
    getCurrentFlowId: () => null,
    getStoredFlowId: () => storedFlowId,
    clearStoredFlowId: () => undefined,
    onSettled: () => settled.push('new-flow'),
  })

  assert.ok(oldRestore)
  assert.ok(newRestore)
  oldDeferred.reject(new Error('old request failed'))
  assert.equal((await oldRestore).status, 'stale')
  assert.equal(activeFlowId.current, 'new-flow')
  assert.deepEqual(settled, [])

  newDeferred.resolve()
  assert.equal((await newRestore).status, 'restored')
  assert.equal(activeFlowId.current, null)
  assert.deepEqual(settled, ['new-flow'])
})

test('reuses an in-flight request when attempt ownership cycles back to the same flow', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const aDeferred = createDeferred()
  const bDeferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'flow-a'
  const loadCalls: string[] = []
  const settled: string[] = []

  const loadFlow = (flowId: string) => {
    loadCalls.push(flowId)
    return flowId === 'flow-a' ? aDeferred.promise : bDeferred.promise
  }
  const start = (flowId: string, attempt: string) => {
    storedFlowId = flowId
    return startLastFlowRestore({
      activeFlowId,
      flowId,
      loadFlow,
      getCurrentFlowId: () => null,
      getStoredFlowId: () => storedFlowId,
      clearStoredFlowId: () => undefined,
      onSettled: () => settled.push(attempt),
    })
  }

  const a1Restore = start('flow-a', 'a1')
  const bRestore = start('flow-b', 'b')
  const a2Restore = start('flow-a', 'a2')

  assert.ok(a1Restore)
  assert.ok(bRestore)
  assert.ok(a2Restore)
  assert.equal(loadCalls.filter((flowId) => flowId === 'flow-a').length, 1)
  assert.deepEqual(loadCalls, ['flow-a', 'flow-b'])

  bDeferred.resolve()
  assert.equal((await bRestore).status, 'stale')
  assert.equal(activeFlowId.current, 'flow-a')
  assert.deepEqual(settled, [])

  aDeferred.resolve()
  assert.equal((await a1Restore).status, 'stale')
  assert.equal((await a2Restore).status, 'restored')
  assert.equal(activeFlowId.current, null)
  assert.deepEqual(settled, ['a2'])
})
