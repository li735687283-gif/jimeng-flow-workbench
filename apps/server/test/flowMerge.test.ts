import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FlowNode } from '@jimeng-flow/shared/flow'
import { mergeNodesForFlowUpdate } from '../src/services/flows'

test('mergeNodesForFlowUpdate keeps generated image asset when a stale autosave omits it', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        title: '图片节点 1',
        status: 'success',
        assetId: 'asset_generated',
        outputAssetIds: ['asset_generated'],
        generationId: 'gen_1',
        updatedAt: '2026-07-05T11:00:00.000Z',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        title: '图片节点 1',
        status: 'idle',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged[0].data.assetId, 'asset_generated')
  assert.deepEqual(merged[0].data.outputAssetIds, ['asset_generated'])
  assert.equal(merged[0].data.generationId, 'gen_1')
  assert.equal(merged[0].data.status, 'success')
})

test('mergeNodesForFlowUpdate keeps image generation history when a stale autosave omits it', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        title: '图片节点 1',
        status: 'success',
        assetId: 'asset_generated',
        generationRuns: [
          {
            id: 'gen_1',
            generationId: 'gen_1',
            status: 'success',
            assetIds: ['asset_generated'],
            prompt: 'city at night',
            model: 'jimeng-5.0',
            width: 1536,
            height: 864,
            count: 1,
            seed: null,
            inputImageAssetIds: [],
            createdAt: '2026-07-05T11:00:00.000Z',
            finishedAt: '2026-07-05T11:00:00.000Z',
          },
        ],
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        title: '图片节点 1',
        status: 'idle',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.deepEqual(
    (merged[0].data.generationRuns as Array<{ generationId: string }>).map(
      (run) => run.generationId,
    ),
    ['gen_1'],
  )
})

test('mergeNodesForFlowUpdate keeps video assets and history when a stale autosave omits them', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'video-1',
      type: 'video',
      position: { x: 0, y: 0 },
      data: {
        title: '视频节点 1',
        status: 'success',
        assetIds: ['asset_video_new'],
        generationId: 'gen_video_new',
        generationRuns: [
          {
            id: 'gen_video_new',
            generationId: 'gen_video_new',
            status: 'success',
            assetIds: ['asset_video_new'],
            prompt: 'storm city trailer',
            model: 'seedance-2.0',
            mode: 'image_to_video',
            aspectRatio: '16:9',
            resolution: '720P',
            quality: 'standard',
            durationSeconds: 5,
            count: 1,
            generateAudio: true,
            inputImageAssetIds: ['asset_image_ref'],
            createdAt: '2026-07-05T11:00:00.000Z',
            finishedAt: '2026-07-05T11:02:00.000Z',
          },
        ],
        updatedAt: '2026-07-05T11:02:00.000Z',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'video-1',
      type: 'video',
      position: { x: 30, y: 40 },
      data: {
        title: '视频节点 1',
        status: 'idle',
        generationId: 'gen_video_stale',
        updatedAt: '2026-07-05T11:00:30.000Z',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged[0].position.x, 30)
  assert.deepEqual(merged[0].data.assetIds, ['asset_video_new'])
  assert.equal(merged[0].data.generationId, 'gen_video_new')
  assert.equal(merged[0].data.status, 'success')
  assert.deepEqual(
    (merged[0].data.generationRuns as Array<{ generationId: string }>).map(
      (run) => run.generationId,
    ),
    ['gen_video_new'],
  )
})

test('mergeNodesForFlowUpdate allows a newer incoming image asset to replace the current one', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        status: 'success',
        assetId: 'asset_old',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        status: 'success',
        assetId: 'asset_new',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged[0].data.assetId, 'asset_new')
})

