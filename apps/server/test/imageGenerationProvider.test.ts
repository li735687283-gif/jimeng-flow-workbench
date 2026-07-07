import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getImageGenerationProvider,
  getImageGenerationProviderForSettings,
  getVideoGenerationProvider,
  getVideoGenerationProviderForSettings,
} from '../src/services/generations'

test('getImageGenerationProvider routes image models without hijacking third-party models', () => {
  assert.equal(getImageGenerationProvider('jimeng'), 'dreamina')
  assert.equal(getImageGenerationProvider('$imagegen'), 'codex')
  assert.equal(getImageGenerationProvider('gpt-image-2'), 'codex')
  assert.equal(getImageGenerationProvider('codex:gpt-image-2'), 'codex')

  assert.equal(getImageGenerationProvider('gpt-image-2-official'), 'openai-compatible')
  assert.equal(getImageGenerationProvider('gemini-3-pro-image-preview'), 'openai-compatible')
})

test('getVideoGenerationProvider does not send third-party video models to dreamina', () => {
  assert.equal(getVideoGenerationProvider('seedance-2.0'), 'dreamina')
  assert.equal(getVideoGenerationProvider('seedance-2.0-fast-vip'), 'dreamina')
  assert.equal(getVideoGenerationProvider('seedance2'), 'dreamina')

  assert.equal(getVideoGenerationProvider('veo3-fast'), 'openai-compatible')
  assert.equal(getVideoGenerationProvider('kling-video'), 'openai-compatible')
  assert.equal(getVideoGenerationProvider('runway-gen4'), 'openai-compatible')
})

test('settings modelConfigs can override image and video provider routing', () => {
  const settings = {
    modelConfigs: [
      {
        id: 'custom-codex-image',
        provider: 'codex',
        capabilities: ['image'],
      },
      {
        id: 'custom-dreamina-image',
        provider: 'dreamina',
        capabilities: ['image'],
      },
      {
        id: 'seedance-custom',
        provider: 'dreamina',
        capabilities: ['video'],
      },
      {
        id: 'veo3-fast',
        provider: 'openai-compatible',
        capabilities: ['video'],
      },
    ],
  }

  assert.equal(
    getImageGenerationProviderForSettings('custom-codex-image', settings),
    'codex',
  )
  assert.equal(
    getImageGenerationProviderForSettings('custom-dreamina-image', settings),
    'dreamina',
  )
  assert.equal(
    getImageGenerationProviderForSettings('custom-dreamina-image', {
      modelConfigs: [
        {
          id: 'custom-dreamina-image',
          provider: 'dreamina',
          capabilities: ['chat'],
        },
      ],
    }),
    'openai-compatible',
  )

  assert.equal(
    getVideoGenerationProviderForSettings('seedance-custom', settings),
    'dreamina',
  )
  assert.equal(
    getVideoGenerationProviderForSettings('veo3-fast', settings),
    'openai-compatible',
  )
})
