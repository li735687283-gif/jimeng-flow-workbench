import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('SecondaryMenuSelect reuses the canvas double-click menu template', async () => {
  const { SecondaryMenuSelect } = await import(
    '../src/components/menus/SecondaryMenuSelect'
  )
  const html = renderToStaticMarkup(
    <SecondaryMenuSelect
      label="清晰度"
      value="4K"
      options={[
        { value: '2K', label: '2K' },
        { value: '4K', label: '4K' },
      ]}
      open
      onOpenChange={() => undefined}
      onChange={() => undefined}
    />,
  )

  assert.match(html, /role="combobox"/)
  assert.match(html, /add-node-menu secondary-menu-options/)
  assert.match(html, /viewport-menu-layer/)
  assert.match(html, /data-placement="down"/)
  assert.match(html, /add-node-menu-item secondary-menu-option selected/)
  assert.match(html, /aria-checked="true"/)
  assert.equal(html.includes('<select'), false)
})

test('SecondaryMenuSelect portals above clipping containers and follows the viewport', () => {
  const portalSource = readFileSync(
    'apps/web/src/components/menus/ViewportMenuPortal.tsx',
    'utf8',
  )
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  assert.match(portalSource, /createPortal\(menu, document\.body\)/)
  assert.match(portalSource, /getFloatingMenuPlacement/)
  assert.match(portalSource, /addEventListener\('scroll', updatePlacement, true\)/)
  assert.match(portalSource, /maxHeight: next\.maxHeight/)
  assert.match(css, /\.viewport-menu-layer\s*\{[^}]*z-index:\s*2147483000\s*!important;/s)
  assert.match(css, /\.secondary-menu-options\s*\{[^}]*position:\s*fixed;/s)
  assert.match(css, /scrollbar-gutter:\s*stable/)
})

test('project rules require the unified secondary-menu template', () => {
  const rules = readFileSync('AGENTS.md', 'utf8')
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )

  assert.match(rules, /所有用户可见的二级菜单、下拉菜单和参数选择菜单/)
  assert.match(rules, /SecondaryMenuSelect/)
  assert.match(rules, /不得使用原生 `<select>`/)
  // Agent 确认卡上的参数选择（画面比例/清晰度）必须走统一模板，禁止原生 select
  assert.equal(source.includes('<select'), false)
  assert.equal((source.match(/<SecondaryMenuSelect/g) ?? []).length >= 2, true)
})
