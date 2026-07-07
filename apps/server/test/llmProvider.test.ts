import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLlmGenerationProviderForSettings } from '../src/services/llm'

test('getLlmGenerationProviderForSettings routes codex chat models to Codex CLI', () => {
  const settings = {
    modelConfigs: [
      {
        id: 'gpt-5-codex',
        provider: 'codex',
        capabilities: ['chat'],
      },
      {
        id: 'gpt-image-2',
        provider: 'codex',
        capabilities: ['image'],
      },
    ],
  }

  assert.equal(
    getLlmGenerationProviderForSettings('gpt-5-codex', settings),
    'codex',
  )
  assert.equal(
    getLlmGenerationProviderForSettings('codex:gpt-5', { modelConfigs: [] }),
    'codex',
  )
  assert.equal(
    getLlmGenerationProviderForSettings('gpt-image-2', settings),
    'openai-compatible',
  )
})
