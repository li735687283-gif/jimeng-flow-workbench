import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Flow } from '@jimeng-flow/shared/flow'
import { useCanvasStore } from '../src/state/canvasStore'
import { useFlowStore } from '../src/state/flowStore'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

type DeferredFlowRoute = {
  response: Deferred<Flow>
  calls: number
  bodies: unknown[]
}

function flowRoute(): DeferredFlowRoute {
  return { response: deferred<Flow>(), calls: 0, bodies: [] }
}

const TIMESTAMP = '2026-07-12T00:00:00.000Z'

function createFlow(id: string, name: string): Flow {
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

function createGenerationFlow(
  id: string,
  name: string,
  status: 'running' | 'success',
  assetId?: string,
): Flow {
  const flow = createFlow(id, name)
  return {
    ...flow,
    nodes: flow.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status,
        assetId,
      },
    })),
  }
}

function resetStores(): void {
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

function setCurrentFlow(id: string, name: string, flow: Flow): void {
  useFlowStore.setState({
    currentFlowId: id,
    currentFlowName: name,
    loading: false,
    saving: false,
    lastSavedAt: null,
    error: null,
  })
  useCanvasStore.setState({
    nodes: flow.nodes,
    edges: flow.edges,
    deletedNodeIds: [],
    selectedNodeId: null,
  })
}

function installDeferredFlowFetch(routes: Map<string, DeferredFlowRoute>): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : input.toString()
    const url = new URL(rawUrl, 'http://local.test')
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const key = `${method} ${url.pathname}`
    const route = routes.get(key)
    if (!route) {
      return Promise.reject(new Error(`Unexpected flow request: ${key}`))
    }
    route.calls += 1
    route.bodies.push(
      typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ?? null,
    )
    return route.response.promise.then((flow) => Response.json(flow))
  }) as typeof fetch
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve()
  }
}

async function waitForRouteCall(route: DeferredFlowRoute): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (route.calls > 0) return
    await Promise.resolve()
  }
  throw new Error('Expected flow request to start')
}

