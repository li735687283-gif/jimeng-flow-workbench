import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import {
  getLlmGenerationProviderForSettings,
  getLlmProviderConnection,
} from '../src/services/llm'

test('getLlmGenerationProviderForSettings routes configured chat models by provider', () => {
  const settings = {
    modelConfigs: [
      {
        id: 'gpt-5-codex',
        provider: 'codex',
        capabilities: ['chat'],
      },
      {
        id: 'kimi-k3',
        provider: 'kimi',
        capabilities: ['chat'],
      },
      {
        id: 'k3',
        provider: 'kimi-coding',
        capabilities: ['chat'],
      },
      {
        id: 'deepseek-v4-flash',
        provider: 'deepseek',
        capabilities: ['chat'],
      },
      {
        id: 'gpt-image-2',
        provider: 'codex',
        capabilities: ['image'],
      },
    ],
  }

  assert.equal(getLlmGenerationProviderForSettings('gpt-5-codex', settings), 'codex')
  assert.equal(getLlmGenerationProviderForSettings('kimi-k3', settings), 'kimi')
  assert.equal(getLlmGenerationProviderForSettings('k3', settings), 'kimi-coding')
  assert.equal(
    getLlmGenerationProviderForSettings('deepseek-v4-flash', settings),
    'deepseek',
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

test('provider connections keep Kimi API, Kimi Coding Plan, and DeepSeek credentials separate', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    llmBaseUrl: 'https://relay.example/v1',
    llmApiKey: 'relay-key',
    kimiBaseUrl: 'https://api.moonshot.cn/v1',
    kimiApiKey: 'kimi-key',
    kimiCodingBaseUrl: 'https://api.kimi.com/coding/v1',
    kimiCodingApiKey: 'coding-key',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekApiKey: 'deepseek-key',
  }

  assert.deepEqual(getLlmProviderConnection('kimi', settings), {
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: 'kimi-key',
    displayName: 'Kimi API',
  })
  assert.deepEqual(getLlmProviderConnection('kimi-coding', settings), {
    baseUrl: 'https://api.kimi.com/coding/v1',
    apiKey: 'coding-key',
    displayName: 'Kimi Coding Plan',
  })
  assert.deepEqual(getLlmProviderConnection('deepseek', settings), {
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'deepseek-key',
    displayName: 'DeepSeek API',
  })
  assert.deepEqual(
    getLlmProviderConnection('openai-compatible', settings, {
      baseUrl: 'https://override.example/v1',
      apiKey: 'override-key',
    }),
    {
      baseUrl: 'https://override.example/v1',
      apiKey: 'override-key',
      displayName: 'LLM Provider',
    },
  )
})
