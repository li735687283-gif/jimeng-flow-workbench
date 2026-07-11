import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Flow, FlowNode } from '@jimeng-flow/shared/flow'
import { useCanvasStore } from '../src/state/canvasStore'
import { useFlowStore } from '../src/state/flowStore'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

type ObservedCall = {
  body: unknown
  response: Deferred<unknown>
}

type ObservedRoute = {
  calls: ObservedCall[]
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

function observedRoute(): ObservedRoute {
  return { calls: [] }
}

const TIMESTAMP = '2026-07-12T00:00:00.000Z'

function createImageNode(id: string, prompt: string): FlowNode {
  return {
    id,
    type: 'image',
    position: { x: 120, y: 240 },
    data: {
      id,
      title: `${id} title`,
      prompt,
      status: 'success',
      assetId: `asset-${id}`,
      model: 'jimeng-4.0',
      aspectRatio: '1:1',
      count: 1,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
  }
}

function createFlow(
  id: string,
  name: string,
  nodes: FlowNode[] = [createImageNode(`image-${id}`, `${name} prompt`)],
): Flow {
  return {
    id,
    name,
    nodes,
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

function setCurrentFlow(id: string, name: string, nodes: FlowNode[]): void {
  useFlowStore.setState({
    currentFlowId: id,
    currentFlowName: name,
    loading: false,
    saving: false,
    lastSavedAt: null,
    error: null,
  })
  useCanvasStore.setState({
    nodes,
    edges: [],
    deletedNodeIds: [],
    selectedNodeId: null,
  })
}

function installObservedFetch(routes: Map<string, ObservedRoute>): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : input.toString()
    const url = new URL(rawUrl, 'http://local.test')
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const key = `${method} ${url.pathname}`
    const route = routes.get(key)
    if (!route) {
      return Promise.reject(new Error(`Unexpected flow request: ${key}`))
    }
    const call: ObservedCall = {
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ?? null,
      response: deferred<unknown>(),
    }
    route.calls.push(call)
    return call.response.promise.then((flow) => Response.json(flow))
  }) as typeof fetch
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve()
  }
}

async function waitForCall(route: ObservedRoute, index: number): Promise<ObservedCall> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const call = route.calls[index]
    if (call) return call
    await Promise.resolve()
  }
  throw new Error(`Expected request call ${index + 1}, received ${route.calls.length}`)
}

