import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Flow } from '@jimeng-flow/shared/flow'
import {
  applyImageGenerationResultToFlow,
} from '../src/services/generations'

test('applyImageGenerationResultToFlow writes generated asset back to the source image node', () => {
  const flow: Flow = {
    id: 'flow_test_123',
    name: 'test',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    edges: [],
    nodes: [
      {
        id: 'image-1',
        type: 'image',
        position: { x: 0, y: 0 },
        data: {
          title: '图片节点 1',
          status: 'running',
        },
      },
      {
        id: 'image-2',
        type: 'image',
        position: { x: 300, y: 0 },
        data: {
          title: '图片节点 2',
          assetId: 'asset_old',
          status: 'success',
        },
      },
    ],
  }

  const next = applyImageGenerationResultToFlow(flow, {
    nodeId: 'image-1',
    generationId: 'gen_1',
    prompt: 'city at night',
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    count: 1,
    assetIds: ['asset_new'],
    status: 'success',
    error: undefined,
    updatedAt: '2026-07-05T01:00:00.000Z',
  })

  assert.equal(next.nodes[0].data.assetId, 'asset_new')
  assert.deepEqual(next.nodes[0].data.outputAssetIds, ['asset_new'])
  assert.equal(next.nodes[0].data.generationId, 'gen_1')
  assert.equal(next.nodes[0].data.prompt, 'city at night')
  assert.equal(next.nodes[0].data.model, 'jimeng-5.0')
  assert.equal(next.nodes[0].data.width, 1536)
  assert.equal(next.nodes[0].data.height, 864)
  assert.equal(next.nodes[0].data.status, 'success')
  assert.equal(next.nodes[0].data.error, undefined)
  assert.deepEqual(next.nodes[0].data.generationRuns, [
    {
      id: 'gen_1',
      generationId: 'gen_1',
      status: 'success',
      assetIds: ['asset_new'],
      prompt: 'city at night',
      model: 'jimeng-5.0',
      width: 1536,
      height: 864,
      count: 1,
      seed: null,
      inputImageAssetIds: [],
      createdAt: '2026-07-05T01:00:00.000Z',
      finishedAt: '2026-07-05T01:00:00.000Z',
    },
  ])
  assert.equal(next.nodes[1].data.assetId, 'asset_old')
})

test('applyImageGenerationResultToFlow appends a new image generation run without dropping older runs', () => {
  const flow: Flow = {
    id: 'flow_test_123',
    name: 'test',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    edges: [],
    nodes: [
      {
        id: 'image-1',
        type: 'image',
        position: { x: 0, y: 0 },
        data: {
          title: '图片节点 1',
          status: 'success',
          assetId: 'asset_old',
          generationRuns: [
            {
              id: 'gen_old',
              generationId: 'gen_old',
              status: 'success',
              assetIds: ['asset_old'],
              prompt: 'old prompt',
              model: 'jimeng-5.0',
              width: 1024,
              height: 1024,
              count: 1,
              seed: null,
              inputImageAssetIds: [],
              createdAt: '2026-07-05T00:30:00.000Z',
              finishedAt: '2026-07-05T00:30:00.000Z',
            },
          ],
        },
      },
    ],
  }

  const next = applyImageGenerationResultToFlow(flow, {
    nodeId: 'image-1',
    generationId: 'gen_new',
    prompt: 'new prompt',
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    count: 2,
    assetIds: ['asset_new_1', 'asset_new_2'],
    status: 'success',
    error: undefined,
    updatedAt: '2026-07-05T01:00:00.000Z',
  })

  assert.deepEqual(
    (next.nodes[0].data.generationRuns as Array<{ generationId: string }>).map(
      (run) => run.generationId,
    ),
    ['gen_old', 'gen_new'],
  )
  assert.deepEqual(next.nodes[0].data.outputAssetIds, [
    'asset_new_1',
    'asset_new_2',
  ])
})

test('applyImageGenerationResultToFlow restores a missing image node when generation finished after refresh', () => {
  const flow: Flow = {
    id: 'flow_test_123',
    name: 'test',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    edges: [],
    nodes: [
      {
        id: 'image-existing',
        type: 'image',
        position: { x: 120, y: 40 },
        data: {
          title: '图片节点 1',
          assetId: 'asset_old',
          status: 'success',
        },
      },
    ],
  }

  const next = applyImageGenerationResultToFlow(flow, {
    nodeId: 'image-missing',
    generationId: 'gen_missing',
    prompt: 'lost node prompt',
    model: 'gpt-image-2-official',
    width: 1536,
    height: 864,
    count: 1,
    assetIds: ['asset_recovered'],
    status: 'success',
    updatedAt: '2026-07-05T01:00:00.000Z',
  })

  const restored = next.nodes.find((node) => node.id === 'image-missing')
  assert.ok(restored)
  assert.equal(restored.type, 'image')
  assert.equal(restored.data.assetId, 'asset_recovered')
  assert.deepEqual(restored.data.outputAssetIds, ['asset_recovered'])
  assert.equal(restored.data.generationId, 'gen_missing')
  assert.equal(restored.data.prompt, 'lost node prompt')
  assert.equal(restored.data.model, 'gpt-image-2-official')
  assert.equal(restored.data.status, 'success')
})
