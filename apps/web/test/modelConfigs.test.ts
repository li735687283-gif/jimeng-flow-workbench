import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildModelConfigsFromSettings } from '@jimeng-flow/shared/settings'

test('buildModelConfigsFromSettings converts legacy model lists into capability configs', () => {
  const configs = buildModelConfigsFromSettings({
    llmModel: 'gpt-4o',
    llmModels: [
      'gpt-4o-mini',
      'codex:gpt-5.5',
      'kimi-k3',
      'k3',
      'deepseek-v4-flash',
      'gpt-image-2',
      'veo3-fast',
    ],
    defaultModel: 'gpt-image-2',
    imageModels: ['gpt-image-2', 'banana-pro'],
    defaultVideoModel: 'seedance-2.0',
    videoModels: ['seedance-2.0', 'veo3-fast'],
    modelConfigs: [
      {
        id: 'banana-pro',
        label: 'Banana Pro',
        provider: 'openai-compatible',
        capabilities: ['image'],
      },
    ],
  })

  assert.deepEqual(
    configs.map((model) => [
      model.id,
      model.provider,
      model.capabilities.join(','),
      model.label ?? '',
    ]),
    [
      ['banana-pro', 'openai-compatible', 'image', 'Banana Pro'],
      ['gpt-4o-mini', 'openai-compatible', 'chat', ''],
      ['codex:gpt-5.5', 'codex', 'chat,image', ''],
      ['kimi-k3', 'kimi', 'chat', ''],
      ['k3', 'kimi-coding', 'chat', ''],
      ['deepseek-v4-flash', 'deepseek', 'chat', ''],
      ['gpt-4o', 'openai-compatible', 'chat', ''],
      ['seedance-2.0', 'dreamina', 'video', ''],
      ['veo3-fast', 'openai-compatible', 'video', ''],
    ],
  )
})