test('loading a different flow flushes the latest current canvas first', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const latestFlowA = createFlow('flow-a', 'Flow A latest')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', latestFlowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    await flushMicrotasks()
    const getStartedBeforeFlush = loadBRequest.calls > 0
    const flushStarted = updateARequest.calls > 0

    if (flushStarted) {
      updateARequest.response.resolve(latestFlowA)
      await waitForRouteCall(loadBRequest)
    }
    const loadFailure = new Error('Flow B load failed')
    loadBRequest.response.reject(loadFailure)
    const loadError = await loadBOutcome

    assert.equal(getStartedBeforeFlush, false)
    assert.equal(updateARequest.calls, 1)
    assert.deepEqual(updateARequest.bodies[0], {
      nodes: latestFlowA.nodes,
      edges: latestFlowA.edges,
    })
    assert.equal(loadError, loadFailure)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, latestFlowA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('creating a flow flushes the latest current canvas before POST', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const createRequest = flowRoute()
  const latestFlowA = createFlow('flow-a', 'Flow A latest')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', latestFlowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['POST /api/flows', createRequest],
      ]),
    ),
  })

  try {
    const create = useFlowStore.getState().createFlow()
    await flushMicrotasks()
    const postStartedBeforeFlush = createRequest.calls > 0
    const flushStarted = updateARequest.calls > 0

    if (flushStarted) {
      updateARequest.response.resolve(latestFlowA)
      await waitForRouteCall(createRequest)
    }
    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await create

    assert.equal(postStartedBeforeFlush, false)
    assert.equal(updateARequest.calls, 1)
    assert.deepEqual(updateARequest.bodies[0], {
      nodes: latestFlowA.nodes,
      edges: latestFlowA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
    assert.equal(useFlowStore.getState().currentFlowName, 'Created Flow')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('default same-flow navigation flushes local changes before GET', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadARequest = flowRoute()
  const localA = createFlow('flow-a', 'Flow A local changes')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A local changes', localA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-a', loadARequest],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    await flushMicrotasks()
    const getStartedBeforeFlush = loadARequest.calls > 0
    await waitForRouteCall(updateARequest)
    const flushedBody = updateARequest.bodies[0]

    updateARequest.response.resolve(localA)
    await waitForRouteCall(loadARequest)
    loadARequest.response.resolve(localA)
    await loadA

    assert.equal(getStartedBeforeFlush, false)
    assert.equal(updateARequest.calls, 1)
    assert.deepEqual(flushedBody, {
      nodes: localA.nodes,
      edges: localA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.deepEqual(useCanvasStore.getState().nodes, localA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('different-flow navigation repeats preflush until the canvas snapshot is stable', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const initialA = createFlow('flow-a', 'Flow A initial')
  const latestNode = createFlow('flow-a-latest', 'Flow A latest').nodes[0]!
  const latestNodes = [...initialA.nodes, latestNode]
  const latestEdges: Flow['edges'] = [
    {
      id: 'edge-late',
      source: initialA.nodes[0]!.id,
      target: latestNode!.id,
    },
  ]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A initial', initialA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    useCanvasStore.setState({
      nodes: latestNodes,
      edges: latestEdges,
      deletedNodeIds: ['deleted-during-preflush'],
    })

    updateARequest.response.resolve(initialA)
    await waitForRouteCall(loadBRequest)
    const updateCallsBeforeGet = updateARequest.calls
    const finalFlushBody = updateARequest.bodies.at(-1)
    loadBRequest.response.resolve(flowB)
    await loadB

    assert.equal(updateCallsBeforeGet, 2)
    assert.deepEqual(finalFlushBody, {
      nodes: latestNodes,
      edges: latestEdges,
      deletedNodeIds: ['deleted-during-preflush'],
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('different-flow navigation flushes edits made while the target GET is pending', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const initialA = createFlow('flow-a', 'Flow A initial')
  const lateNode = createFlow('flow-a-late', 'Flow A late').nodes[0]!
  const latestNodes = [...initialA.nodes, lateNode]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A initial', initialA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(initialA)
    await waitForRouteCall(loadBRequest)
    useCanvasStore.setState({
      nodes: latestNodes,
      deletedNodeIds: ['deleted-while-get-pending'],
    })

    loadBRequest.response.resolve(flowB)
    await loadB

    assert.equal(updateARequest.calls, 2)
    assert.deepEqual(updateARequest.bodies[1], {
      nodes: latestNodes,
      edges: initialA.edges,
      deletedNodeIds: ['deleted-while-get-pending'],
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('create navigation flushes source edits made while POST is pending', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const createRequest = flowRoute()
  const initialA = createFlow('flow-a', 'Flow A initial')
  const lateNode = createFlow('flow-a-late', 'Flow A late').nodes[0]!
  const latestNodes = [...initialA.nodes, lateNode]
  const created = createFlow('flow-created', 'Created Flow')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A initial', initialA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['POST /api/flows', createRequest],
      ]),
    ),
  })

  try {
    const create = useFlowStore.getState().createFlow()
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(initialA)
    await waitForRouteCall(createRequest)
    useCanvasStore.setState({ nodes: latestNodes })

    createRequest.response.resolve(created)
    await create

    assert.equal(updateARequest.calls, 2)
    assert.deepEqual(updateARequest.bodies[1], {
      nodes: latestNodes,
      edges: initialA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('the later load call wins even when both wait on the same save drain', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadCRequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const flowB = createFlow('flow-b', 'Flow B')
  const flowC = createFlow('flow-c', 'Flow C')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-c', loadCRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadC = useFlowStore.getState().loadFlow('flow-c')
    await flushMicrotasks()
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadCRequest)
    await flushMicrotasks()
    const olderLoadStarted = loadBRequest.calls > 0

    loadCRequest.response.resolve(flowC)
    if (olderLoadStarted) loadBRequest.response.resolve(flowB)
    await Promise.all([loadB, loadC])

    assert.equal(olderLoadStarted, false)
    assert.equal(loadBRequest.calls, 0)
    assert.equal(loadCRequest.calls, 1)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-c')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow C')
    assert.deepEqual(useCanvasStore.getState().nodes, flowC.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a later create call supersedes an earlier load waiting on save drain', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const createRequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const flowB = createFlow('flow-b', 'Flow B')
  const createdFlow = createFlow('flow-created', 'Created Flow')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['POST /api/flows', createRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const create = useFlowStore.getState().createFlow()
    await flushMicrotasks()
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(createRequest)
    await flushMicrotasks()
    const olderLoadStarted = loadBRequest.calls > 0

    createRequest.response.resolve(createdFlow)
    if (olderLoadStarted) loadBRequest.response.resolve(flowB)
    await Promise.all([loadB, create])

    assert.equal(olderLoadStarted, false)
    assert.equal(loadBRequest.calls, 0)
    assert.equal(createRequest.calls, 1)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
    assert.equal(useFlowStore.getState().currentFlowName, 'Created Flow')
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('different-flow navigation waits for same-flow generation refresh before flushing', async () => {
  const originalFetch = globalThis.fetch
  const reloadARequest = flowRoute()
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARequest],
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(runningA)
    await waitForRouteCall(reloadARequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await flushMicrotasks()
    const navigationPutStartedBeforeReload = updateARequest.calls > 1
    const bGetStartedBeforeReload = loadBRequest.calls > 0

    reloadARequest.response.resolve(completedA)
    await reloadA
    await waitForRouteCall(loadBRequest)
    const flushedBody = updateARequest.bodies.at(-1)
    loadBRequest.response.resolve(flowB)
    await loadB

    assert.equal(navigationPutStartedBeforeReload, false)
    assert.equal(bGetStartedBeforeReload, false)
    assert.deepEqual(flushedBody, {
      nodes: completedA.nodes,
      edges: completedA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('failed same-flow generation refresh blocks stale different-flow flush', async () => {
  const originalFetch = globalThis.fetch
  const reloadARequest = flowRoute()
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARequest],
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const reloadAOutcome = reloadA.then(
      () => null,
      (error: unknown) => error,
    )
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(runningA)
    await waitForRouteCall(reloadARequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    await flushMicrotasks()
    const navigationPutStartedBeforeReload = updateARequest.calls > 1
    const bGetStartedBeforeReload = loadBRequest.calls > 0

    const reloadFailure = new Error('same-flow generation refresh failed')
    reloadARequest.response.reject(reloadFailure)
    assert.equal(await reloadAOutcome, reloadFailure)
    const unexpectedLoadFailure = new Error('unexpected Flow B GET')
    if (loadBRequest.calls > 0) {
      loadBRequest.response.reject(unexpectedLoadFailure)
    }
    const loadBError = await loadBOutcome

    assert.equal(navigationPutStartedBeforeReload, false)
    assert.equal(bGetStartedBeforeReload, false)
    assert.equal(updateARequest.calls, 1)
    assert.equal(loadBRequest.calls, 0)
    assert.equal(loadBError, reloadFailure)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, runningA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a background refresh started after navigation cannot reclaim the old flow', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const refreshARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const refreshedA = createFlow('flow-a', 'Flow A refreshed')
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)

    const refreshA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    let refreshSettled = false
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )
    await flushMicrotasks()
    const refreshStarted = refreshARequest.calls > 0
    if (refreshStarted) refreshARequest.response.resolve(refreshedA)
    const refreshSettledBeforeNavigation = refreshSettled

    loadBRequest.response.resolve(flowB)
    await Promise.all([loadB, refreshA])

    assert.equal(refreshStarted, false)
    assert.equal(refreshSettledBeforeNavigation, false)
    assert.equal(refreshARequest.calls, 0)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow B')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a refresh requested during successful navigation waits and is discarded', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const refreshARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)

    let refreshSettled = false
    const refreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )
    await flushMicrotasks()
    const settledBeforeNavigation = refreshSettled

    loadBRequest.response.resolve(flowB)
    await Promise.all([loadB, refreshA])

    assert.equal(settledBeforeNavigation, false)
    assert.equal(refreshARequest.calls, 0)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a refresh requested during failed navigation runs once on the retained flow', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const refreshARequest = flowRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(runningA)
    await waitForRouteCall(loadBRequest)

    let refreshSettled = false
    const refreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    const duplicateRefreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )
    await flushMicrotasks()
    const settledBeforeNavigation = refreshSettled

    const loadFailure = new Error('Flow B navigation failed')
    const lateNode = createFlow('flow-a-late', 'Flow A late').nodes[0]!
    const completedWithLateEdit = {
      ...completedA,
      nodes: [...completedA.nodes, lateNode],
    }
    useCanvasStore.setState({
      nodes: [...runningA.nodes, lateNode],
    })
    loadBRequest.response.reject(loadFailure)
    assert.equal(await loadBOutcome, loadFailure)
    await waitForRouteCall(refreshARequest)
    const deferredFlushBody = updateARequest.bodies.at(-1)
    refreshARequest.response.resolve(completedWithLateEdit)
    await Promise.all([refreshA, duplicateRefreshA])

    assert.equal(settledBeforeNavigation, false)
    assert.equal(refreshA, duplicateRefreshA)
    assert.equal(refreshARequest.calls, 1)
    assert.equal(updateARequest.calls, 2)
    assert.deepEqual(deferredFlushBody, {
      nodes: JSON.parse(
        JSON.stringify([...runningA.nodes, lateNode]),
      ) as Flow['nodes'],
      edges: runningA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A completed')
    assert.equal(useFlowStore.getState().error, loadFailure.message)
    assert.deepEqual(
      useCanvasStore.getState().nodes,
      completedWithLateEdit.nodes,
    )
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a deferred refresh waits through a superseding navigation that leaves the flow', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadCRequest = flowRoute()
  const refreshARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const flowC = createFlow('flow-c', 'Flow C')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-c', loadCRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    void useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)
    let refreshSettled = false
    const refreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )

    const loadC = useFlowStore.getState().loadFlow('flow-c')
    await waitForRouteCall(loadCRequest)
    loadCRequest.response.resolve(flowC)
    await loadC
    await flushMicrotasks()
    const refreshSettledAfterLatestNavigation = refreshSettled
    await refreshA

    assert.equal(refreshSettledAfterLatestNavigation, true)
    assert.equal(refreshARequest.calls, 0)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-c')
    assert.deepEqual(useCanvasStore.getState().nodes, flowC.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a deferred refresh runs after a superseding navigation retains the flow', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const selectedA = createGenerationFlow(
    'flow-a',
    'Flow A selected',
    'success',
    'asset-selected-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-a', loadARequest],
      ]),
    ),
  })

  try {
    void useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)
    let refreshSettled = false
    const refreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )

    const selectA = useFlowStore.getState().loadFlow('flow-a')
    await waitForRouteCall(loadARequest)
    const callsBeforeLatestNavigation = loadARequest.calls

    loadARequest.response.resolve(selectedA)
    await selectA
    for (let attempt = 0; attempt < 50 && loadARequest.calls < 2; attempt += 1) {
      await Promise.resolve()
    }
    assert.equal(loadARequest.calls, 2)
    await refreshA
    const refreshSettledAfterLatestNavigation = refreshSettled

    assert.equal(refreshSettledAfterLatestNavigation, true)
    assert.equal(callsBeforeLatestNavigation, 1)
    assert.equal(loadARequest.calls, 2)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.deepEqual(useCanvasStore.getState().nodes, selectedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a deferred refresh escapes a hung superseded navigation when the latest navigation fails', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadCRequest = flowRoute()
  const refreshARequest = flowRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-c', loadCRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    void useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(runningA)
    await waitForRouteCall(loadBRequest)

    const refreshA = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })

    const loadC = useFlowStore.getState().loadFlow('flow-c')
    const loadCOutcome = loadC.then(
      () => null,
      (error: unknown) => error,
    )
    await waitForRouteCall(loadCRequest)
    const loadFailure = new Error('Flow C navigation failed')
    loadCRequest.response.reject(loadFailure)
    assert.equal(await loadCOutcome, loadFailure)

    await waitForRouteCall(refreshARequest)
    refreshARequest.response.resolve(completedA)
    await refreshA

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A completed')
    assert.equal(useFlowStore.getState().error, loadFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, completedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('an older navigation settling cannot clear the newer active navigation guard', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadCRequest = flowRoute()
  const refreshARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const flowB = createFlow('flow-b', 'Flow B')
  const flowC = createFlow('flow-c', 'Flow C')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-c', loadCRequest],
        ['GET /api/flows/flow-a', refreshARequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)

    const loadC = useFlowStore.getState().loadFlow('flow-c')
    await waitForRouteCall(loadCRequest)
    loadBRequest.response.resolve(flowB)
    await loadB

    const refreshA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    let refreshSettled = false
    void refreshA.then(
      () => {
        refreshSettled = true
      },
      () => {
        refreshSettled = true
      },
    )
    await flushMicrotasks()
    const refreshSettledBeforeLatestNavigation = refreshSettled

    loadCRequest.response.resolve(flowC)
    await Promise.all([loadC, refreshA])

    assert.equal(refreshSettledBeforeLatestNavigation, false)
    assert.equal(refreshARequest.calls, 0)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-c')
    assert.deepEqual(useCanvasStore.getState().nodes, flowC.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a default same-id navigation supersedes an older different-flow navigation', async () => {
  const originalFetch = globalThis.fetch
  const updateARequest = flowRoute()
  const loadBRequest = flowRoute()
  const loadARequest = flowRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  const selectedA = createFlow('flow-a', 'Flow A selected again')
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA)
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARequest],
        ['GET /api/flows/flow-b', loadBRequest],
        ['GET /api/flows/flow-a', loadARequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await waitForRouteCall(updateARequest)
    updateARequest.response.resolve(flowA)
    await waitForRouteCall(loadBRequest)

    const loadA = useFlowStore.getState().loadFlow('flow-a')
    await waitForRouteCall(loadARequest)
    loadARequest.response.resolve(selectedA)
    await loadA
    loadBRequest.response.resolve(flowB)
    await loadB

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A selected again')
    assert.deepEqual(useCanvasStore.getState().nodes, selectedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('an older load cannot publish before the latest pending load settles', async () => {
  const originalFetch = globalThis.fetch
  const flowARequest = flowRoute()
  const flowBRequest = flowRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-a', flowARequest],
        ['GET /api/flows/flow-b', flowBRequest],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    await waitForRouteCall(flowARequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')

    flowARequest.response.resolve(createFlow('flow-a', 'Flow A'))
    await loadA

    let flowState = useFlowStore.getState()
    let canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, null)
    assert.equal(flowState.loading, true)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, [])

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB

    flowState = useFlowStore.getState()
    canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, createFlow('flow-b', 'Flow B').nodes)
    assert.deepEqual(canvasState.edges, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a late failed load rejects without polluting a newer flow', async () => {
  const originalFetch = globalThis.fetch
  const flowARequest = flowRoute()
  const flowBRequest = flowRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-a', flowARequest],
        ['GET /api/flows/flow-b', flowBRequest],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    await waitForRouteCall(flowARequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')

    const lateFailure = new Error('late Flow A failure')
    flowARequest.response.reject(lateFailure)
    await assert.rejects(loadA, lateFailure)

    let flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, null)
    assert.equal(flowState.loading, true)
    assert.equal(flowState.error, null)

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB

    flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, createFlow('flow-b', 'Flow B').nodes)
    assert.deepEqual(canvasState.edges, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('creating a flow supersedes an older pending load', async () => {
  const originalFetch = globalThis.fetch
  const flowARequest = flowRoute()
  const createRequest = flowRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-a', flowARequest],
        ['POST /api/flows', createRequest],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    const create = useFlowStore.getState().createFlow()

    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await create
    flowARequest.response.resolve(createFlow('flow-a', 'Flow A'))
    await loadA

    const flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-created')
    assert.equal(flowState.currentFlowName, 'Created Flow')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, [])
    assert.deepEqual(canvasState.edges, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('loading a flow supersedes an older pending create', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const flowBRequest = flowRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['GET /api/flows/flow-b', flowBRequest],
      ]),
    ),
  })

  try {
    const create = useFlowStore.getState().createFlow()
    await waitForRouteCall(createRequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB
    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await create

    const flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, createFlow('flow-b', 'Flow B').nodes)
    assert.deepEqual(canvasState.edges, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('loading a flow supersedes ensure before it can update an orphan flow', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const flowBRequest = flowRoute()
  const orphanUpdateRequest = flowRoute()
  resetStores()
  useCanvasStore.setState({
    nodes: createFlow('draft', 'Draft').nodes,
    edges: [],
  })
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['GET /api/flows/flow-b', flowBRequest],
        ['PUT /api/flows/flow-created', orphanUpdateRequest],
      ]),
    ),
  })

  try {
    const ensure = useFlowStore.getState().ensureCurrentFlow()
    const loadB = useFlowStore.getState().loadFlow('flow-b')

    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await flushMicrotasks()
    const orphanPutStarted = orphanUpdateRequest.calls > 0
    if (orphanPutStarted) {
      orphanUpdateRequest.response.resolve(
        createFlow('flow-created', 'Created Flow'),
      )
    }
    const ensureError = await ensure.then(
      () => null,
      (error: unknown) => error,
    )

    let flowState = useFlowStore.getState()
    assert.equal((ensureError as Error | null)?.name, 'FlowIntentSupersededError')
    assert.equal(orphanPutStarted, false)
    assert.equal(flowState.currentFlowId, null)
    assert.equal(flowState.loading, true)
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, null)

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB

    flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, createFlow('flow-b', 'Flow B').nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('ensure supersedes an older pending load and remains the active owner', async () => {
  const originalFetch = globalThis.fetch
  const flowBRequest = flowRoute()
  const createRequest = flowRoute()
  const updateRequest = flowRoute()
  const draft = createFlow('draft', 'Draft')
  resetStores()
  useCanvasStore.setState({ nodes: draft.nodes, edges: [] })
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['GET /api/flows/flow-b', flowBRequest],
        ['POST /api/flows', createRequest],
        ['PUT /api/flows/flow-created', updateRequest],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const ensure = useFlowStore.getState().ensureCurrentFlow()

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB
    assert.equal(useFlowStore.getState().currentFlowId, null)

    const created = createFlow('flow-created', 'Created Flow')
    createRequest.response.resolve(created)
    await waitForRouteCall(updateRequest)
    updateRequest.response.resolve(created)
    const ensuredFlowId = await ensure

    assert.equal(ensuredFlowId, 'flow-created')
    assert.equal(createRequest.calls, 1)
    assert.equal(updateRequest.calls, 1)
    assert.deepEqual(updateRequest.bodies[0], {
      nodes: draft.nodes,
      edges: [],
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
    assert.deepEqual(useCanvasStore.getState().nodes, draft.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('ensure supersedes an older create before it can allocate flow ownership', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const updateRequest = flowRoute()
  const draft = createFlow('draft', 'Draft')
  resetStores()
  useCanvasStore.setState({ nodes: draft.nodes, edges: [] })
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['PUT /api/flows/flow-created', updateRequest],
      ]),
    ),
  })

  try {
    const create = useFlowStore.getState().createFlow()
    const ensure = useFlowStore.getState().ensureCurrentFlow()
    const created = createFlow('flow-created', 'Created Flow')

    await flushMicrotasks()
    createRequest.response.resolve(created)
    await create
    await waitForRouteCall(updateRequest)
    updateRequest.response.resolve(created)
    const ensuredFlowId = await ensure

    assert.equal(ensuredFlowId, 'flow-created')
    assert.equal(createRequest.calls, 1)
    assert.equal(updateRequest.calls, 1)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
    assert.deepEqual(useCanvasStore.getState().nodes, draft.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a stale create failure cannot end or pollute a newer pending load', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const flowBRequest = flowRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['GET /api/flows/flow-b', flowBRequest],
      ]),
    ),
  })

  try {
    const create = useFlowStore.getState().createFlow()
    await waitForRouteCall(createRequest)
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const staleFailure = new Error('stale create failure')
    const createRejected = assert.rejects(create, staleFailure)
    createRequest.response.reject(staleFailure)
    await createRejected

    let flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, null)
    assert.equal(flowState.loading, true)
    assert.equal(flowState.error, null)

    flowBRequest.response.resolve(createFlow('flow-b', 'Flow B'))
    await loadB
    flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.loading, false)
    assert.equal(flowState.error, null)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('concurrent ensure calls share one create and update operation', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const updateRequest = flowRoute()
  resetStores()
  useCanvasStore.setState({
    nodes: createFlow('draft', 'Draft').nodes,
    edges: [],
  })
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['PUT /api/flows/flow-created', updateRequest],
      ]),
    ),
  })

  try {
    const firstEnsure = useFlowStore.getState().ensureCurrentFlow()
    const secondEnsure = useFlowStore.getState().ensureCurrentFlow()
    const samePromise = firstEnsure === secondEnsure

    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await Promise.resolve()
    updateRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    const [firstId, secondId] = await Promise.all([firstEnsure, secondEnsure])

    assert.equal(samePromise, true)
    assert.equal(createRequest.calls, 1)
    assert.equal(updateRequest.calls, 1)
    assert.equal(firstId, 'flow-created')
    assert.equal(secondId, 'flow-created')
    assert.deepEqual(
      updateRequest.bodies[0],
      {
        nodes: createFlow('draft', 'Draft').nodes,
        edges: [],
      },
    )
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-created')
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('ensure acknowledgement preserves deletion ids added after its snapshot', async () => {
  const originalFetch = globalThis.fetch
  const createRequest = flowRoute()
  const updateRequest = flowRoute()
  resetStores()
  useCanvasStore.setState({
    nodes: createFlow('draft', 'Draft').nodes,
    edges: [],
    deletedNodeIds: ['deleted-x'],
  })
  Object.assign(globalThis, {
    fetch: installDeferredFlowFetch(
      new Map([
        ['POST /api/flows', createRequest],
        ['PUT /api/flows/flow-created', updateRequest],
      ]),
    ),
  })

  try {
    const ensure = useFlowStore.getState().ensureCurrentFlow()
    useCanvasStore.setState({
      deletedNodeIds: ['deleted-x', 'deleted-y'],
    })
    createRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await flushMicrotasks()
    updateRequest.response.resolve(createFlow('flow-created', 'Created Flow'))
    await ensure

    assert.deepEqual(useCanvasStore.getState().deletedNodeIds, ['deleted-y'])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})
