import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
      onUpload={() => undefined}
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

  assert.equal(html.includes('aria-haspopup="menu"'), true)
  assert.equal(html.includes('aria-expanded="false"'), true)

  const source = readFileSync(
    'apps/web/src/components/canvas/CanvasBottomToolbar.tsx',
    'utf8',
  )
  assert.match(source, /onMouseEnter=\{\(\) => setAddMenuOpen\(true\)\}/)
  assert.match(source, /onMouseLeave=\{\(\) => setAddMenuOpen\(false\)\}/)
  assert.match(source, /AddNodeMenuContent/)
  assert.equal(html.includes('dock-add-menu-shell'), true)
  assert.doesNotMatch(source, /onClick=\{onAddNode\}/)

  const styles = readFileSync('apps/web/src/App.css', 'utf8')
  assert.equal(styles.includes('--motion-slow: 500ms;'), true)
  const shellRule = styles.match(/\.dock-add-menu-shell\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(shellRule, /opacity var\(--motion-slow\) var\(--ease-standard\)/)
  assert.match(shellRule, /transform var\(--motion-slow\) var\(--ease-standard\)/)
  assert.match(
    styles,
    /\.dock-add-menu-shell\.is-open\s*\{[^}]*opacity:\s*1;[^}]*visibility:\s*visible;/,
  )
  assert.doesNotMatch(styles, /\.dock-add-menu\s*\{[^}]*animation:/)

  for (const removedLabel of ['新建工作流', '保存', '打开']) {
    assert.equal(html.includes(removedLabel), false)
  }
})
