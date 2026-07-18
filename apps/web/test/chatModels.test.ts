import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ModelConfig } from '@jimeng-flow/shared/settings'
import { getConfiguredChatModels } from '../src/utils/chatModels'

test('configured chat models show exactly the selected chat model ids', () => {
  const modelConfigs: ModelConfig[] = [
    {
      id: 'gpt-4o-mini',
      label: 'GPT 4o mini',
      provider: 'openai-compatible',
      capabilities: ['chat'],
    },
    {
      id: 'codex:gpt-5.5',
      provider: 'codex',
      capabilities: ['chat', 'image'],
    },
    { id: 'gpt-image-2', provider: 'codex', capabilities: ['image'] },
    { id: 'veo3-fast', provider: 'openai-compatible', capabilities: ['video'] },
  ]

  assert.deepEqual(
    getConfiguredChatModels(
      ['legacy-chat', 'codex:gpt-5.5', 'gpt-image-2', 'veo3-fast', 'gpt-4o-mini'],
      'gpt-4o-mini',
      modelConfigs,
    ),
    ['legacy-chat', 'codex:gpt-5.5', 'gpt-4o-mini'],
  )
})

test('explicit Codex CLI chat selections remain available to the Agent picker', () => {
  assert.deepEqual(
    getConfiguredChatModels(
      ['codex:gpt-5.6-sol', 'codex:gpt-5.6-terra', 'codex:gpt-5.6-luna'],
      'codex:gpt-5.6-sol',
      [],
    ),
    ['codex:gpt-5.6-sol', 'codex:gpt-5.6-terra', 'codex:gpt-5.6-luna'],
  )
})

test('image and video-only models never enter the chat picker', () => {
  assert.deepEqual(
    getConfiguredChatModels(
      ['gemini-3-pro-image-preview', 'doubao-seedream-5-0-pro', 'veo3-fast', 'claude-fable-5'],
      '',
      [],
    ),
    ['claude-fable-5'],
  )
})

test('an explicitly empty chat selection stays empty', () => {
  assert.deepEqual(getConfiguredChatModels([], 'legacy-default', []), [])
})

test('structured chat configs remain a compatibility path when no explicit list exists', () => {
  const modelConfigs: ModelConfig[] = [
    { id: 'gpt-4o-mini', provider: 'openai-compatible', capabilities: ['chat'] },
    { id: 'gpt-image-2', provider: 'codex', capabilities: ['image'] },
  ]

  assert.deepEqual(getConfiguredChatModels(undefined, 'legacy-default', modelConfigs), [
    'gpt-4o-mini',
  ])
  assert.deepEqual(getConfiguredChatModels(undefined, 'legacy-default', []), [
    'legacy-default',
  ])
})