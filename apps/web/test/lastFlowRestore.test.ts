import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Flow } from '@jimeng-flow/shared/flow'
import { FlowApiError } from '../src/api/flows'
import { useCanvasStore } from '../src/state/canvasStore'
import { useFlowStore } from '../src/state/flowStore'

function createDeferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createValueDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const TIMESTAMP = '2026-07-12T00:00:00.000Z'

function createFlowFixture(id: string, name: string): Flow {
  const nodeId = `image-${id}`
  return {
    id,
    name,
    nodes: [
      {
        id: nodeId,
        type: 'image',
        position: { x: 120, y: 240 },
        data: {
          id: nodeId,
          title: `${name} image`,
          prompt: `${name} prompt`,
          status: 'success',
          assetId: `asset-${id}`,
          model: 'jimeng-4.0',
          aspectRatio: '1:1',
          count: 1,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      },
    ],
    edges: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

function resetFlowStores(): void {
  useFlowStore.setState({
    currentFlowId: null,
    currentFlowName: '无限画布',
    loading: false,
    saving: false,
    lastSavedAt: null,
    flowList: [],
    error: null,
  })
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    deletedNodeIds: [],
    selectedNodeId: null,
  })
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return
    await Promise.resolve()
  }
  throw new Error('Expected condition to become true')
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

test('starts a fresh load when attempt ownership cycles back to the same flow', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const a1Deferred = createDeferred()
  const a2Deferred = createDeferred()
  const bDeferred = createDeferred()
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'flow-a'
  const loadCalls: string[] = []
  const settled: string[] = []
  let aLoadIndex = 0

  const loadFlow = (flowId: string) => {
    loadCalls.push(flowId)
    if (flowId === 'flow-b') return bDeferred.promise
    const request = [a1Deferred, a2Deferred][aLoadIndex]
    aLoadIndex += 1
    if (!request) throw new Error('Unexpected extra Flow A load')
    return request.promise
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
  assert.equal(loadCalls.filter((flowId) => flowId === 'flow-a').length, 2)
  assert.deepEqual(loadCalls, ['flow-a', 'flow-b', 'flow-a'])

  bDeferred.resolve()
  assert.equal((await bRestore).status, 'stale')
  assert.equal(activeFlowId.current, 'flow-a')
  assert.deepEqual(settled, [])

  a1Deferred.resolve()
  assert.equal((await a1Restore).status, 'stale')
  a2Deferred.resolve()
  assert.equal((await a2Restore).status, 'restored')
  assert.equal(activeFlowId.current, null)
  assert.deepEqual(settled, ['a2'])
})

test('A-B-A restore ownership leaves the real flow store on the newest A', async () => {
  const { startLastFlowRestore } = await loadRestoreModule()
  const originalFetch = globalThis.fetch
  const a1Response = createValueDeferred<Flow>()
  const a2Response = createValueDeferred<Flow>()
  const bResponse = createValueDeferred<Flow>()
  const flowA = createFlowFixture('flow-a', 'Flow A newest')
  const flowB = createFlowFixture('flow-b', 'Flow B stale')
  const activeFlowId = { current: null as string | null }
  let storedFlowId: string | null = 'flow-a'
  let aCalls = 0
  let bCalls = 0

  resetFlowStores()
  Object.assign(globalThis, {
    fetch: ((input: string | URL | Request, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : input.toString()
      const url = new URL(rawUrl, 'http://local.test')
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase()
      if (method !== 'GET') {
        return Promise.reject(new Error(`Unexpected request: ${method} ${url.pathname}`))
      }
      if (url.pathname === '/api/flows/flow-a') {
        const response = [a1Response, a2Response][aCalls]
        aCalls += 1
        if (!response) {
          return Promise.reject(new Error('Unexpected extra Flow A request'))
        }
        return response.promise.then((flow) => Response.json(flow))
      }
      if (url.pathname === '/api/flows/flow-b') {
        bCalls += 1
        return bResponse.promise.then((flow) => Response.json(flow))
      }
      return Promise.reject(new Error(`Unexpected request: ${method} ${url.pathname}`))
    }) as typeof fetch,
  })

  const start = (flowId: string) => {
    storedFlowId = flowId
    return startLastFlowRestore({
      activeFlowId,
      flowId,
      loadFlow: (id) => useFlowStore.getState().loadFlow(id),
      getCurrentFlowId: () => useFlowStore.getState().currentFlowId,
      getStoredFlowId: () => storedFlowId,
      clearStoredFlowId: () => {
        storedFlowId = null
      },
    })
  }

  try {
    const a1Restore = start('flow-a')
    await waitForCondition(() => aCalls === 1)
    const bRestore = start('flow-b')
    await waitForCondition(() => bCalls === 1)
    const a2Restore = start('flow-a')
    assert.ok(a1Restore)
    assert.ok(bRestore)
    assert.ok(a2Restore)

    await waitForCondition(() => aCalls === 2)

    bResponse.resolve(flowB)
    a1Response.resolve(flowA)
    assert.equal((await bRestore).status, 'stale')
    assert.equal((await a1Restore).status, 'stale')

    a2Response.resolve(flowA)
    assert.deepEqual(await a2Restore, { status: 'restored' })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A newest')
    assert.deepEqual(useCanvasStore.getState().nodes, flowA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetFlowStores()
  }
})
