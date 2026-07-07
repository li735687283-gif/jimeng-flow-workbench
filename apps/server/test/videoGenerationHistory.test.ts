import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendVideoGenerationRun,
  normalizeVideoGenerationRuns,
} from '@jimeng-flow/shared/videoNode'

test('appendVideoGenerationRun appends a new video run and de-duplicates by generation id', () => {
  const older = {
    id: 'gen_video_1',
    generationId: 'gen_video_1',
    status: 'success' as const,
    assetIds: ['asset_video_1'],
    prompt: 'old motion',
    model: 'seedance-2.0',
    mode: 'text_to_video' as const,
    aspectRatio: '16:9' as const,
    resolution: '720P' as const,
    quality: 'standard' as const,
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:00:00.000Z',
  }
  const newer = {
    ...older,
    id: 'gen_video_2',
    generationId: 'gen_video_2',
    assetIds: ['asset_video_2'],
    prompt: 'new motion',
    createdAt: '2026-07-05T11:00:00.000Z',
    finishedAt: '2026-07-05T11:00:00.000Z',
  }

  const appended = appendVideoGenerationRun([older], newer)
  const replaced = appendVideoGenerationRun(appended, {
    ...newer,
    assetIds: ['asset_video_2b'],
  })

  assert.deepEqual(
    replaced.map((run) => run.generationId),
    ['gen_video_1', 'gen_video_2'],
  )
  assert.deepEqual(replaced[1].assetIds, ['asset_video_2b'])
})

test('normalizeVideoGenerationRuns removes malformed video records', () => {
  const normalized = normalizeVideoGenerationRuns([
    {
      id: 'gen_video_1',
      generationId: 'gen_video_1',
      status: 'success',
      assetIds: ['asset_video_1'],
      prompt: 'prompt',
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
      finishedAt: '2026-07-05T10:00:00.000Z',
    },
    { generationId: 'bad' },
    null,
  ])

  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].generationId, 'gen_video_1')
})