test('concurrent saves serialize and the queued save reads the latest canvas', async () => {
  const originalFetch = globalThis.fetch
  const updateRoute = observedRoute()
  const firstNodes = [createImageNode('image-a', 'first snapshot')]
  const queuedNodes = [createImageNode('image-a', 'queued snapshot')]
  const latestNodes = [createImageNode('image-a', 'execution-time snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', firstNodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([['PUT /api/flows/flow-a', updateRoute]]),
    ),
  })

  try {
    const firstSave = useFlowStore.getState().saveCurrent()
    const firstCall = await waitForCall(updateRoute, 0)
    useCanvasStore.setState({ nodes: queuedNodes })
    const secondSave = useFlowStore.getState().saveCurrent()
    await flushMicrotasks()
    const secondStartedBeforeFirstSettled = updateRoute.calls.length > 1
    useCanvasStore.setState({ nodes: latestNodes })

    firstCall.response.resolve(createFlow('flow-a', 'Flow A saved once', firstNodes))
    await firstSave
    const secondCall = await waitForCall(updateRoute, 1)
    const secondBody = secondCall.body
    secondCall.response.resolve(createFlow('flow-a', 'Flow A latest', latestNodes))
    await secondSave

    assert.equal(secondStartedBeforeFirstSettled, false)
    assert.deepEqual(secondBody, { nodes: latestNodes, edges: [] })
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A latest')
    assert.equal(useFlowStore.getState().saving, false)
    assert.equal(useFlowStore.getState().error, null)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a failed save does not block the next queued save', async () => {
  const originalFetch = globalThis.fetch
  const updateRoute = observedRoute()
  const firstNodes = [createImageNode('image-a', 'first snapshot')]
  const latestNodes = [createImageNode('image-a', 'latest snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', firstNodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([['PUT /api/flows/flow-a', updateRoute]]),
    ),
  })

  try {
    const firstSave = useFlowStore.getState().saveCurrent()
    const firstCall = await waitForCall(updateRoute, 0)
    useCanvasStore.setState({ nodes: latestNodes })
    const secondSave = useFlowStore.getState().saveCurrent()

    const firstRejected = assert.rejects(firstSave, /first save failed/i)
    firstCall.response.reject(new Error('first save failed'))
    await firstRejected
    const secondCall = await waitForCall(updateRoute, 1)
    assert.equal(useFlowStore.getState().saving, true)
    secondCall.response.resolve(createFlow('flow-a', 'Flow A recovered', latestNodes))
    await secondSave

    assert.equal(updateRoute.calls.length, 2)
    assert.deepEqual(secondCall.body, { nodes: latestNodes, edges: [] })
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A recovered')
    assert.equal(useFlowStore.getState().saving, false)
    assert.equal(useFlowStore.getState().error, null)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a save acknowledgement removes only deletion ids sent in its snapshot', async () => {
  const originalFetch = globalThis.fetch
  const updateRoute = observedRoute()
  const nodes = [createImageNode('image-a', 'current snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodes)
  useCanvasStore.setState({ deletedNodeIds: ['deleted-x'] })
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([['PUT /api/flows/flow-a', updateRoute]]),
    ),
  })

  try {
    const save = useFlowStore.getState().saveCurrent()
    const call = await waitForCall(updateRoute, 0)
    useCanvasStore.setState({ deletedNodeIds: ['deleted-x', 'deleted-y'] })
    call.response.resolve(createFlow('flow-a', 'Flow A saved', nodes))
    await save

    assert.deepEqual(call.body, {
      nodes,
      edges: [],
      deletedNodeIds: ['deleted-x'],
    })
    assert.deepEqual(useCanvasStore.getState().deletedNodeIds, ['deleted-y'])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('navigation drains queued saves and persists the final snapshot before loading', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const nodesA1 = [createImageNode('image-a', 'Flow A first snapshot')]
  const nodesA2 = [createImageNode('image-a', 'Flow A final snapshot')]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA1)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
      ]),
    ),
  })

  try {
    const firstSave = useFlowStore.getState().saveCurrent()
    const firstCall = await waitForCall(updateARoute, 0)
    useCanvasStore.setState({ nodes: nodesA2 })
    const queuedSave = useFlowStore.getState().saveCurrent()
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await flushMicrotasks()
    const getStartedBeforeFinalSave = loadBRoute.calls.length > 0

    firstCall.response.resolve(createFlow('flow-a', 'Flow A first saved', nodesA1))
    await firstSave

    let nextUpdateIndex = 1
    for (let attempt = 0; attempt < 20 && loadBRoute.calls.length === 0; attempt += 1) {
      await flushMicrotasks()
      const nextUpdate = updateARoute.calls[nextUpdateIndex]
      if (nextUpdate) {
        nextUpdate.response.resolve(
          createFlow('flow-a', 'Flow A final saved', nodesA2),
        )
        nextUpdateIndex += 1
      }
    }

    const loadBCall = await waitForCall(loadBRoute, 0)
    loadBCall.response.resolve(flowB)
    await Promise.all([queuedSave, loadB])

    const finalUpdateBody = updateARoute.calls.at(-1)?.body as {
      nodes?: FlowNode[]
    } | undefined

    assert.equal(getStartedBeforeFinalSave, false)
    assert.equal(updateARoute.calls.length >= 2, true)
    assert.deepEqual(finalUpdateBody?.nodes, nodesA2)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow B')
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('same-flow navigation refetches after edits made while GET is pending', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadARoute = observedRoute()
  const initialNodes = [createImageNode('image-a', 'initial snapshot')]
  const latestNodes = [
    ...initialNodes,
    createImageNode('image-late', 'late snapshot'),
  ]
  const initialA = createFlow('flow-a', 'Flow A initial', initialNodes)
  const latestA = createFlow('flow-a', 'Flow A latest', latestNodes)
  resetStores()
  setCurrentFlow('flow-a', 'Flow A initial', initialNodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-a', loadARoute],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    const initialSaveCall = await waitForCall(updateARoute, 0)
    initialSaveCall.response.resolve(initialA)
    const initialLoadCall = await waitForCall(loadARoute, 0)
    useCanvasStore.setState({ nodes: latestNodes })

    initialLoadCall.response.resolve(initialA)
    const finalSaveCall = await waitForCall(updateARoute, 1)
    finalSaveCall.response.resolve(latestA)
    const finalLoadCall = await waitForCall(loadARoute, 1)
    finalLoadCall.response.resolve(latestA)
    await loadA

    assert.equal(updateARoute.calls.length, 2)
    assert.equal(loadARoute.calls.length, 2)
    assert.deepEqual(finalSaveCall.body, {
      nodes: latestNodes,
      edges: [],
    })
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A latest')
    assert.deepEqual(useCanvasStore.getState().nodes, latestNodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a late autosave during loading cannot leave the new flow saving forever', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
      ]),
    ),
  })

  try {
    const initialSave = useFlowStore.getState().saveCurrent()
    const initialCall = await waitForCall(updateARoute, 0)
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    initialCall.response.resolve(createFlow('flow-a', 'Flow A flushed', nodesA))
    await initialSave

    let nextUpdateIndex = 1
    for (let attempt = 0; attempt < 20 && loadBRoute.calls.length === 0; attempt += 1) {
      await flushMicrotasks()
      const nextUpdate = updateARoute.calls[nextUpdateIndex]
      if (nextUpdate) {
        nextUpdate.response.resolve(
          createFlow('flow-a', 'Flow A flushed', nodesA),
        )
        nextUpdateIndex += 1
      }
    }

    const loadBCall = await waitForCall(loadBRoute, 0)
    const lateSave = useFlowStore.getState().saveCurrent()
    const lateSaveCall = await waitForCall(updateARoute, nextUpdateIndex)
    loadBCall.response.resolve(flowB)
    lateSaveCall.response.resolve(
      createFlow('flow-a', 'Late Flow A autosave', nodesA),
    )
    await Promise.all([loadB, lateSave])

    const flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-b')
    assert.equal(flowState.currentFlowName, 'Flow B')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a late source autosave failure aborts target publication', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const flushCall = await waitForCall(updateARoute, 0)
    flushCall.response.resolve(createFlow('flow-a', 'Flow A flushed', nodesA))
    const loadBCall = await waitForCall(loadBRoute, 0)

    const lateSave = useFlowStore.getState().saveCurrent()
    const lateSaveCall = await waitForCall(updateARoute, 1)
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    const lateSaveOutcome = lateSave.then(
      () => null,
      (error: unknown) => error,
    )
    loadBCall.response.resolve(flowB)

    const lateFailure = new Error('late Flow A autosave failed')
    lateSaveCall.response.reject(lateFailure)
    assert.equal(await lateSaveOutcome, lateFailure)
    assert.equal(await loadBOutcome, lateFailure)

    const flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-a')
    assert.equal(flowState.currentFlowName, 'Flow A flushed')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, lateFailure.message)
    assert.deepEqual(canvasState.nodes, nodesA)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a late source autosave success cannot clear a navigation failure', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    const flushCall = await waitForCall(updateARoute, 0)
    flushCall.response.resolve(createFlow('flow-a', 'Flow A flushed', nodesA))
    const loadBCall = await waitForCall(loadBRoute, 0)

    const lateSave = useFlowStore.getState().saveCurrent()
    const lateSaveCall = await waitForCall(updateARoute, 1)
    const loadFailure = new Error('load B failed')
    loadBCall.response.reject(loadFailure)
    assert.equal(await loadBOutcome, loadFailure)
    assert.equal(useFlowStore.getState().error, loadFailure.message)

    lateSaveCall.response.resolve(
      createFlow('flow-a', 'Flow A autosaved', nodesA),
    )
    await lateSave

    const flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-a')
    assert.equal(flowState.currentFlowName, 'Flow A autosaved')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, loadFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, nodesA)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('same-flow refresh blocks an older same-id save response from publishing', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadA2Route = observedRoute()
  const nodesA1 = [createImageNode('image-a', 'Flow A first intent')]
  const flowA2 = createFlow('flow-a', 'Flow A second intent', [
    createImageNode('image-a', 'Flow A second intent'),
  ])
  resetStores()
  setCurrentFlow('flow-a', 'Flow A first intent', nodesA1)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-a', loadA2Route],
      ]),
    ),
  })

  try {
    const saveA1 = useFlowStore.getState().saveCurrent()
    const saveA1Call = await waitForCall(updateARoute, 0)
    const loadA2 = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    saveA1Call.response.resolve(
      createFlow('flow-a', 'Late Flow A first response', nodesA1),
    )
    await saveA1
    const refreshPreflushCall = await waitForCall(updateARoute, 1)
    refreshPreflushCall.response.resolve(
      createFlow('flow-a', 'Flow A first intent', nodesA1),
    )
    const loadA2Call = await waitForCall(loadA2Route, 0)
    loadA2Call.response.resolve(flowA2)
    await loadA2
    useCanvasStore.setState({ deletedNodeIds: ['flow-a2-deleted'] })

    const flowState = useFlowStore.getState()
    const canvasState = useCanvasStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-a')
    assert.equal(flowState.currentFlowName, 'Flow A second intent')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(canvasState.nodes, flowA2.nodes)
    assert.deepEqual(canvasState.deletedNodeIds, ['flow-a2-deleted'])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a superseded same-flow refresh failure resolves silently after newer success', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    const firstReload = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const firstPreflushCall = await waitForCall(updateARoute, 0)
    firstPreflushCall.response.resolve(runningA)
    const firstReloadCall = await waitForCall(reloadARoute, 0)
    const firstReloadOutcome = firstReload.then(
      () => null,
      (error: unknown) => error,
    )
    const latestReload = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const latestPreflushCall = await waitForCall(updateARoute, 1)
    latestPreflushCall.response.resolve(runningA)
    const latestReloadCall = await waitForCall(reloadARoute, 1)

    latestReloadCall.response.resolve(completedA)
    await latestReload
    const staleFailure = new Error('superseded refresh failed')
    firstReloadCall.response.reject(staleFailure)
    const staleOutcome = await firstReloadOutcome

    assert.equal(staleOutcome, null)
    assert.equal(reloadARoute.calls.length, 2)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A completed')
    assert.equal(useFlowStore.getState().error, null)
    assert.deepEqual(useCanvasStore.getState().nodes, completedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a save waiting on a hung refresh follows the superseding refresh barrier', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    void useFlowStore.getState().loadFlow('flow-a', { mode: 'refresh' })
    const firstPreflushCall = await waitForCall(updateARoute, 0)
    firstPreflushCall.response.resolve(runningA)
    await waitForCall(reloadARoute, 0)

    const waitingSave = useFlowStore.getState().saveCurrent()
    const latestReload = useFlowStore
      .getState()
      .loadFlow('flow-a', { mode: 'refresh' })
    const latestPreflushCall = await waitForCall(updateARoute, 1)
    latestPreflushCall.response.resolve(runningA)
    const latestReloadCall = await waitForCall(reloadARoute, 1)
    latestReloadCall.response.resolve(completedA)
    await latestReload

    const resumedSaveCall = await waitForCall(updateARoute, 2)
    assert.deepEqual(resumedSaveCall.body, {
      nodes: JSON.parse(JSON.stringify(completedA.nodes)) as FlowNode[],
      edges: completedA.edges,
    })
    resumedSaveCall.response.resolve(completedA)
    await waitingSave

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, completedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('direct refresh preflushes and refetches edits made while GET is pending', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const reloadARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  const lateNode = createImageNode('image-late', 'late local edit')
  const localNodes = [...runningA.nodes, lateNode]
  const completedWithLateEdit = createFlow(
    'flow-a',
    'Flow A completed with local edit',
    [...completedA.nodes, lateNode],
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-a', reloadARoute],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    await flushMicrotasks()
    const initialSaveCall = updateARoute.calls[0]
    if (!initialSaveCall) {
      const prematureReloadCall = reloadARoute.calls[0]
      useCanvasStore.setState({ nodes: localNodes })
      if (prematureReloadCall) {
        prematureReloadCall.response.resolve(completedWithLateEdit)
        await reloadA
      }
    }
    assert.ok(initialSaveCall, 'direct refresh must preflush before GET')

    initialSaveCall.response.resolve(runningA)
    const initialReloadCall = await waitForCall(reloadARoute, 0)
    useCanvasStore.setState({ nodes: localNodes })
    initialReloadCall.response.resolve(completedA)

    const finalSaveCall = await waitForCall(updateARoute, 1)
    finalSaveCall.response.resolve(completedWithLateEdit)
    const finalReloadCall = await waitForCall(reloadARoute, 1)
    finalReloadCall.response.resolve(completedWithLateEdit)
    await reloadA

    assert.equal(updateARoute.calls.length, 2)
    assert.equal(reloadARoute.calls.length, 2)
    assert.deepEqual(
      (finalSaveCall.body as { nodes: FlowNode[] }).nodes.map(
        (node) => node.id,
      ),
      localNodes.map((node) => node.id),
    )
    assert.equal(useFlowStore.getState().currentFlowName, completedWithLateEdit.name)
    assert.deepEqual(useCanvasStore.getState().nodes, completedWithLateEdit.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('autosave waits for same-flow generation refresh and sends completed canvas', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const completedA = createGenerationFlow(
    'flow-a',
    'Flow A completed',
    'success',
    'asset-completed-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const refreshPreflushCall = await waitForCall(updateARoute, 0)
    refreshPreflushCall.response.resolve(runningA)
    const reloadCall = await waitForCall(reloadARoute, 0)
    const saveA = useFlowStore.getState().saveCurrent()
    await flushMicrotasks()
    const autosavePutStartedBeforeReload = updateARoute.calls.length > 1

    reloadCall.response.resolve(completedA)
    await reloadA
    const saveCall = await waitForCall(updateARoute, 1)
    const saveBody = saveCall.body
    saveCall.response.resolve(completedA)
    await saveA

    assert.equal(autosavePutStartedBeforeReload, false)
    assert.deepEqual(saveBody, {
      nodes: completedA.nodes,
      edges: completedA.edges,
    })
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.deepEqual(useCanvasStore.getState().nodes, completedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a failed same-flow refresh rejects a waiting save without issuing a PUT', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const refreshPreflushCall = await waitForCall(updateARoute, 0)
    refreshPreflushCall.response.resolve(runningA)
    const reloadCall = await waitForCall(reloadARoute, 0)
    const saveA = useFlowStore.getState().saveCurrent()
    const reloadOutcome = reloadA.then(
      () => null,
      (error: unknown) => error,
    )
    const saveOutcome = saveA.then(
      () => null,
      (error: unknown) => error,
    )

    const reloadFailure = new Error('same-flow refresh failed')
    reloadCall.response.reject(reloadFailure)
    const [reloadError, saveError] = await Promise.all([
      reloadOutcome,
      saveOutcome,
    ])

    assert.equal(reloadError, reloadFailure)
    assert.equal(saveError, reloadFailure)
    assert.equal(updateARoute.calls.length, 1)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().saving, false)
    assert.equal(useFlowStore.getState().error, reloadFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, runningA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a failed deferred-refresh preflush keeps local edits and skips GET', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const reloadARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const lateNodes = [
    ...runningA.nodes,
    createImageNode('image-late', 'late local edit'),
  ]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
        ['GET /api/flows/flow-a', reloadARoute],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const loadBOutcome = loadB.then(
      () => null,
      (error: unknown) => error,
    )
    const initialSaveCall = await waitForCall(updateARoute, 0)
    initialSaveCall.response.resolve(runningA)
    const loadBCall = await waitForCall(loadBRoute, 0)
    useCanvasStore.setState({ nodes: lateNodes })

    const deferredReload = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const deferredReloadOutcome = deferredReload.then(
      () => null,
      (error: unknown) => error,
    )
    const navigationFailure = new Error('Flow B navigation failed')
    loadBCall.response.reject(navigationFailure)
    assert.equal(await loadBOutcome, navigationFailure)
    await flushMicrotasks()

    const deferredSaveCall = updateARoute.calls[1]
    const prematureReloadCall = reloadARoute.calls[0]
    if (!deferredSaveCall && prematureReloadCall) {
      prematureReloadCall.response.resolve(
        createFlow('flow-a', 'Unexpected reload', lateNodes),
      )
      await deferredReloadOutcome
    }
    assert.ok(deferredSaveCall, 'deferred refresh must preflush retained edits')

    const saveFailure = new Error('deferred preflush failed')
    deferredSaveCall.response.reject(saveFailure)
    assert.equal(await deferredReloadOutcome, saveFailure)

    assert.equal(reloadARoute.calls.length, 0)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().error, saveFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, lateNodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a queued save retains the failed refresh outcome after the barrier is cleared', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    const firstSave = useFlowStore.getState().saveCurrent()
    const firstSaveCall = await waitForCall(updateARoute, 0)
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const queuedSave = useFlowStore.getState().saveCurrent()
    const reloadOutcome = reloadA.then(
      () => null,
      (error: unknown) => error,
    )
    const queuedSaveOutcome = queuedSave.then(
      () => null,
      (error: unknown) => error,
    )

    firstSaveCall.response.resolve(runningA)
    await firstSave
    const refreshPreflushCall = await waitForCall(updateARoute, 1)
    refreshPreflushCall.response.resolve(runningA)
    const reloadCall = await waitForCall(reloadARoute, 0)
    const reloadFailure = new Error('queued refresh failed')
    reloadCall.response.reject(reloadFailure)
    assert.equal(await reloadOutcome, reloadFailure)
    const queuedSaveError = await queuedSaveOutcome

    assert.equal(queuedSaveError, reloadFailure)
    assert.equal(updateARoute.calls.length, 2)
    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().saving, false)
    assert.equal(useFlowStore.getState().error, reloadFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, runningA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('an older refresh settling cannot clear a newer refresh save barrier', async () => {
  const originalFetch = globalThis.fetch
  const reloadARoute = observedRoute()
  const updateARoute = observedRoute()
  const runningA = createGenerationFlow('flow-a', 'Flow A running', 'running')
  const firstCompletedA = createGenerationFlow(
    'flow-a',
    'Flow A first completion',
    'success',
    'asset-first-a',
  )
  const latestCompletedA = createGenerationFlow(
    'flow-a',
    'Flow A latest completion',
    'success',
    'asset-latest-a',
  )
  resetStores()
  setCurrentFlow('flow-a', 'Flow A running', runningA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', reloadARoute],
        ['PUT /api/flows/flow-a', updateARoute],
      ]),
    ),
  })

  try {
    const firstReload = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const firstPreflushCall = await waitForCall(updateARoute, 0)
    firstPreflushCall.response.resolve(runningA)
    const firstReloadCall = await waitForCall(reloadARoute, 0)
    const latestReload = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const latestPreflushCall = await waitForCall(updateARoute, 1)
    latestPreflushCall.response.resolve(runningA)
    const latestReloadCall = await waitForCall(reloadARoute, 1)
    const saveA = useFlowStore.getState().saveCurrent()

    firstReloadCall.response.resolve(firstCompletedA)
    await firstReload
    await flushMicrotasks()
    assert.equal(updateARoute.calls.length, 2)

    latestReloadCall.response.resolve(latestCompletedA)
    await latestReload
    const saveCall = await waitForCall(updateARoute, 2)
    assert.equal(useFlowStore.getState().saving, true)
    assert.deepEqual(saveCall.body, {
      nodes: latestCompletedA.nodes,
      edges: latestCompletedA.edges,
    })
    saveCall.response.resolve(latestCompletedA)
    await saveA

    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A latest completion')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, latestCompletedA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('deleting the current flow settles a late in-flight save indicator', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const deleteARoute = observedRoute()
  const listRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const saveA = useFlowStore.getState().saveCurrent()
    const saveCall = await waitForCall(updateARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteA

    saveCall.response.resolve(createFlow('flow-a', 'Late Flow A save', nodesA))
    await saveA

    const flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, null)
    assert.equal(flowState.currentFlowName, '无限画布')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, null)
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a successful delete prevents a pending load from resurrecting that flow', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadARoute = observedRoute()
  const deleteARoute = observedRoute()
  const listRoute = observedRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', flowA.nodes)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-a', loadARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    const flushCall = await waitForCall(updateARoute, 0)
    flushCall.response.resolve(flowA)
    const loadACall = await waitForCall(loadARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteA

    loadACall.response.resolve(flowA)
    await loadA

    assert.equal(useFlowStore.getState().currentFlowId, null)
    assert.equal(useFlowStore.getState().currentFlowName, '无限画布')
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a late deleted-flow load failure cannot publish an error', async () => {
  const originalFetch = globalThis.fetch
  const loadARoute = observedRoute()
  const deleteARoute = observedRoute()
  const listRoute = observedRoute()
  resetStores()
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', loadARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    const loadAOutcome = loadA.then(
      () => null,
      (error: unknown) => error,
    )
    const loadACall = await waitForCall(loadARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteA

    const lateFailure = new Error('late deleted-flow load failure')
    loadACall.response.reject(lateFailure)
    assert.equal(await loadAOutcome, lateFailure)

    assert.equal(useFlowStore.getState().currentFlowId, null)
    assert.equal(useFlowStore.getState().error, null)
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('deleting a pending navigation target keeps the source flow current', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const deleteBRoute = observedRoute()
  const listRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
        ['DELETE /api/flows/flow-b', deleteBRoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    const flushCall = await waitForCall(updateARoute, 0)
    flushCall.response.resolve(createFlow('flow-a', 'Flow A flushed', nodesA))
    const loadBCall = await waitForCall(loadBRoute, 0)

    const deleteB = useFlowStore.getState().deleteFlow('flow-b')
    const deleteCall = await waitForCall(deleteBRoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteB

    loadBCall.response.resolve(flowB)
    await loadB

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A flushed')
    assert.deepEqual(useCanvasStore.getState().nodes, nodesA)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a failed delete does not invalidate the pending load for that flow', async () => {
  const originalFetch = globalThis.fetch
  const loadARoute = observedRoute()
  const deleteARoute = observedRoute()
  const flowA = createFlow('flow-a', 'Flow A')
  resetStores()
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['GET /api/flows/flow-a', loadARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
      ]),
    ),
  })

  try {
    const loadA = useFlowStore.getState().loadFlow('flow-a')
    const loadACall = await waitForCall(loadARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    const deleteFailure = new Error('delete Flow A failed')
    const deleteOutcome = deleteA.then(
      () => null,
      (error: unknown) => error,
    )
    deleteCall.response.reject(deleteFailure)
    assert.equal(await deleteOutcome, deleteFailure)

    loadACall.response.resolve(flowA)
    await loadA

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-a')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow A')
    assert.equal(useFlowStore.getState().error, deleteFailure.message)
    assert.deepEqual(useCanvasStore.getState().nodes, flowA.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a deleted-flow refresh failure resolves silently after deletion', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const reloadARoute = observedRoute()
  const deleteARoute = observedRoute()
  const listRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-a', reloadARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const reloadA = useFlowStore.getState().loadFlow('flow-a', {
      mode: 'refresh',
    })
    const reloadOutcome = reloadA.then(
      () => null,
      (error: unknown) => error,
    )
    const preflushCall = await waitForCall(updateARoute, 0)
    preflushCall.response.resolve({})
    const reloadCall = await waitForCall(reloadARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteA

    reloadCall.response.reject(new Error('late deleted-flow refresh failure'))
    const staleReloadError = await reloadOutcome

    assert.equal(staleReloadError, null)
    assert.equal(useFlowStore.getState().currentFlowId, null)
    assert.equal(useFlowStore.getState().error, null)
    assert.deepEqual(useCanvasStore.getState().nodes, [])
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('deleting A does not invalidate a newer pending load of B', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const loadBRoute = observedRoute()
  const deleteARoute = observedRoute()
  const listRoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  const flowB = createFlow('flow-b', 'Flow B')
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['GET /api/flows/flow-b', loadBRoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
        ['GET /api/flows', listRoute],
      ]),
    ),
  })

  try {
    const loadB = useFlowStore.getState().loadFlow('flow-b')
    await flushMicrotasks()
    if (updateARoute.calls[0]) {
      updateARoute.calls[0].response.resolve(
        createFlow('flow-a', 'Flow A flushed', nodesA),
      )
    }
    const loadBCall = await waitForCall(loadBRoute, 0)

    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    deleteCall.response.resolve({})
    const listCall = await waitForCall(listRoute, 0)
    listCall.response.resolve([])
    await deleteA
    assert.equal(useFlowStore.getState().currentFlowId, null)

    loadBCall.response.resolve(flowB)
    await loadB

    assert.equal(useFlowStore.getState().currentFlowId, 'flow-b')
    assert.equal(useFlowStore.getState().currentFlowName, 'Flow B')
    assert.equal(useFlowStore.getState().saving, false)
    assert.deepEqual(useCanvasStore.getState().nodes, flowB.nodes)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a failed delete does not invalidate the current flow save', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const deleteARoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
      ]),
    ),
  })

  try {
    const saveA = useFlowStore.getState().saveCurrent()
    const saveCall = await waitForCall(updateARoute, 0)
    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    const deleteFailure = new Error('delete Flow A failed')
    const deleteOutcome = deleteA.then(
      () => null,
      (error: unknown) => error,
    )
    deleteCall.response.reject(deleteFailure)
    assert.equal(await deleteOutcome, deleteFailure)

    saveCall.response.resolve(createFlow('flow-a', 'Flow A saved', nodesA))
    await saveA

    const flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-a')
    assert.equal(flowState.currentFlowName, 'Flow A saved')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, deleteFailure.message)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})

