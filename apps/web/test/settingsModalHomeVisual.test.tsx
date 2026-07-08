import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('settings modal exposes simple drag or click slots for home visuals', async () => {
  const { SettingsModal } = await import('../src/components/SettingsModal')

  const html = renderToStaticMarkup(
    <SettingsModal open={true} onClose={() => undefined} />,
  )

  for (const text of [
    '首页视觉',
    '首页背景',
    '拖入图片或点击选择',
    '留空使用默认背景',
  ]) {
    assert.equal(html.includes(text), true)
  }

  assert.equal(html.includes('Logo 图标'), false)
  assert.equal(html.includes('留空使用默认 Logo'), false)

  assert.equal(html.includes('type="file"'), true)
  assert.equal(html.includes('accept="image/*"'), true)
})
