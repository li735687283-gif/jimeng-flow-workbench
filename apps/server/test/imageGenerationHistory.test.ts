import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appendImageGenerationRun,
  normalizeImageGenerationRuns,
} from '@jimeng-flow/shared/generateNode'

test('appendImageGenerationRun appends a new run and de-duplicates by generation id', () => {
  const older = {
    id: 'gen_1',
    generationId: 'gen_1',
    status: 'success' as const,
    assetIds: ['asset_1'],
    prompt: 'old prompt',
    model: 'jimeng-5.0',
    width: 1024,
    height: 1024,
    count: 1,
    seed: null,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:00:00.000Z',
  }
  const newer = {
    ...older,
    id: 'gen_2',
    generationId: 'gen_2',
    assetIds: ['asset_2'],
    prompt: 'new prompt',
    createdAt: '2026-07-05T11:00:00.000Z',
    finishedAt: '2026-07-05T11:00:00.000Z',
  }

  const appended = appendImageGenerationRun([older], newer)
  const replaced = appendImageGenerationRun(appended, {
    ...newer,
    assetIds: ['asset_2b'],
  })

  assert.deepEqual(
    replaced.map((run) => run.generationId),
    ['gen_1', 'gen_2'],
  )
  assert.deepEqual(replaced[1].assetIds, ['asset_2b'])
})

test('normalizeImageGenerationRuns removes malformed records', () => {
  const normalized = normalizeImageGenerationRuns([
    {
      id: 'gen_1',
      generationId: 'gen_1',
      status: 'success',
      assetIds: ['asset_1'],
      prompt: 'prompt',
      model: 'jimeng-5.0',
      width: 1024,
      height: 1024,
      count: 1,
      seed: null,
      inputImageAssetIds: [],
      createdAt: '2026-07-05T10:00:00.000Z',
      finishedAt: '2026-07-05T10:00:00.000Z',
    },
    { generationId: 'bad' },
    null,
  ])

  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].generationId, 'gen_1')
})
