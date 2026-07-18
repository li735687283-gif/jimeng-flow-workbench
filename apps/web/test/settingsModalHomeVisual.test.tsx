import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import {
  createSettingsDraft,
  getSettingsModalGuards,
} from '../src/utils/settingsModalState'

Object.assign(globalThis, { React })

test('a new settings session restores the persisted draft after cancelled edits', () => {
  const persisted = {
    ...DEFAULT_SETTINGS,
    llmModel: 'persisted-model',
  }
  const cancelledDraft = createSettingsDraft(persisted)
  cancelledDraft.llmModel = 'cancelled-model'

  const reopenedDraft = createSettingsDraft(persisted)

  assert.notEqual(reopenedDraft, persisted)
  assert.equal(persisted.llmModel, 'persisted-model')
  assert.equal(reopenedDraft.llmModel, 'persisted-model')
})

test('settings modal guards freeze submitting mutations', () => {
  assert.deepEqual(getSettingsModalGuards(true), {
    closeBlocked: true,
    saveBlocked: true,
  })
  assert.deepEqual(getSettingsModalGuards(false), {
    closeBlocked: false,
    saveBlocked: false,
  })
})

test('settings modal does not expose MO.K home hero controls', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  assert.equal(html.includes('首页主图（MO.K）'), false)
  assert.equal(html.includes('settings-home-mok-hero'), false)
})
