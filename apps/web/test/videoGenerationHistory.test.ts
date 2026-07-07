import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type {
  VideoGenerationRequest,
  VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import {
  buildVideoGenerationRunFromResponse,
  getEditorStateFromVideoGenerationHistoryItem,
  getEditorStateFromVideoGenerationRun,
  getVideoGenerationHistoryItems,
} from '../src/utils/videoGenerationHistory'
import * as videoGenerationHistory from '../src/utils/videoGenerationHistory'

test('buildVideoGenerationRunFromResponse stores video settings and generated assets', () => {
  const request: VideoGenerationRequest = {
    flowId: 'flow_video_123',
    nodeId: 'video-1',
    mediaType: 'video',
    mode: 'image_to_video',
    prompt: 'slow camera push',
    inputImages: ['asset_ref'],
    references: [
      { kind: 'image', role: 'first_frame', assetId: 'asset_ref' },
    ],
    model: 'seedance-2.0',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 2,
    generateAudio: true,
  }
  const response: GenerationResponse = {
    id: 'gen_video_1',
    nodeId: 'video-1',
    status: 'success',
    results: [{ assetId: 'asset_video_1' }, { assetId: 'asset_video_2' }, {}],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  const run = buildVideoGenerationRunFromResponse(response, request)

  assert.deepEqual(run.assetIds, ['asset_video_1', 'asset_video_2'])
  assert.equal(run.prompt, 'slow camera push')
  assert.equal(run.mode, 'image_to_video')
  assert.equal(run.model, 'seedance-2.0')
  assert.equal(run.aspectRatio, '16:9')
  assert.equal(run.resolution, '720P')
  assert.equal(run.durationSeconds, 5)
  assert.equal(run.count, 2)
  assert.deepEqual(run.inputImageAssetIds, ['asset_ref'])
  assert.deepEqual(run.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_ref' },
  ])
})

test('getEditorStateFromVideoGenerationRun restores editable video controls', () => {
  const run: VideoGenerationRun = {
    id: 'gen_video_1',
    generationId: 'gen_video_1',
    status: 'success',
    assetIds: ['asset_video_1', 'asset_video_2'],
    prompt: 'slow camera push',
    model: 'seedance-2.0',
    mode: 'image_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 2,
    generateAudio: true,
    inputImageAssetIds: ['asset_ref'],
    references: [
      { kind: 'image', role: 'first_frame', assetId: 'asset_ref' },
    ],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  assert.deepEqual(getEditorStateFromVideoGenerationRun(run), {
    prompt: 'slow camera push',
    model: 'seedance-2.0',
    mode: 'image_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 2,
    generateAudio: true,
    assetIds: ['asset_video_1', 'asset_video_2'],
    inputImageAssetIds: ['asset_ref'],
    references: [
      { kind: 'image', role: 'first_frame', assetId: 'asset_ref' },
    ],
  })
})

test('getVideoGenerationHistoryItems keeps only runs with generated video assets', () => {
  const baseRun: VideoGenerationRun = {
    id: 'gen_video_1',
    generationId: 'gen_video_1',
    status: 'success',
    assetIds: ['asset_video_1'],
    prompt: 'first',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  const items = getVideoGenerationHistoryItems([
    baseRun,
    {
      ...baseRun,
      id: 'gen_without_asset',
      generationId: 'gen_without_asset',
      assetIds: [],
      prompt: 'failed',
    },
    {
      ...baseRun,
      id: 'gen_video_2',
      generationId: 'gen_video_2',
      assetIds: ['asset_video_2'],
      prompt: 'second',
    },
  ])

  assert.deepEqual(
    items.map((item) => item.assetId),
    ['asset_video_1', 'asset_video_2'],
  )
})

test('getVideoGenerationHistoryItems expands every generated video as a selectable card', () => {
  const run: VideoGenerationRun = {
    id: 'gen_video_1',
    generationId: 'gen_video_1',
    status: 'success',
    assetIds: ['asset_video_1', 'asset_video_2', 'asset_video_3'],
    prompt: 'three draw results',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 4,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  const items = getVideoGenerationHistoryItems([run])

  assert.deepEqual(
    items.map((item) => [item.assetId, item.assetIndex]),
    [
      ['asset_video_1', 0],
      ['asset_video_2', 1],
      ['asset_video_3', 2],
    ],
  )
})

test('getEditorStateFromVideoGenerationHistoryItem restores the clicked video first', () => {
  const run: VideoGenerationRun = {
    id: 'gen_video_1',
    generationId: 'gen_video_1',
    status: 'success',
    assetIds: ['asset_video_1', 'asset_video_2', 'asset_video_3'],
    prompt: 'pick one result',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 4,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
  }
  const item = {
    run,
    assetId: 'asset_video_2',
    assetIndex: 1,
  }

  const state = getEditorStateFromVideoGenerationHistoryItem(item)

  assert.deepEqual(state.assetIds, [
    'asset_video_2',
    'asset_video_1',
    'asset_video_3',
  ])
})

test('getVideoGenerationHistoryPreviewScale keeps hover preview useful but modest', () => {
  const getScale = (
    videoGenerationHistory as typeof videoGenerationHistory & {
      getVideoGenerationHistoryPreviewScale?: () => number
    }
  ).getVideoGenerationHistoryPreviewScale

  assert.equal(typeof getScale, 'function')
  const scale = getScale()

  assert.equal(scale >= 2.8, true)
  assert.equal(scale <= 3, true)
})
