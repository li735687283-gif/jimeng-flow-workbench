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
    homeMokHeroImagePath: '/api/assets/asset_persisted/file',
  }
  const cancelledDraft = createSettingsDraft(persisted)
  cancelledDraft.homeMokHeroImagePath = '/api/assets/asset_cancelled/file'

  const reopenedDraft = createSettingsDraft(persisted)

  assert.notEqual(reopenedDraft, persisted)
  assert.equal(persisted.homeMokHeroImagePath, '/api/assets/asset_persisted/file')
  assert.equal(reopenedDraft.homeMokHeroImagePath, '/api/assets/asset_persisted/file')
})

test('settings modal guards freeze submitting mutations and keep upload cancellation available', () => {
  assert.deepEqual(getSettingsModalGuards(true, false), {
    closeBlocked: true,
    mokHeroBlocked: true,
    saveBlocked: true,
  })
  assert.deepEqual(getSettingsModalGuards(false, true), {
    closeBlocked: false,
    mokHeroBlocked: true,
    saveBlocked: true,
  })
  assert.deepEqual(getSettingsModalGuards(false, false), {
    closeBlocked: false,
    mokHeroBlocked: false,
    saveBlocked: false,
  })
})

function elementBlocks(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, 'g')) ?? []
}

function openingTag(block: string, tagName: string): string {
  const tag = block.match(new RegExp(`<${tagName}\\b[^>]*>`))?.[0]
  assert.ok(tag, `Missing <${tagName}> opening tag`)
  return tag
}

function findElementByAttribute(
  html: string,
  tagName: string,
  attribute: string,
  value: string,
): string {
  const block = elementBlocks(html, tagName).find((candidate) =>
    openingTag(candidate, tagName).includes(`${attribute}="${value}"`),
  )
  assert.ok(block, `Missing <${tagName}> with ${attribute}="${value}"`)
  return block
}

function findOpeningTagById(html: string, tagName: string, id: string): string {
  const tag = (html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'g')) ?? []).find((candidate) =>
    candidate.includes(`id="${id}"`),
  )
  assert.ok(tag, `Missing <${tagName}> #${id}`)
  return tag
}

function assertLabeledControl(
  section: string,
  labelText: string,
  tagName: string,
  id: string,
): string {
  const label = findElementByAttribute(section, 'label', 'for', id)
  assert.equal(label.includes(labelText), true, `Label for #${id} must include ${labelText}`)
  return findOpeningTagById(section, tagName, id)
}

test('settings modal exposes the MO.K home hero upload and layout controls', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  const section = findElementByAttribute(
    html,
    'section',
    'aria-label',
    '首页主图（MO.K）设置',
  )

  for (const text of [
    '拖入图片或点击选择',
    '留空使用默认主图',
    '预览',
    '重置',
  ]) {
    assert.equal(section.includes(text), true)
  }

  const uploadLabel = openingTag(
    findElementByAttribute(
      section,
      'label',
      'for',
      'settings-home-mok-hero-input',
    ),
    'label',
  )
  assert.equal(uploadLabel.includes('role="button"'), true)
  assert.equal(uploadLabel.includes('tabindex="0"'), true)
  assert.equal(uploadLabel.includes('aria-disabled="false"'), true)

  const status = (section.match(/<[^>]+>/g) ?? []).find((tag) =>
    tag.includes('role="status"'),
  )
  assert.ok(status, 'Missing persistent MO.K upload status')
  assert.equal(status.includes('aria-live="polite"'), true)

  const upload = assertLabeledControl(
    section,
    '拖入图片或点击选择',
    'input',
    'settings-home-mok-hero-input',
  )
  assert.equal(upload.includes('type="file"'), true)
  assert.equal(upload.includes('accept="image/*"'), true)

  for (const [label, id] of [
    ['主图尺寸', 'settings-home-mok-hero-scale'],
    ['水平位置', 'settings-home-mok-hero-offset-x'],
    ['垂直位置', 'settings-home-mok-hero-offset-y'],
    ['顶部间距', 'settings-home-mok-hero-margin-top'],
  ] as const) {
    const range = assertLabeledControl(section, label, 'input', id)
    assert.equal(range.includes('type="range"'), true, `#${id} must be a range input`)
  }
})
