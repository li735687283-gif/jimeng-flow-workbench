import { test } from 'node:test'
import assert from 'node:assert/strict'
import type {
  GenerationRequest,
  GenerationResponse,
  ImageGenerationRun,
} from '@jimeng-flow/shared/generateNode'
import {
  buildImageGenerationRunFromResponse,
  getEditorStateFromImageGenerationRun,
  getImageGenerationHistoryItems,
  getImageGenerationHistoryPreviewScale,
} from '../src/utils/imageGenerationHistory'

test('buildImageGenerationRunFromResponse stores prompt, settings, and generated assets', () => {
  const request: GenerationRequest = {
    flowId: 'flow_test_123',
    nodeId: 'image-1',
    mediaType: 'image',
    prompt: 'city at night',
    inputImages: ['asset_input'],
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    count: 2,
    seed: null,
  }
  const response: GenerationResponse = {
    id: 'gen_1',
    nodeId: 'image-1',
    status: 'success',
    results: [{ assetId: 'asset_1' }, { assetId: 'asset_2' }, {}],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  const run = buildImageGenerationRunFromResponse(response, request, {
    quality: '标准画质',
    ratio: '16:9',
    resolution: '2K',
  })

  assert.deepEqual(run.assetIds, ['asset_1', 'asset_2'])
  assert.equal(run.prompt, 'city at night')
  assert.equal(run.model, 'jimeng-5.0')
  assert.equal(run.width, 1536)
  assert.equal(run.height, 864)
  assert.equal(run.count, 2)
  assert.deepEqual(run.inputImageAssetIds, ['asset_input'])
  assert.equal(run.quality, '标准画质')
  assert.equal(run.ratio, '16:9')
  assert.equal(run.resolution, '2K')
})

test('getEditorStateFromImageGenerationRun restores the editable controls from history', () => {
  const run: ImageGenerationRun = {
    id: 'gen_1',
    generationId: 'gen_1',
    status: 'success',
    assetIds: ['asset_1', 'asset_2'],
    prompt: 'city at night',
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    count: 2,
    seed: null,
    inputImageAssetIds: ['asset_input'],
    quality: '标准画质',
    ratio: '16:9',
    resolution: '2K',
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  assert.deepEqual(getEditorStateFromImageGenerationRun(run), {
    prompt: 'city at night',
    modelId: 'jimeng-5.0',
    quality: '标准画质',
    ratio: '16:9',
    resolution: '2K',
    count: 2,
    width: 1536,
    height: 864,
    assetId: 'asset_1',
    outputAssetIds: ['asset_1', 'asset_2'],
    inputImageAssetIds: ['asset_input'],
  })
})

test('getImageGenerationHistoryItems keeps generated versions in append order and only shows image runs', () => {
  const baseRun: ImageGenerationRun = {
    id: 'gen_1',
    generationId: 'gen_1',
    status: 'success',
    assetIds: ['asset_1'],
    prompt: 'first',
    model: 'jimeng-5.0',
    width: 1536,
    height: 864,
    count: 1,
    seed: null,
    inputImageAssetIds: [],
    createdAt: '2026-07-05T10:00:00.000Z',
    finishedAt: '2026-07-05T10:01:00.000Z',
  }

  const items = getImageGenerationHistoryItems([
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
      id: 'gen_2',
      generationId: 'gen_2',
      assetIds: ['asset_2'],
      prompt: 'second',
    },
  ])

  assert.deepEqual(
    items.map((item) => item.assetId),
    ['asset_1', 'asset_2'],
  )
})

test('getImageGenerationHistoryPreviewScale keeps hover preview modest', () => {
  const scale = getImageGenerationHistoryPreviewScale()

  assert.equal(scale >= 2, true)
  assert.equal(scale <= 3, true)
})
