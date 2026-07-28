import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import { createGenerationResumeCallbacks } from '../src/utils/generationResume'

const runningResponse: GenerationResponse = {
  id: 'gen_video_1',
  nodeId: 'video-1',
  status: 'running',
  createdAt: '2026-07-28T10:00:00.000Z',
}

const successResponse: GenerationResponse = {
  ...runningResponse,
  status: 'success',
  finishedAt: '2026-07-28T10:01:00.000Z',
}

test('resumed generation clears transient store state after the owner flow reloads', async () => {
  const events: string[] = []
  const callbacks = createGenerationResumeCallbacks(
    { nodeId: 'video-1', flowId: 'flow-a' },
    {
      getCurrentFlowId: () => 'flow-a',
      loadFlow: async (flowId) => { events.push(`load:${flowId}`) },
      updateNodeData: (_nodeId, patch) => { events.push(`node:${String(patch.status)}`) },
      patchGenerateState: (_nodeId, patch) => { events.push(`store:${String(patch.status)}`) },
      resetGenerateState: (nodeId) => { events.push(`reset:${nodeId}`) },
      saveCurrent: async () => { events.push('save') },
      now: () => '2026-07-28T10:00:30.000Z',
    },
  )

  callbacks.onUpdate(runningResponse)
  await callbacks.onComplete(successResponse)

  assert.deepEqual(events, [
    'node:running',
    'store:running',
    'load:flow-a',
    'reset:video-1',
  ])
})

test('resumed generation callbacks do not mutate a newly opened project', async () => {
  let currentFlowId = 'flow-a'
  const events: string[] = []
  const callbacks = createGenerationResumeCallbacks(
    { nodeId: 'video-1', flowId: 'flow-a' },
    {
      getCurrentFlowId: () => currentFlowId,
      loadFlow: async () => { events.push('load') },
      updateNodeData: () => { events.push('node') },
      patchGenerateState: () => { events.push('store') },
      resetGenerateState: () => { events.push('reset') },
      saveCurrent: async () => { events.push('save') },
      now: () => '2026-07-28T10:00:30.000Z',
    },
  )

  currentFlowId = 'flow-b'
  callbacks.onUpdate(runningResponse)
  await callbacks.onComplete(successResponse)
  callbacks.onError('SSE 连接错误')

  assert.deepEqual(events, [])
})

test('resumed generation reports a recoverable error when the owner flow cannot reload', async () => {
  const events: string[] = []
  const callbacks = createGenerationResumeCallbacks(
    { nodeId: 'video-1', flowId: 'flow-a' },
    {
      getCurrentFlowId: () => 'flow-a',
      loadFlow: async () => { throw new Error('load failed') },
      updateNodeData: (_nodeId, patch) => {
        events.push(`node:${String(patch.status)}:${String(patch.error)}`)
      },
      patchGenerateState: (_nodeId, patch) => {
        events.push(`store:${String(patch.status)}:${String(patch.error)}`)
      },
      resetGenerateState: () => { events.push('reset') },
      saveCurrent: async () => { events.push('save') },
      now: () => '2026-07-28T10:00:30.000Z',
    },
  )

  await callbacks.onComplete(successResponse)
  await Promise.resolve()

  assert.deepEqual(events, [
    'node:error:生成已完成，但刷新画布失败，请手动刷新页面',
    'store:error:生成已完成，但刷新画布失败，请手动刷新页面',
    'save',
  ])
})
