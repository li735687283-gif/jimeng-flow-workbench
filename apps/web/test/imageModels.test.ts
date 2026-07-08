import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
  getImageModelMenuWidth,
  isLikelyImageModelId,
  shouldRequireJimengCliForImageModel,
} from '../src/utils/imageModels'
import type { ModelConfig } from '@jimeng-flow/shared/settings'

test('configured image models keep third-party API model ids', () => {
  const models = getConfiguredImageModels(['jimeng', 'gpt-image-1'])

  assert.deepEqual(models.map((model) => model.id), [
    'jimeng',
    'gpt-image-1',
    'codex:gpt-5.5',
  ])
  assert.equal(models[0].label, '即梦（默认）')
  assert.equal(models[1].label, 'gpt-image-1')
})

test('configured image models keep the OpenAI CLI option beside selected jimeng models', () => {
  const models = getConfiguredImageModels(['jimeng-5.0'])

  assert.deepEqual(models.map((model) => model.id), [
    'jimeng-5.0',
    'codex:gpt-5.5',
  ])
  assert.equal(models[1].label, 'GPT Image（OpenAI CLI）')
  assert.equal(models[1].description, 'OpenAI CLI 图片模型')
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
      'codex:gpt-5.5',
      'gpt-image-2-official',
      'gemini-3-pro-image-preview',
      'banana-pro',
    ],
  )
})

test('structured image model configs do not hide image-capable common models', () => {
  const models = getConfiguredImageModels(
    ['jimeng-5.0'],
    [
      'gpt-image-2-official',
      'claude-opus-4-8',
      'gemini-3-pro-image-preview',
    ],
    [
      {
        id: 'jimeng-5.0',
        provider: 'dreamina',
        capabilities: ['image'],
      },
    ],
  )

  assert.deepEqual(
    models.map((model) => model.id),
    [
      'jimeng-5.0',
      'codex:gpt-5.5',
      'gpt-image-2-official',
      'gemini-3-pro-image-preview',
    ],
  )
})

test('image model fallback keeps OpenAI CLI visible while settings load', () => {
  const models = getConfiguredImageModels(undefined, undefined, undefined)

  assert.deepEqual(models.map((model) => model.id), [
    'jimeng',
    'codex:gpt-5.5',
  ])
})

test('configured image models keep OpenAI CLI image generation available', () => {
  const models = getConfiguredImageModels(
    ['jimeng-5.0'],
    [
      'gpt-image-2-official',
      'claude-opus-4-8',
      'gemini-3-pro-image-preview',
    ],
  )

  assert.deepEqual(
    models.map((model) => model.id),
    [
      'jimeng-5.0',
      'codex:gpt-5.5',
      'gpt-image-2-official',
      'gemini-3-pro-image-preview',
    ],
  )
  assert.equal(
    models.find((model) => model.id === 'codex:gpt-5.5')?.description,
    'OpenAI CLI 图片模型',
  )
})

test('isLikelyImageModelId detects common image model ids without admitting text models', () => {
  assert.equal(isLikelyImageModelId('$imagegen'), true)
  assert.equal(isLikelyImageModelId('gpt-image-2-official'), true)
  assert.equal(isLikelyImageModelId('gemini-3-pro-image-preview'), true)
  assert.equal(isLikelyImageModelId('banana-pro'), true)
  assert.equal(isLikelyImageModelId('claude-opus-4-8'), false)
})

test('configured image models migrate legacy imagegen to the Codex image model', () => {
  const models = getConfiguredImageModels(['$imagegen', 'gpt-image-2'])

  assert.deepEqual(models.map((model) => model.id), ['codex:gpt-5.5'])
  assert.equal(models[0].description, 'OpenAI CLI 图片模型')
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
  assert.equal(
    shouldRequireJimengCliForImageModel('gpt-image-2-official'),
    false,
  )
  assert.equal(
    shouldRequireJimengCliForImageModel('gemini-3-pro-image-preview'),
    false,
  )
})

test('configured image models use only image-capable structured model configs', () => {
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

  const models = getConfiguredImageModels([], [], modelConfigs)

  assert.deepEqual(models.map((model) => [model.id, model.label]), [
    ['codex:gpt-5.5', 'GPT Image（OpenAI CLI）'],
  ])
})
