import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Flow } from '@jimeng-flow/shared/flow'
import {
  applyVideoGenerationResultToFlow,
} from '../src/services/generations'

test('applyVideoGenerationResultToFlow appends video runs and writes latest assets to the video node', () => {
  const flow: Flow = {
    id: 'flow_video_123',
    name: 'video test',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    edges: [],
    nodes: [
      {
        id: 'video-1',
        type: 'video',
        position: { x: 0, y: 0 },
        data: {
          title: '视频节点 1',
          status: 'success',
          assetIds: ['asset_video_old'],
          generationRuns: [
            {
              id: 'gen_video_old',
              generationId: 'gen_video_old',
              status: 'success',
              assetIds: ['asset_video_old'],
              prompt: 'old video',
              model: 'seedance-2.0',
              mode: 'text_to_video',
              aspectRatio: '16:9',
              resolution: '720P',
              quality: 'standard',
              durationSeconds: 5,
              count: 1,
              generateAudio: true,
              inputImageAssetIds: [],
              createdAt: '2026-07-05T00:30:00.000Z',
              finishedAt: '2026-07-05T00:30:00.000Z',
            },
          ],
        },
      },
    ],
  }

  const next = applyVideoGenerationResultToFlow(flow, {
    nodeId: 'video-1',
    generationId: 'gen_video_new',
    prompt: 'new video',
    model: 'seedance-2.0-vip',
    mode: 'image_to_video',
    aspectRatio: '9:16',
    resolution: '1080P',
    quality: 'high',
    durationSeconds: 10,
    count: 2,
    generateAudio: false,
    inputImageAssetIds: ['asset_image_ref'],
    references: [
      { kind: 'image', role: 'first_frame', assetId: 'asset_image_ref' },
    ],
    assetIds: ['asset_video_new_1', 'asset_video_new_2'],
    status: 'success',
    updatedAt: '2026-07-05T01:00:00.000Z',
  })

  assert.deepEqual(next.nodes[0].data.assetIds, [
    'asset_video_new_1',
    'asset_video_new_2',
  ])
  assert.equal(next.nodes[0].data.generationId, 'gen_video_new')
  assert.equal(next.nodes[0].data.prompt, 'new video')
  assert.equal(next.nodes[0].data.model, 'seedance-2.0-vip')
  assert.equal(next.nodes[0].data.mode, 'image_to_video')
  assert.deepEqual(next.nodes[0].data.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_image_ref' },
  ])
  assert.deepEqual(
    (next.nodes[0].data.generationRuns as Array<{ generationId: string }>).map(
      (run) => run.generationId,
    ),
    ['gen_video_old', 'gen_video_new'],
  )
})
