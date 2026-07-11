// 即梦 Flow 前端 - flowStore（Zustand）
// 管理当前工作流状态：id / name / 加载保存状态 / 历史列表。
// 通过 useCanvasStore.getState() / setState 读写画布的 nodes / edges，
// 实现"工作流元数据"与"画布数据"的解耦联动。
// 参考 PRD 10.2、11.1、8.5。

import { create } from 'zustand'
import type { FlowSummary } from '@jimeng-flow/shared/flow'
import * as flowsApi from '../api/flows'
import { useCanvasStore } from './canvasStore'

interface LoadFlowOptions {
  mode?: 'navigate' | 'refresh'
}

interface SameFlowReload {
  flowId: string
  intentId: number
  promise: Promise<void>
  barrier: Promise<void>
  releaseBarrier: () => void
  rejectBarrier: (error: unknown) => void
}

interface SaveCurrentOptions {
  preserveError?: boolean
  ignoredReload?: SameFlowReload
}

interface FlowState {
  /** 当前工作流 id（null 表示尚未加载/新建） */
  currentFlowId: string | null
  /** 当前工作流名称 */
  currentFlowName: string
  /** 列表加载中 */
  loading: boolean
  /** 保存中 */
  saving: boolean
  /** 最近一次保存成功的时间戳（ms） */
  lastSavedAt: number | null
  /** 历史工作流摘要列表 */
  flowList: FlowSummary[]
  /** 错误信息（最近一次） */
  error: string | null

  /** 拉取工作流列表 */
  loadFlowList: () => Promise<FlowSummary[]>
  /** 加载某个工作流到画布 */
  loadFlow: (id: string, options?: LoadFlowOptions) => Promise<void>
  /** 新建空白工作流并清空画布 */
  createFlow: () => Promise<void>
  /** 确保当前画布绑定到一个工作流，不清空已有节点 */
  ensureCurrentFlow: () => Promise<string>
  /** 保存当前画布到后端（PUT） */
  saveCurrent: () => Promise<void>
  /** 更新当前工作流名称（本地 + 后端） */
  updateFlowName: (name: string) => Promise<void>
  /** 重命名指定工作流 */
  renameFlow: (id: string, name: string) => Promise<void>
  /** 复制指定工作流 */
  duplicateFlow: (id: string) => Promise<void>
  /** 删除指定工作流 */
  deleteFlow: (id: string) => Promise<void>
  /** 清除错误 */
  clearError: () => void
}

const normalizeFlowName = (name: string): string =>
  name === '未命名工作流' ? '无限画布' : name

function migrateLegacyNodes(nodes: unknown[]): unknown[] {
  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return node
    const n = node as Record<string, unknown>
    if (n.type === 'generate') {
      const data = (n.data ?? {}) as Record<string, unknown>
      const outputAssetIds = (data.outputAssetIds as string[] | undefined) ?? []
      const firstAssetId = outputAssetIds[0]
      return {
        ...n,
        type: 'image',
        data: {
          ...data,
          assetId: firstAssetId ?? data.assetId,
        },
      }
    }
    return node
  })
}

class FlowIntentSupersededError extends Error {
  constructor() {
    super('Flow intent superseded')
    this.name = 'FlowIntentSupersededError'
  }
}

let latestNavigationRequestId = 0
interface ActiveNavigationRequest {
  id: number
  settled: Promise<void>
  settle: () => void
}

let activeNavigationRequest: ActiveNavigationRequest | null = null
let flowIntentId = 0
let activeSameFlowReload: SameFlowReload | null = null
const deferredSameFlowRefreshes = new Map<
  string,
  { flowEpoch: number; promise: Promise<void> }
>()
const flowMutationEpochs = new Map<string, number>()
let ensureCurrentFlowInFlight: {
  navigationRequestId: number
  intentId: number
  promise: Promise<string>
} | null = null
let saveQueueTail: Promise<void> = Promise.resolve()
let latestSaveCallId = 0

type CanvasSnapshotMarker = {
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes']
  edges: ReturnType<typeof useCanvasStore.getState>['edges']
  deletedNodeIds: Set<string>
}

type StabilizeFlowResult =
  | { status: 'stable'; marker: CanvasSnapshotMarker; changed: boolean }
  | { status: 'flow-changed' | 'cancelled' }

