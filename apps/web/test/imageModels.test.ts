import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
  getImageModelMenuWidth,
  isLikelyImageModelId,
  isOpenAiCliImageModel,
  shouldRequireJimengCliForImageModel,
} from '../src/utils/imageModels'
import type { ModelConfig } from '@jimeng-flow/shared/settings'

test('configured image models show exactly the selected image model ids', () => {
  const models = getConfiguredImageModels(['jimeng-5.0-pro', 'jimeng', 'gpt-image-1'])

  assert.deepEqual(models.map((model) => model.id), ['jimeng-5.0-pro', 'jimeng', 'gpt-image-1'])
  assert.equal(models[0].label, '即梦 5.0 Pro')
  assert.equal(models[1].label, '即梦（默认）')
  assert.equal(models[2].label, 'gpt-image-1')
})

test('image model picker never infers models from the LLM list', () => {
  const models = getConfiguredImageModels(
    ['jimeng-5.0'],
    ['gpt-image-2-official', 'gpt-4o', 'gemini-3-pro-image-preview'],
  )

  assert.deepEqual(models.map((model) => model.id), ['jimeng-5.0'])
})

test('an explicitly empty image selection stays empty even when stale configs exist', () => {
  const modelConfigs: ModelConfig[] = [
    { id: 'gpt-image-2', provider: 'codex', capabilities: ['image'] },
  ]

  assert.deepEqual(getConfiguredImageModels([], [], modelConfigs), [])
})

test('image model picker uses structured image configs only for legacy settings', () => {
  const modelConfigs: ModelConfig[] = [
    {
      id: 'gpt-4o-mini',
      label: 'GPT 4o mini',
      provider: 'openai-compatible',
      capabilities: ['chat'],
    },
    {
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      provider: 'codex',
      capabilities: ['image'],
    },
    {
      id: 'veo3-fast',
      label: 'Veo 3 Fast',
      provider: 'openai-compatible',
      capabilities: ['video'],
    },
  ]

  assert.deepEqual(
    getConfiguredImageModels(undefined, undefined, modelConfigs).map((model) => [
      model.id,
      model.label,
    ]),
    [['codex:gpt-5.5', 'GPT Image（OpenAI CLI）']],
  )
})

test('image model picker has no built-in fallback before settings are available', () => {
  assert.deepEqual(getConfiguredImageModels(undefined, undefined, undefined), [])
  assert.equal(getConfiguredDefaultImageModel(undefined, 'jimeng'), '')
})

test('default image model must be one of the selected image models', () => {
  assert.equal(
    getConfiguredDefaultImageModel(['jimeng', 'gpt-image-1'], 'gpt-image-1'),
    'gpt-image-1',
  )
  assert.equal(
    getConfiguredDefaultImageModel(['jimeng', 'gpt-image-1'], 'missing'),
    'jimeng',
  )
  assert.equal(getConfiguredDefaultImageModel([], 'jimeng'), '')
})

test('configured image models migrate legacy imagegen to the Codex image model', () => {
  const models = getConfiguredImageModels(['$imagegen', 'gpt-image-2'])

  assert.deepEqual(models.map((model) => model.id), ['codex:gpt-5.5'])
  assert.equal(models[0].description, 'OpenAI CLI 图片模型')
})

test('isLikelyImageModelId detects common image model ids without admitting text models', () => {
  assert.equal(isLikelyImageModelId('$imagegen'), true)
  assert.equal(isLikelyImageModelId('gpt-image-2-official'), true)
  assert.equal(isLikelyImageModelId('gemini-3-pro-image-preview'), true)
  assert.equal(isLikelyImageModelId('banana-pro'), true)
  assert.equal(isLikelyImageModelId('gpt-4o'), false)
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

test('only jimeng image models require dreamina CLI configuration', () => {
  assert.equal(shouldRequireJimengCliForImageModel('jimeng-5.0'), true)
  assert.equal(shouldRequireJimengCliForImageModel('gpt-image-2-official'), false)
  assert.equal(shouldRequireJimengCliForImageModel('gemini-3-pro-image-preview'), false)
})

test('GPT Image models are single-image only', () => {
  assert.equal(isOpenAiCliImageModel('codex:gpt-5.5'), true)
  assert.equal(isOpenAiCliImageModel('$imagegen'), true)
  assert.equal(isOpenAiCliImageModel('gpt-image-2'), true)
  assert.equal(isOpenAiCliImageModel('banana-pro'), false)
  assert.equal(isOpenAiCliImageModel('jimeng-5.0'), false)
})