test('a queued save cannot clear an error published while it was waiting', async () => {
  const originalFetch = globalThis.fetch
  const updateARoute = observedRoute()
  const deleteARoute = observedRoute()
  const nodesA = [createImageNode('image-a', 'Flow A snapshot')]
  resetStores()
  setCurrentFlow('flow-a', 'Flow A', nodesA)
  Object.assign(globalThis, {
    fetch: installObservedFetch(
      new Map([
        ['PUT /api/flows/flow-a', updateARoute],
        ['DELETE /api/flows/flow-a', deleteARoute],
      ]),
    ),
  })

  try {
    const firstSave = useFlowStore.getState().saveCurrent()
    const firstSaveCall = await waitForCall(updateARoute, 0)
    const queuedSave = useFlowStore.getState().saveCurrent()

    const deleteA = useFlowStore.getState().deleteFlow('flow-a')
    const deleteCall = await waitForCall(deleteARoute, 0)
    const deleteFailure = new Error('queued delete failed')
    const deleteOutcome = deleteA.then(
      () => null,
      (error: unknown) => error,
    )
    deleteCall.response.reject(deleteFailure)
    assert.equal(await deleteOutcome, deleteFailure)

    firstSaveCall.response.resolve(createFlow('flow-a', 'Flow A first save', nodesA))
    await firstSave
    const queuedSaveCall = await waitForCall(updateARoute, 1)
    assert.equal(useFlowStore.getState().error, deleteFailure.message)

    queuedSaveCall.response.resolve(
      createFlow('flow-a', 'Flow A queued save', nodesA),
    )
    await queuedSave

    const flowState = useFlowStore.getState()
    assert.equal(flowState.currentFlowId, 'flow-a')
    assert.equal(flowState.currentFlowName, 'Flow A queued save')
    assert.equal(flowState.saving, false)
    assert.equal(flowState.error, deleteFailure.message)
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
    resetStores()
  }
})