function beginNavigationRequest(id: number): ActiveNavigationRequest {
  activeNavigationRequest?.settle()
  let settle!: () => void
  const settled = new Promise<void>((resolve) => {
    settle = resolve
  })
  const navigation = { id, settled, settle }
  activeNavigationRequest = navigation
  return navigation
}

function finishNavigationRequest(
  navigation: ActiveNavigationRequest,
): void {
  if (activeNavigationRequest === navigation) {
    activeNavigationRequest = null
  }
  navigation.settle()
}

async function waitForNavigationChain(): Promise<void> {
  while (true) {
    const navigation = activeNavigationRequest
    if (!navigation) return
    await navigation.settled
  }
}

function getFlowMutationEpoch(flowId: string): number {
  return flowMutationEpochs.get(flowId) ?? 0
}

function incrementFlowMutationEpoch(flowId: string): void {
  flowMutationEpochs.set(flowId, getFlowMutationEpoch(flowId) + 1)
}

async function drainSaveQueue(): Promise<void> {
  while (true) {
    const observedTail = saveQueueTail
    try {
      await observedTail
    } catch (error) {
      if (observedTail === saveQueueTail) throw error
    }
    if (observedTail === saveQueueTail) return
  }
}

async function waitForSameFlowReload(
  flowId: string,
  ignoredReload?: SameFlowReload,
): Promise<void> {
  while (true) {
    const reload = activeSameFlowReload
    if (
      !reload ||
      reload === ignoredReload ||
      reload.flowId !== flowId
    ) {
      return
    }
    await reload.barrier
  }
}

