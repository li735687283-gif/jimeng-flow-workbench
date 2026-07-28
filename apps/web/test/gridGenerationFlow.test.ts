import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Node } from '@xyflow/react'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'
import type { GenerationSseCallback } from '../src/api/generations'
import { useCanvasStore } from '../src/state/canvasStore'
import { useFlowStore } from '../src/state/flowStore'
import {
  hasExternalGenerationSubscription,
  trackExternalGenerationSubscription,
} from '../src/utils/generationSubscription'
import { startGridGeneration } from '../src/utils/gridGenerationFlow'

function makeResponse(partial: Partial<GenerationResponse>): GenerationResponse {
  return {
    id: 'gen-grid-1',
    nodeId: '',
    status: 'queued',
    createdAt: '2026-07-28T00:00:00.000Z',
    ...partial,
  }
}

/** 种一个源节点 + 宫格派生节点，返回派生节点 id */
function seedGridNode(): string {
  const sourceNode: Node = {
    id: 'image-source',
    type: 'image',
    position: { x: 100, y: 220 },
    measured: { width: 360, height: 240 },
    data: {
      title: '原图',
      status: 'success',
      assetId: 'asset-source',
      width: 1536,
      height: 864,
      ratio: '16:9',
    },
  }
  useCanvasStore.setState({ nodes: [sourceNode], edges: [], selectedNodeId: null })
  const nodeId = useCanvasStore
    .getState()
    .createGridImageNode('image-source', '3x3')
  assert.ok(nodeId)
  return nodeId
}

function stubFlowStore() {
  let saveCount = 0
  useFlowStore.setState({
    currentFlowId: 'flow-grid',
    ensureCurrentFlow: async () => 'flow-grid',
    saveCurrent: async () => {
      saveCount += 1
    },
  })
  return () => saveCount
}

async function waitFor(condition: () => boolean, label: string) {
  for (let i = 0; i < 100 && !condition(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  assert.ok(condition(), `等待超时：${label}`)
}

test('startGridGeneration 收尾为 success 并写回真实尺寸，迟到事件不再覆盖', async () => {
  const nodeId = seedGridNode()
  const getSaveCount = stubFlowStore()
  const requests: GenerationRequest[] = []
  let sseCallbacks: GenerationSseCallback | undefined

  const done = startGridGeneration(nodeId, {
    createGenerationImpl: async (req) => {
      requests.push(req)
      return makeResponse({ status: 'queued', nodeId: req.nodeId })
    },
    subscribeGenerationImpl: (_id, callbacks) => {
      sseCallbacks = callbacks
      return () => undefined
    },
    measureImageSizeImpl: async () => ({ width: 1024, height: 768 }),
  })

  await waitFor(() => sseCallbacks !== undefined, '订阅已建立')
  // 生成进行中：订阅已登记，ImageNode 恢复订阅不得重复跟踪
  assert.equal(hasExternalGenerationSubscription(nodeId), true)

  sseCallbacks!.onUpdate?.(makeResponse({ status: 'running' }))
  sseCallbacks!.onComplete?.(
    makeResponse({
      status: 'success',
      results: [{ assetId: 'asset-grid' }],
      finishedAt: '2026-07-28T00:01:00.000Z',
    }),
  )
  await done

  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
  assert.ok(node)
  assert.equal(node.data.status, 'success')
  assert.equal(node.data.assetId, 'asset-grid')
  assert.deepEqual(node.data.outputAssetIds, ['asset-grid'])
  // 尺寸校准：写回真实图尺寸，而不是源节点的 1536×864
  assert.equal(node.data.width, 1024)
  assert.equal(node.data.height, 768)
  assert.equal((node.data.generationRuns as unknown[]).length, 1)
  // 收尾后订阅登记已解除
  assert.equal(hasExternalGenerationSubscription(nodeId), false)
  assert.ok(getSaveCount() >= 1)

  // 请求形状：图生图 + 单张 + 源图作为输入
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].inputImages, ['asset-source'])
  assert.equal(requests[0].count, 1)
  assert.equal(requests[0].mediaType, 'image')
  assert.equal(requests[0].flowId, 'flow-grid')

  // 回归：同一订阅在终态后迟到的 running/重复 complete 不得把状态覆盖回去
  sseCallbacks!.onUpdate?.(makeResponse({ status: 'running' }))
  sseCallbacks!.onComplete?.(makeResponse({ status: 'running' }))
  const nodeAfter = useCanvasStore
    .getState()
    .nodes.find((item) => item.id === nodeId)
  assert.equal(nodeAfter?.data.status, 'success')
})

test('startGridGeneration 失败时写 error 并解除订阅登记', async () => {
  const nodeId = seedGridNode()
  stubFlowStore()
  let sseCallbacks: GenerationSseCallback | undefined

  const done = startGridGeneration(nodeId, {
    createGenerationImpl: async (req) =>
      makeResponse({ status: 'queued', nodeId: req.nodeId }),
    subscribeGenerationImpl: (_id, callbacks) => {
      sseCallbacks = callbacks
      return () => undefined
    },
  })

  await waitFor(() => sseCallbacks !== undefined, '订阅已建立')
  assert.equal(hasExternalGenerationSubscription(nodeId), true)

  sseCallbacks!.onComplete?.(
    makeResponse({ status: 'error', error: 'provider 超时' }),
  )
  await done

  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
  assert.equal(node?.data.status, 'error')
  assert.equal(node?.data.error, 'provider 超时')
  assert.equal(hasExternalGenerationSubscription(nodeId), false)
})

test('trackExternalGenerationSubscription 替换同节点旧订阅并可解除', () => {
  let cancelled = 0
  const first = trackExternalGenerationSubscription('node-x', () => {
    cancelled += 1
  })
  assert.equal(hasExternalGenerationSubscription('node-x'), true)

  // 同节点再次登记会取消上一个订阅
  const second = trackExternalGenerationSubscription('node-x', () => undefined)
  assert.equal(cancelled, 1)

  // 旧的解除句柄不再影响新登记
  first()
  assert.equal(hasExternalGenerationSubscription('node-x'), true)
  second()
  assert.equal(hasExternalGenerationSubscription('node-x'), false)
})

test('ImageNode 恢复订阅跳过外部已跟踪的生成任务', () => {
  const imageNode = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const gridFlow = readFileSync('apps/web/src/utils/gridGenerationFlow.ts', 'utf8')

  assert.match(imageNode, /hasExternalGenerationSubscription\(id\)\) return/)
  assert.match(gridFlow, /trackExternalGenerationSubscription\(nodeId, flow\.cancel\)/)
})
