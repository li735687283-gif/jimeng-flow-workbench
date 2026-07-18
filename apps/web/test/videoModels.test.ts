import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getConfiguredDefaultVideoModel,
  getConfiguredVideoModels,
  getUnsupportedVideoModelMessage,
  videoModelNeedsJimeng,
} from '../src/utils/videoModels'
import type { ModelConfig } from '@jimeng-flow/shared/settings'

test('configured video models show exactly the selected video model ids', () => {
  const models = getConfiguredVideoModels(['seedance-2.0', 'veo3-fast', 'kling-video'])

  assert.deepEqual(
    models.map((model) => [model.id, model.label]),
    [
      ['seedance-2.0', 'Seedance 2.0'],
      ['veo3-fast', 'veo3-fast'],
      ['kling-video', 'kling-video'],
    ],
  )
})

test('an explicitly empty video selection stays empty', () => {
  assert.deepEqual(getConfiguredVideoModels([]), [])
  assert.equal(getConfiguredDefaultVideoModel([], 'seedance-2.0'), '')
})

test('configured default video model must be one of configured video models', () => {
  assert.equal(
    getConfiguredDefaultVideoModel(['veo3-fast', 'kling-video'], 'kling-video'),
    'kling-video',
  )
  assert.equal(
    getConfiguredDefaultVideoModel(['veo3-fast', 'kling-video'], 'missing'),
    'veo3-fast',
  )
})

test('third-party video models use the backend provider instead of dreamina gating', () => {
  assert.equal(getUnsupportedVideoModelMessage('seedance-2.0'), null)
  assert.equal(getUnsupportedVideoModelMessage('seedance2'), null)
  assert.equal(getUnsupportedVideoModelMessage('veo3-fast'), null)
  assert.equal(videoModelNeedsJimeng('seedance-2.0'), true)
  assert.equal(videoModelNeedsJimeng('veo3-fast'), false)
})

test('video model picker uses structured video configs only for legacy settings', () => {
  const modelConfigs: ModelConfig[] = [
    { id: 'gpt-4o-mini', provider: 'openai-compatible', capabilities: ['chat'] },
    { id: 'gpt-image-2', provider: 'codex', capabilities: ['image'] },
    {
      id: 'veo3-fast',
      label: 'Veo 3 Fast',
      provider: 'openai-compatible',
      capabilities: ['video'],
    },
  ]

  assert.deepEqual(
    getConfiguredVideoModels(undefined, modelConfigs).map((model) => [model.id, model.label]),
    [['veo3-fast', 'Veo 3 Fast']],
  )
})