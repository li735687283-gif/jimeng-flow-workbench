import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
  getImageModelMenuWidth,
  isLikelyImageModelId,
} from '../src/utils/imageModels'

test('configured image models keep third-party API model ids', () => {
  const models = getConfiguredImageModels(['jimeng', 'gpt-image-1'])

  assert.deepEqual(models.map((model) => model.id), ['jimeng', 'gpt-image-1'])
  assert.equal(models[0].label, '即梦（默认）')
  assert.equal(models[1].label, 'gpt-image-1')
})

test('default image model can be a configured third-party API model', () => {
  const modelId = getConfiguredDefaultImageModel(
    ['jimeng', 'gpt-image-1'],
    'gpt-image-1',
  )

  assert.equal(modelId, 'gpt-image-1')
})

test('configured image models include image-capable models from common llm models', () => {
  const models = getConfiguredImageModels(
    ['jimeng-5.0'],
    [
      'gpt-image-2-official',
      'claude-opus-4-8',
      'gemini-3-pro-image-preview',
      'banana-pro',
    ],
  )

  assert.deepEqual(
    models.map((model) => model.id),
    [
      'jimeng-5.0',
      'gpt-image-2-official',
      'gemini-3-pro-image-preview',
      'banana-pro',
    ],
  )
})

test('isLikelyImageModelId detects common image model ids without admitting text models', () => {
  assert.equal(isLikelyImageModelId('gpt-image-2-official'), true)
  assert.equal(isLikelyImageModelId('gemini-3-pro-image-preview'), true)
  assert.equal(isLikelyImageModelId('banana-pro'), true)
  assert.equal(isLikelyImageModelId('claude-opus-4-8'), false)
})

test('image model menu width follows the longest visible model name', () => {
  const shortMenuWidth = getImageModelMenuWidth([
    { id: 'jimeng-5.0', label: '即梦 5.0' },
  ])
  const longMenuWidth = getImageModelMenuWidth([
    { id: 'jimeng-5.0', label: '即梦 5.0' },
    { id: 'gemini-3-pro-image-preview', label: 'gemini-3-pro-image-preview' },
  ])

  assert.equal(shortMenuWidth, 220)
  assert.ok(longMenuWidth > shortMenuWidth)
  assert.ok(longMenuWidth < 460)
})
