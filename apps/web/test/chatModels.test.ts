import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ModelConfig } from '@jimeng-flow/shared/settings'
import { getConfiguredChatModels } from '../src/utils/chatModels'

test('configured chat models use only chat-capable structured model configs', () => {
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
    getConfiguredChatModels(['legacy-chat', 'gpt-image-2'], 'gpt-4o-mini', modelConfigs),
    ['gpt-4o-mini'],
  )
})

test('configured chat models keep legacy llm models when no structured chat models exist', () => {
  assert.deepEqual(
    getConfiguredChatModels(['legacy-chat'], 'legacy-default', []),
    ['legacy-chat', 'legacy-default'],
  )
})
