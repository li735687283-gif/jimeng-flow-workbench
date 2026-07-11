import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeVideoDefaults,
  type VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
  getVideoSubmitLabel,
  persistInitialVideoGenerationResponse,
  resolveVideoInputImages,
  resolveVideoModeForInputImages,
} from '../src/utils/videoGenerationState'

test('mergeVideoDefaults preserves generationId for persisted running jobs', () => {
  const persistedNode = {
    id: 'video-1',
    title: '恢复中的视频',
    status: 'running' as const,
    generationId: 'gen_video_running',
  }

  const restoredNode = mergeVideoDefaults(persistedNode)

  assert.equal(restoredNode.generationId, 'gen_video_running')
})

test('buildVideoRunningNodePatch keeps the current video visible while drawing again', () => {
  const existingRun: VideoGenerationRun = {
    id: 'gen_video_old',
    generationId: 'gen_video_old',
    status: 'success',
    assetIds: ['asset_video_old'],
    prompt: 'old prompt',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-06T10:00:00.000Z',
  }

  const patch = buildVideoRunningNodePatch(
    {
      flowId: 'local',
      nodeId: 'video-1',
      mediaType: 'video',
      mode: 'image_to_video',
      prompt: 'new draw',
      inputImages: ['asset_ref'],
      references: [{ kind: 'image', role: 'first_frame', assetId: 'asset_ref' }],
      model: 'seedance-2.0-fast',
      aspectRatio: '9:16',
      resolution: '720P',
      quality: 'standard',
      durationSeconds: 10,
      count: 2,
      generateAudio: false,
    },
    {
      assetIds: ['asset_video_old'],
      generationId: 'gen_video_old',
      generationRuns: [existingRun],
    },
    '2026-07-06T11:00:00.000Z',
  )

  assert.deepEqual(patch.assetIds, ['asset_video_old'])
  assert.deepEqual(patch.generationRuns, [existingRun])
  assert.equal(Object.hasOwn(patch, 'generationId'), true)
  assert.equal(patch.generationId, undefined)
  assert.equal(patch.status, 'running')
  assert.equal(patch.prompt, 'new draw')
  assert.equal(patch.model, 'seedance-2.0-fast')
  assert.equal(patch.mode, 'image_to_video')
  assert.deepEqual(patch.inputImageAssetIds, ['asset_ref'])
  assert.deepEqual(patch.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_ref' },
  ])
})

test('initial video generation response persists the new id after applying it', async () => {
  const events: string[] = []
  let appliedGenerationId: string | undefined
  const response = {
    id: 'gen_video_new',
    nodeId: 'video-1',
    status: 'queued' as const,
    createdAt: '2026-07-06T11:00:00.000Z',
  }

  await persistInitialVideoGenerationResponse(response, {
    applyResponse: (next) => {
      appliedGenerationId = next.id
      events.push(`apply:${next.id}`)
    },
    saveCurrent: async () => {
      events.push(`save:${appliedGenerationId}`)
    },
  })

  assert.deepEqual(events, ['apply:gen_video_new', 'save:gen_video_new'])
})

test('buildVideoCompletionNodePatch keeps current video when the redraw returns no assets', () => {
  const existingRun: VideoGenerationRun = {
    id: 'gen_video_old',
    generationId: 'gen_video_old',
    status: 'success',
    assetIds: ['asset_video_old'],
    prompt: 'old prompt',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-06T10:00:00.000Z',
  }
  const request = {
    flowId: 'local',
    nodeId: 'video-1',
    mediaType: 'video' as const,
    mode: 'image_to_video' as const,
    prompt: 'failed redraw',
    inputImages: ['asset_ref'],
    references: [{ kind: 'image' as const, role: 'first_frame' as const, assetId: 'asset_ref' }],
    model: 'seedance-2.0-fast',
    aspectRatio: '16:9' as const,
    resolution: '720P' as const,
    quality: 'standard' as const,
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
  }

  const patch = buildVideoCompletionNodePatch(
    {
      id: 'gen_video_failed',
      nodeId: 'video-1',
      status: 'error',
      error: 'provider timeout',
      results: [],
      createdAt: '2026-07-06T11:00:00.000Z',
      finishedAt: '2026-07-06T11:01:00.000Z',
    },
    request,
    {
      assetIds: ['asset_video_old'],
      generationRuns: [existingRun],
    },
    '2026-07-06T11:01:05.000Z',
  )

  assert.deepEqual(patch.assetIds, ['asset_video_old'])
  assert.equal(patch.status, 'error')
  assert.equal(patch.error, 'provider timeout')
  assert.deepEqual(
    patch.generationRuns?.map((run) => run.generationId),
    ['gen_video_old', 'gen_video_failed'],
  )
  assert.deepEqual(patch.generationRuns?.[1]?.assetIds, [])
})

test('buildVideoCompletionNodePatch does not add history for non-terminal responses', () => {
  const existingRun: VideoGenerationRun = {
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
    createdAt: '2026-07-05T10:00:00.000Z',
  }
  const request = {
    flowId: 'local',
    nodeId: 'video-1',
    mediaType: 'video' as const,
    mode: 'text_to_video' as const,
    prompt: 'another draw',
    inputImages: [],
    model: 'seedance-2.0',
    aspectRatio: '16:9' as const,
    resolution: '720P' as const,
    quality: 'standard' as const,
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
  }

  const patch = buildVideoCompletionNodePatch(
    {
      id: 'gen_video_queued',
      nodeId: 'video-1',
      status: 'queued',
      createdAt: '2026-07-05T11:00:00.000Z',
    },
    request,
    {
      assetIds: ['asset_video_old'],
      generationRuns: [existingRun],
    },
  )

  assert.deepEqual(patch.assetIds, ['asset_video_old'])
  assert.deepEqual(patch.generationRuns, [existingRun])
})

test('getVideoSubmitLabel names repeat video generation as another draw', () => {
  assert.equal(getVideoSubmitLabel(false, false), '生成')
  assert.equal(getVideoSubmitLabel(false, true), '再抽一次')
  assert.equal(getVideoSubmitLabel(true, true), '生成中')
})

test('resolveVideoInputImages merges stored refs with connected upstream refs', () => {
  assert.deepEqual(
    resolveVideoInputImages(['asset_first'], ['asset_first', 'asset_last']),
    ['asset_first', 'asset_last'],
  )
  assert.deepEqual(
    resolveVideoInputImages([], ['asset_connected']),
    ['asset_connected'],
  )
})

test('resolveVideoInputImages can treat connected refs as source of truth', () => {
  assert.deepEqual(
    resolveVideoInputImages(['asset_stale_saved'], ['asset_connected'], {
      preferUpstream: true,
    }),
    ['asset_connected'],
  )
  assert.deepEqual(
    resolveVideoInputImages(['asset_saved'], [], { preferUpstream: true }),
    ['asset_saved'],
  )
})

test('resolveVideoModeForInputImages promotes connected multi-image refs to first-last frame', () => {
  assert.equal(
    resolveVideoModeForInputImages('text_to_video', ['asset_first']),
    'image_to_video',
  )
  assert.equal(
    resolveVideoModeForInputImages('text_to_video', [
      'asset_first',
      'asset_last',
    ]),
    'first_last_frame',
  )
  assert.equal(
    resolveVideoModeForInputImages('all_reference', [
      'asset_a',
      'asset_b',
    ]),
    'all_reference',
  )
})
