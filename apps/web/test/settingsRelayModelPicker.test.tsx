import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'

Object.assign(globalThis, { React })

function createModels(count: number): LlmModelInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 'model-' + (index + 1),
    label: '模型 ' + (index + 1),
  }))
}

test('third-party model picker renders the API total and three category tabs', async () => {
  const { RelayModelPickerPanel } = await import('../src/components/SettingsModal')
  const models = createModels(7)

  const html = renderToStaticMarkup(
    <RelayModelPickerPanel
      models={models}
      selectedModelIds={[]}
      onSelect={() => undefined}
    />,
  )

  assert.equal((html.match(/data-model-option-id=/g) ?? []).length, models.length)
  assert.match(html, /data-model-count="7"/)
  assert.match(html, /data-model-category="chat"/)
  assert.match(html, /data-model-category="image"/)
  assert.match(html, /data-model-category="video"/)
  assert.match(html, /data-model-category-count="7"/)
  assert.match(html, /未识别模型归入大语言模型/)
})

test('third-party models are split into chat, image, and video without hiding unknown ids', async () => {
  const { RelayModelPickerPanel, getRelayModelCategory } = await import(
    '../src/components/SettingsModal'
  )
  const models: LlmModelInfo[] = [
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-image-1', label: 'GPT Image' },
    { id: 'sora-2', label: 'Sora 2' },
    { id: 'unclassified-provider-model', label: 'Custom Model' },
  ]

  assert.equal(getRelayModelCategory(models[0]), 'chat')
  assert.equal(getRelayModelCategory(models[1]), 'image')
  assert.equal(getRelayModelCategory(models[2]), 'video')
  assert.equal(getRelayModelCategory(models[3]), 'chat')

  const html = renderToStaticMarkup(
    <RelayModelPickerPanel
      models={models}
      selectedModelIds={[]}
      onSelect={() => undefined}
    />,
  )

  assert.equal((html.match(/data-model-option-id=/g) ?? []).length, 2)
  assert.match(html, /data-model-category-count="2"/)
  assert.match(html, /data-model-category-count="1"/)
  assert.match(html, /data-model-count="4"/)
  assert.match(html, /gpt-5/)
  assert.match(html, /unclassified-provider-model/)
})

test('selected models stay visible in their category and cannot be added twice', async () => {
  const { RelayModelPickerPanel } = await import('../src/components/SettingsModal')
  const models = createModels(4)

  const html = renderToStaticMarkup(
    <RelayModelPickerPanel
      models={models}
      selectedModelIds={['model-2']}
      onSelect={() => undefined}
    />,
  )

  assert.equal((html.match(/data-model-option-id=/g) ?? []).length, models.length)
  assert.match(
    html,
    /disabled=""[^>]*data-model-option-id="model-2"|data-model-option-id="model-2"[^>]*disabled=""/,
  )
  assert.match(html, /已添加/)
})

test('adding models keeps order and ignores duplicate selections', async () => {
  const { appendUniqueModelId } = await import('../src/components/SettingsModal')

  const first = appendUniqueModelId([], 'model-a')
  const second = appendUniqueModelId(first, 'model-b')
  const duplicate = appendUniqueModelId(second, 'model-a')

  assert.deepEqual(first, ['model-a'])
  assert.deepEqual(second, ['model-a', 'model-b'])
  assert.deepEqual(duplicate, ['model-a', 'model-b'])
})

test('settings modal uses pull wording and one shared custom model menu system', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('拉取模型'), true)
  assert.equal(html.includes('刷新模型'), false)
  assert.equal(html.includes('添加一个模型'), true)
  assert.equal(html.includes('<datalist'), false)
  assert.equal(html.includes('settings-model-list-add'), true)
})
