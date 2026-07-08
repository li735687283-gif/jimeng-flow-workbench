import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  startImageGenerationFlow,
  type ImageGenerationFlowCallbacks,
} from '../src/utils/imageGenerationFlow'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'

function makeRequest(): GenerationRequest {
  return {
    flowId: 'flow1',
    nodeId: 'node1',
    mediaType: 'image',
    prompt: 'test',
    model: 'gpt-image-2',
    width: 512,
    height: 512,
    count: 1,
    seed: null,
  } as GenerationRequest
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

test('同步返回终态时直接回调 onComplete，不订阅 SSE', async () => {
  const terminal: GenerationResponse = {
    id: 'gen1',
    nodeId: 'node1',
    status: 'success',
    results: [{ assetId: 'a1' }],
  }
  const events: string[] = []
  let subscribed = false
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
      onError: () => events.push('error'),
    },
    {
      createGenerationImpl: async () => terminal,
      subscribeGenerationImpl: () => {
        subscribed = true
        return () => {}
      },
    },
  )
  await tick()
  assert.deepEqual(events, ['complete'])
  assert.equal(subscribed, false)
})

test('异步 queued 时订阅 SSE，onComplete 触发回填并取消订阅', async () => {
  const queued: GenerationResponse = {
    id: 'gen2',
    nodeId: 'node1',
    status: 'queued',
    results: [],
  }
  const final: GenerationResponse = {
    id: 'gen2',
    nodeId: 'node1',
    status: 'success',
    results: [{ assetId: 'a2' }],
  }
  const events: string[] = []
  let sseCbs: any
  let unsubCalled = false
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
      onError: () => events.push('error'),
    },
    {
      createGenerationImpl: async () => queued,
      subscribeGenerationImpl: (_id, cbs) => {
        sseCbs = cbs
        return () => {
          unsubCalled = true
        }
      },
    },
  )
  await tick()
  assert.deepEqual(events, ['queued'])
  assert.ok(sseCbs)
  sseCbs.onComplete(final)
  await tick()
  assert.deepEqual(events, ['queued', 'complete'])
  assert.equal(unsubCalled, true)
})

test('异步生成中 SSE 仅透传非终态 update', async () => {
  const queued: GenerationResponse = {
    id: 'gen3',
    nodeId: 'node1',
    status: 'queued',
    results: [],
  }
  const running: GenerationResponse = {
    id: 'gen3',
    nodeId: 'node1',
    status: 'running',
    results: [],
  }
  const events: string[] = []
  let sseCbs: any
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
      onError: () => events.push('error'),
    },
    {
      createGenerationImpl: async () => queued,
      subscribeGenerationImpl: (_id, cbs) => {
        sseCbs = cbs
        return () => {}
      },
    },
  )
  await tick()
  sseCbs.onUpdate(running)
  await tick()
  assert.deepEqual(events, ['queued', 'update'])
})

test('createGeneration 抛错时 onError 透传', async () => {
  const events: string[] = []
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
      onError: (m) => events.push(`error:${m}`),
    },
    {
      createGenerationImpl: async () => {
        throw new Error('boom')
      },
      subscribeGenerationImpl: () => () => {},
    },
  )
  await tick()
  assert.deepEqual(events, ['error:boom'])
})

test('SSE 连接错误走 onError 并取消订阅', async () => {
  const queued: GenerationResponse = {
    id: 'gen5',
    nodeId: 'node1',
    status: 'queued',
    results: [],
  }
  const running: GenerationResponse = {
    id: 'gen5',
    nodeId: 'node1',
    status: 'running',
    results: [],
  }
  const events: string[] = []
  let sseCbs: any
  let unsubCalled = false
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
      onError: (m) => events.push(`error:${m}`),
    },
    {
      createGenerationImpl: async () => queued,
      subscribeGenerationImpl: (_id, cbs) => {
        sseCbs = cbs
        return () => {
          unsubCalled = true
        }
      },
      getGenerationImpl: async () => running,
      pollIntervalMs: 0,
      maxPollAttempts: 1,
    },
  )
  await tick()
  sseCbs.onError('sse broken')
  await tick()
  assert.deepEqual(events, ['queued', 'update', 'error:sse broken'])
  assert.equal(unsubCalled, true)
})

test('SSE 断开时轮询任务状态并在终态回填结果', async () => {
  const queued: GenerationResponse = {
    id: 'gen6',
    nodeId: 'node1',
    status: 'queued',
    results: [],
  }
  const running: GenerationResponse = {
    id: 'gen6',
    nodeId: 'node1',
    status: 'running',
    results: [],
  }
  const final: GenerationResponse = {
    id: 'gen6',
    nodeId: 'node1',
    status: 'success',
    results: [{ assetId: 'asset_done' }],
  }
  const events: string[] = []
  let sseCbs: any
  let pollCount = 0
  startImageGenerationFlow(
    makeRequest(),
    {
      onQueued: () => events.push('queued'),
      onComplete: (data) => events.push(`complete:${data.results?.[0]?.assetId}`),
      onError: (m) => events.push(`error:${m}`),
    },
    {
      createGenerationImpl: async () => queued,
      subscribeGenerationImpl: (_id, cbs) => {
        sseCbs = cbs
        return () => {}
      },
      getGenerationImpl: async () => {
        pollCount += 1
        return pollCount === 1 ? running : final
      },
      pollIntervalMs: 0,
      maxPollAttempts: 2,
    } as any,
  )
  await tick()
  sseCbs.onError('sse broken')
  await tick()
  await tick()
  assert.deepEqual(events, ['queued', 'complete:asset_done'])
})