export const useFlowStore = create<FlowState>((set, get) => {
  const saveCurrentInternal = (
    options?: SaveCurrentOptions,
  ): Promise<void> => {
    const { currentFlowId } = get()
    if (!currentFlowId) return Promise.resolve()
    const reload = activeSameFlowReload
    if (
      reload &&
      reload !== options?.ignoredReload &&
      reload.flowId === currentFlowId
    ) {
      set(
        options?.preserveError
          ? { saving: true }
          : { saving: true, error: null },
      )
      return reload.barrier.then(() => saveCurrentInternal(options))
    }

    const intentId = flowIntentId
    const saveCallId = ++latestSaveCallId
    set(
      options?.preserveError
        ? { saving: true }
        : { saving: true, error: null },
    )
    const runSave = async () => {
      try {
        if (
          intentId !== flowIntentId ||
          get().currentFlowId !== currentFlowId
        ) {
          return
        }
        if (saveCallId === latestSaveCallId) {
          set({ saving: true })
        }

        const { nodes, edges, deletedNodeIds } = useCanvasStore.getState()
        const updated = await flowsApi.updateFlow(currentFlowId, {
          nodes,
          edges,
          ...(deletedNodeIds.length > 0 ? { deletedNodeIds } : {}),
        })
        if (
          intentId !== flowIntentId ||
          get().currentFlowId !== currentFlowId
        ) {
          return
        }

        if (deletedNodeIds.length > 0) {
          const acknowledgedIds = new Set(deletedNodeIds)
          useCanvasStore.setState((state) => ({
            deletedNodeIds: state.deletedNodeIds.filter(
              (nodeId) => !acknowledgedIds.has(nodeId),
            ),
          }))
        }
        if (saveCallId === latestSaveCallId) {
          set({
            currentFlowName: normalizeFlowName(updated.name),
            lastSavedAt: Date.now(),
            saving: false,
          })
        }
      } catch (err) {
        if (
          intentId === flowIntentId &&
          get().currentFlowId === currentFlowId &&
          saveCallId === latestSaveCallId
        ) {
          set({
            saving: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        throw err
      }
    }
    const task = saveQueueTail.then(runSave, runSave)
    saveQueueTail = task
    return task
  }

  const startSameFlowRefresh = (
    flowId: string,
    flowEpoch: number,
    preserveError = false,
    knownStableMarker?: CanvasSnapshotMarker,
  ): Promise<void> => {
    if (
      get().currentFlowId !== flowId ||
      getFlowMutationEpoch(flowId) !== flowEpoch
    ) {
      return Promise.resolve()
    }

    const intentId = ++flowIntentId
    set(
      preserveError
        ? { loading: true, saving: false }
        : { loading: true, saving: false, error: null },
    )
    let releaseBarrier!: () => void
    let rejectBarrier!: (error: unknown) => void
    const barrier = new Promise<void>((resolve, reject) => {
      releaseBarrier = resolve
      rejectBarrier = reject
    })
    void barrier.catch(() => undefined)
    let reload!: SameFlowReload
    const promise: Promise<void> = Promise.resolve().then(async () => {
      const isSuperseded = (): boolean =>
        intentId !== flowIntentId ||
        get().currentFlowId !== flowId ||
        getFlowMutationEpoch(flowId) !== flowEpoch

      try {
        const prepared = await stabilizeCurrentFlow(
          flowId,
          isSuperseded,
          knownStableMarker,
          reload,
        )
        if (prepared.status !== 'stable' || isSuperseded()) {
          return
        }
        let stableMarker = prepared.marker

        while (true) {
          const flow = await flowsApi.getFlow(flowId)
          if (isSuperseded()) return

          const stabilized = await stabilizeCurrentFlow(
            flowId,
            isSuperseded,
            stableMarker,
            reload,
          )
          if (stabilized.status !== 'stable' || isSuperseded()) {
            return
          }
          if (stabilized.changed) {
            stableMarker = stabilized.marker
            continue
          }

          useCanvasStore.setState({
            nodes: migrateLegacyNodes(flow.nodes as unknown[]) as typeof flow.nodes,
            edges: flow.edges,
            deletedNodeIds: [],
            selectedNodeId: null,
          })
          set({
            currentFlowId: flow.id,
            currentFlowName: normalizeFlowName(flow.name),
            lastSavedAt: Date.now(),
            loading: false,
            saving: false,
          })
          return
        }
      } catch (err) {
        if (isSuperseded()) return
        set({
          loading: false,
          saving: false,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    })
    reload = {
      flowId,
      intentId,
      promise,
      barrier,
      releaseBarrier,
      rejectBarrier,
    }
    activeSameFlowReload?.releaseBarrier()
    activeSameFlowReload = reload
    void promise.then(
      () => {
        reload.releaseBarrier()
        if (activeSameFlowReload === reload) activeSameFlowReload = null
      },
      (error) => {
        reload.rejectBarrier(error)
        if (activeSameFlowReload === reload) activeSameFlowReload = null
      },
    )
    return promise
  }

  const captureCanvasSnapshotMarker = (): CanvasSnapshotMarker => {
    const { nodes, edges, deletedNodeIds } = useCanvasStore.getState()
    return {
      nodes,
      edges,
      deletedNodeIds: new Set(deletedNodeIds),
    }
  }

  const canvasChangedSince = (marker: CanvasSnapshotMarker): boolean => {
    const { nodes, edges, deletedNodeIds } = useCanvasStore.getState()
    return (
      nodes !== marker.nodes ||
      edges !== marker.edges ||
      deletedNodeIds.some((nodeId) => !marker.deletedNodeIds.has(nodeId))
    )
  }

  const stabilizeCurrentFlow = async (
    flowId: string,
    isCancelled: () => boolean,
    knownStableMarker?: CanvasSnapshotMarker,
    ignoredReload?: SameFlowReload,
  ): Promise<StabilizeFlowResult> => {
    let knownMarker = knownStableMarker
    let changedSinceKnown = false

    while (true) {
      if (get().currentFlowId !== flowId) {
        return { status: 'flow-changed' }
      }
      if (isCancelled()) return { status: 'cancelled' }

      await waitForSameFlowReload(flowId, ignoredReload)
      if (get().currentFlowId !== flowId) {
        return { status: 'flow-changed' }
      }
      if (isCancelled()) return { status: 'cancelled' }

      if (knownMarker) {
        await drainSaveQueue()
        if (get().currentFlowId !== flowId) {
          return { status: 'flow-changed' }
        }
        if (isCancelled()) return { status: 'cancelled' }
        if (!canvasChangedSince(knownMarker)) {
          return {
            status: 'stable',
            marker: captureCanvasSnapshotMarker(),
            changed: changedSinceKnown,
          }
        }
        changedSinceKnown = true
        knownMarker = undefined
      }

      const markerBeforeSave = captureCanvasSnapshotMarker()
      const save = saveCurrentInternal({
        preserveError: true,
        ignoredReload,
      })
      await save
      await drainSaveQueue()
      if (get().currentFlowId !== flowId) {
        return { status: 'flow-changed' }
      }
      if (isCancelled()) return { status: 'cancelled' }
      if (
        (
          !activeSameFlowReload ||
          activeSameFlowReload === ignoredReload ||
          activeSameFlowReload.flowId !== flowId
        ) &&
        !canvasChangedSince(markerBeforeSave)
      ) {
        return {
          status: 'stable',
          marker: captureCanvasSnapshotMarker(),
          changed: true,
        }
      }
    }
  }

  const deferSameFlowRefresh = (
    flowId: string,
    flowEpoch: number,
  ): Promise<void> => {
    const existing = deferredSameFlowRefreshes.get(flowId)
    if (existing?.flowEpoch === flowEpoch) return existing.promise

    const promise = (async () => {
      while (true) {
        await waitForNavigationChain()
        if (
          get().currentFlowId !== flowId ||
          getFlowMutationEpoch(flowId) !== flowEpoch
        ) {
          return
        }

        const stabilized = await stabilizeCurrentFlow(
          flowId,
          () =>
            activeNavigationRequest !== null ||
            getFlowMutationEpoch(flowId) !== flowEpoch,
        )
        if (
          get().currentFlowId !== flowId ||
          getFlowMutationEpoch(flowId) !== flowEpoch
        ) {
          return
        }
        if (stabilized.status !== 'stable') {
          if (stabilized.status === 'cancelled') continue
          return
        }
        return startSameFlowRefresh(
          flowId,
          flowEpoch,
          true,
          stabilized.marker,
        )
      }
    })()
    const deferred = { flowEpoch, promise }
    deferredSameFlowRefreshes.set(flowId, deferred)
    void promise.then(
      () => {
        if (deferredSameFlowRefreshes.get(flowId) === deferred) {
          deferredSameFlowRefreshes.delete(flowId)
        }
      },
      () => {
        if (deferredSameFlowRefreshes.get(flowId) === deferred) {
          deferredSameFlowRefreshes.delete(flowId)
        }
      },
    )
    return promise
  }

  const prepareNavigationSource = async (
    sourceFlowId: string | null,
    navigationRequestId: number,
  ): Promise<CanvasSnapshotMarker | null | false> => {
    if (!sourceFlowId) {
      return navigationRequestId === latestNavigationRequestId ? null : false
    }

    const stabilized = await stabilizeCurrentFlow(
      sourceFlowId,
      () => navigationRequestId !== latestNavigationRequestId,
    )
    if (
      stabilized.status === 'cancelled' ||
      navigationRequestId !== latestNavigationRequestId
    ) {
      return false
    }
    return stabilized.status === 'stable' ? stabilized.marker : null
  }

  return {
  currentFlowId: null,
  currentFlowName: '无限画布',
  loading: false,
  saving: false,
  lastSavedAt: null,
  flowList: [],
  error: null,

  loadFlowList: async () => {
    set({ loading: true, error: null })
    try {
      const list = await flowsApi.listFlows()
      const normalized = list.map((f) => ({ ...f, name: normalizeFlowName(f.name) }))
      set({ flowList: normalized, loading: false })
      return normalized
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  loadFlow: (id, options) => {
    const mode = options?.mode ?? 'navigate'
    const flowEpoch = getFlowMutationEpoch(id)
    if (mode === 'refresh') {
      if (get().currentFlowId !== id) {
        return Promise.resolve()
      }
      if (activeNavigationRequest) {
        return deferSameFlowRefresh(id, flowEpoch)
      }
      return startSameFlowRefresh(id, flowEpoch)
    }

    const navigationRequestId = ++latestNavigationRequestId
    const navigation = beginNavigationRequest(navigationRequestId)
    const sourceFlowId = get().currentFlowId
    set({ error: null })
    const promise = (async () => {
      try {
        let sourceMarker: CanvasSnapshotMarker | null | false
        try {
          sourceMarker = await prepareNavigationSource(
            sourceFlowId,
            navigationRequestId,
          )
        } catch (error) {
          if (navigationRequestId === latestNavigationRequestId) {
            set({ loading: false })
          }
          throw error
        }
        if (
          sourceMarker === false ||
          navigationRequestId !== latestNavigationRequestId ||
          getFlowMutationEpoch(id) !== flowEpoch
        ) {
          return
        }
        let stableSourceMarker: CanvasSnapshotMarker | null = sourceMarker

        const intentId = ++flowIntentId
        set({ loading: true, saving: false })
        try {
          while (true) {
            const flow = await flowsApi.getFlow(id)
            if (
              navigationRequestId !== latestNavigationRequestId ||
              intentId !== flowIntentId ||
              getFlowMutationEpoch(id) !== flowEpoch
            ) {
              return
            }

            const stabilized: StabilizeFlowResult = sourceFlowId
              ? await stabilizeCurrentFlow(
                  sourceFlowId,
                  () => navigationRequestId !== latestNavigationRequestId,
                  stableSourceMarker ?? undefined,
                )
              : ({ status: 'flow-changed' } as const)
            if (
              navigationRequestId !== latestNavigationRequestId ||
              intentId !== flowIntentId ||
              getFlowMutationEpoch(id) !== flowEpoch ||
              stabilized.status === 'cancelled'
            ) {
              return
            }
            if (
              sourceFlowId === id &&
              stabilized.status === 'stable' &&
              stabilized.changed
            ) {
              stableSourceMarker = stabilized.marker
              continue
            }

            useCanvasStore.setState({
              nodes: migrateLegacyNodes(flow.nodes as unknown[]) as typeof flow.nodes,
              edges: flow.edges,
              deletedNodeIds: [],
              selectedNodeId: null,
            })
            set({
              currentFlowId: flow.id,
              currentFlowName: normalizeFlowName(flow.name),
              lastSavedAt: Date.now(),
              loading: false,
              saving: false,
            })
            return
          }
        } catch (err) {
          if (
            navigationRequestId === latestNavigationRequestId &&
            intentId === flowIntentId &&
            getFlowMutationEpoch(id) === flowEpoch
          ) {
            set({
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          throw err
        }
      } finally {
        finishNavigationRequest(navigation)
      }
    })()
    return promise
  },

  createFlow: () => {
    const navigationRequestId = ++latestNavigationRequestId
    const navigation = beginNavigationRequest(navigationRequestId)
    const sourceFlowId = get().currentFlowId
    set({ error: null })
    const promise = (async () => {
      try {
        let sourceMarker: CanvasSnapshotMarker | null | false
        try {
          sourceMarker = await prepareNavigationSource(
            sourceFlowId,
            navigationRequestId,
          )
        } catch (error) {
          if (navigationRequestId === latestNavigationRequestId) {
            set({ loading: false })
          }
          throw error
        }
        if (
          sourceMarker === false ||
          navigationRequestId !== latestNavigationRequestId
        ) {
          return
        }

        const intentId = ++flowIntentId
        set({ loading: true, saving: false })
        try {
          const flow = await flowsApi.createFlow({})
          if (
            navigationRequestId !== latestNavigationRequestId ||
            intentId !== flowIntentId
          ) {
            return
          }
          if (sourceFlowId) {
            const stabilized = await stabilizeCurrentFlow(
              sourceFlowId,
              () => navigationRequestId !== latestNavigationRequestId,
              sourceMarker ?? undefined,
            )
            if (
              navigationRequestId !== latestNavigationRequestId ||
              intentId !== flowIntentId ||
              stabilized.status === 'cancelled'
            ) {
              return
            }
          }
          // 清空画布
          useCanvasStore.setState({
            nodes: [],
            edges: [],
            deletedNodeIds: [],
            selectedNodeId: null,
          })
          set({
            currentFlowId: flow.id,
            currentFlowName: normalizeFlowName(flow.name),
            lastSavedAt: Date.now(),
            loading: false,
            saving: false,
          })
        } catch (err) {
          if (
            navigationRequestId === latestNavigationRequestId &&
            intentId === flowIntentId
          ) {
            set({
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }
          throw err
        }
      } finally {
        finishNavigationRequest(navigation)
      }
    })()
    return promise
  },

  ensureCurrentFlow: () => {
    const existingFlowId = get().currentFlowId
    if (existingFlowId) return Promise.resolve(existingFlowId)
    if (
      ensureCurrentFlowInFlight &&
      ensureCurrentFlowInFlight.navigationRequestId ===
        latestNavigationRequestId &&
      ensureCurrentFlowInFlight.intentId === flowIntentId
    ) {
      return ensureCurrentFlowInFlight.promise
    }

    const navigationRequestId = ++latestNavigationRequestId
    const navigation = beginNavigationRequest(navigationRequestId)
    const intentId = ++flowIntentId
    set({ saving: true, error: null })
    const promise = (async () => {
      try {
        const { nodes, edges, deletedNodeIds } = useCanvasStore.getState()
        const flow = await flowsApi.createFlow({
          name: get().currentFlowName,
        })
        if (
          navigationRequestId !== latestNavigationRequestId ||
          intentId !== flowIntentId
        ) {
          throw new FlowIntentSupersededError()
        }
        const updated = await flowsApi.updateFlow(flow.id, {
          nodes,
          edges,
        })
        if (
          navigationRequestId !== latestNavigationRequestId ||
          intentId !== flowIntentId
        ) {
          throw new FlowIntentSupersededError()
        }
        if (deletedNodeIds.length > 0) {
          const acknowledgedIds = new Set(deletedNodeIds)
          useCanvasStore.setState((state) => ({
            deletedNodeIds: state.deletedNodeIds.filter(
              (nodeId) => !acknowledgedIds.has(nodeId),
            ),
          }))
        }
        set({
          currentFlowId: updated.id,
          currentFlowName: normalizeFlowName(updated.name),
          lastSavedAt: Date.now(),
          saving: false,
          loading: false,
        })
        return updated.id
      } catch (err) {
        if (
          navigationRequestId === latestNavigationRequestId &&
          intentId === flowIntentId
        ) {
          set({
            saving: false,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        throw err
      } finally {
        finishNavigationRequest(navigation)
      }
    })()
    ensureCurrentFlowInFlight = {
      navigationRequestId,
      intentId,
      promise,
    }
    void promise.then(
      () => {
        if (ensureCurrentFlowInFlight?.promise === promise) {
          ensureCurrentFlowInFlight = null
        }
      },
      () => {
        if (ensureCurrentFlowInFlight?.promise === promise) {
          ensureCurrentFlowInFlight = null
        }
      },
    )
    return promise
  },

  saveCurrent: () => saveCurrentInternal(),

  updateFlowName: async (name) => {
    const { currentFlowId, currentFlowName: oldName } = get()
    if (!currentFlowId) return
    set({ currentFlowName: name, error: null })
    try {
      const updated = await flowsApi.updateFlow(currentFlowId, { name })
      set({ currentFlowName: normalizeFlowName(updated.name), lastSavedAt: Date.now() })
      await get().loadFlowList()
    } catch (err) {
      set({
        currentFlowName: oldName,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  renameFlow: async (id, name) => {
    set({ error: null })
    try {
      await flowsApi.renameFlow(id, name)
      if (get().currentFlowId === id) {
        set({ currentFlowName: normalizeFlowName(name) })
      }
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  duplicateFlow: async (id) => {
    set({ error: null })
    try {
      await flowsApi.duplicateFlow(id)
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  deleteFlow: async (id) => {
    set({ error: null })
    try {
      await flowsApi.deleteFlow(id)
      incrementFlowMutationEpoch(id)
      if (activeSameFlowReload?.flowId === id) {
        activeSameFlowReload.releaseBarrier()
        activeSameFlowReload = null
      }
      if (get().currentFlowId === id) {
        set({
          currentFlowId: null,
          currentFlowName: '无限画布',
          saving: false,
        })
        useCanvasStore.setState({
          nodes: [],
          edges: [],
          deletedNodeIds: [],
          selectedNodeId: null,
        })
      }
      await get().loadFlowList()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  clearError: () => set({ error: null }),
  }
})

/** 便于非组件代码读取当前 flow id */
export function getCurrentFlowId(): string | null {
  return useFlowStore.getState().currentFlowId
}