test('mergeNodesForFlowUpdate keeps newer generated asset when stale autosave still has an older asset', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        status: 'success',
        assetId: 'asset_new_generated',
        outputAssetIds: ['asset_new_generated'],
        generationId: 'gen_new',
        model: 'gpt-image-2-official',
        updatedAt: '2026-07-05T13:22:20.000Z',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'image-1',
      type: 'image',
      position: { x: 10, y: 20 },
      data: {
        title: '图片节点 1',
        status: 'success',
        assetId: 'asset_old_canvas',
        outputAssetIds: ['asset_old_canvas'],
        generationId: 'gen_old',
        model: 'jimeng-5.0',
        updatedAt: '2026-07-05T12:29:41.000Z',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged[0].position.x, 10)
  assert.equal(merged[0].data.assetId, 'asset_new_generated')
  assert.deepEqual(merged[0].data.outputAssetIds, ['asset_new_generated'])
  assert.equal(merged[0].data.generationId, 'gen_new')
  assert.equal(merged[0].data.model, 'gpt-image-2-official')
})

test('mergeNodesForFlowUpdate keeps current generated nodes missing from a stale autosave', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-generated',
      type: 'image',
      position: { x: 320, y: 80 },
      data: {
        title: '图片节点 2',
        status: 'success',
        assetId: 'asset_generated',
        outputAssetIds: ['asset_generated'],
        generationId: 'gen_generated',
        updatedAt: '2026-07-05T14:12:45.000Z',
      },
    },
    {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        title: '文本节点 1',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'text-1',
      type: 'text',
      position: { x: 20, y: 30 },
      data: {
        title: '文本节点 1',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, 'text-1')
  assert.deepEqual(merged[0].position, { x: 20, y: 30 })
  assert.equal(merged[1].id, 'image-generated')
  assert.equal(merged[1].data.assetId, 'asset_generated')
})

test('mergeNodesForFlowUpdate keeps current generated video nodes missing from a stale autosave', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'video-generated',
      type: 'video',
      position: { x: 360, y: 120 },
      data: {
        title: '视频节点 2',
        status: 'success',
        assetIds: ['asset_video_generated'],
        generationRuns: [
          {
            id: 'gen_video_generated',
            generationId: 'gen_video_generated',
            status: 'success',
            assetIds: ['asset_video_generated'],
            prompt: 'cinematic skyline',
            model: 'seedance-2.0',
            mode: 'text_to_video',
            aspectRatio: '16:9',
            resolution: '720P',
            quality: 'standard',
            durationSeconds: 5,
            count: 1,
            generateAudio: true,
            inputImageAssetIds: [],
            createdAt: '2026-07-05T14:12:45.000Z',
            finishedAt: '2026-07-05T14:13:45.000Z',
          },
        ],
        updatedAt: '2026-07-05T14:13:45.000Z',
      },
    },
    {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        title: '文本节点 1',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'text-1',
      type: 'text',
      position: { x: 20, y: 30 },
      data: {
        title: '文本节点 1',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(currentNodes, incomingNodes)

  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, 'text-1')
  assert.deepEqual(merged[0].position, { x: 20, y: 30 })
  assert.equal(merged[1].id, 'video-generated')
  assert.deepEqual(merged[1].data.assetIds, ['asset_video_generated'])
})

test('mergeNodesForFlowUpdate does not restore generated nodes that were explicitly deleted', () => {
  const currentNodes: FlowNode[] = [
    {
      id: 'image-generated',
      type: 'image',
      position: { x: 320, y: 80 },
      data: {
        title: '图片节点 2',
        status: 'success',
        assetId: 'asset_generated',
        outputAssetIds: ['asset_generated'],
        generationId: 'gen_generated',
        updatedAt: '2026-07-05T14:12:45.000Z',
      },
    },
    {
      id: 'text-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        title: '文本节点 1',
      },
    },
  ]
  const incomingNodes: FlowNode[] = [
    {
      id: 'text-1',
      type: 'text',
      position: { x: 20, y: 30 },
      data: {
        title: '文本节点 1',
      },
    },
  ]

  const merged = mergeNodesForFlowUpdate(
    currentNodes,
    incomingNodes,
    new Set(['image-generated']),
  )

  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'text-1')
})
