import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('canvas bottom toolbar shows the requested icon actions only', async () => {
  const { CanvasBottomToolbar } = await import(
    '../src/components/canvas/CanvasBottomToolbar'
  )

  const html = renderToStaticMarkup(
    <CanvasBottomToolbar
      onAddNode={() => undefined}
      onOpenAssetLibrary={() => undefined}
      onOpenHistory={() => undefined}
      onLocateNodes={() => undefined}
      onOpenSettings={() => undefined}
    />,
  )

  for (const label of [
    '添加节点',
    '素材库',
    '历史记录',
    '节点定位',
    '设置',
  ]) {
    assert.equal(html.includes(`aria-label="${label}"`), true)
  }

  for (const removedLabel of ['新建工作流', '保存', '打开']) {
    assert.equal(html.includes(removedLabel), false)
  }
})
