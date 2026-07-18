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
  assert.match(html, /add-node-menu-item secondary-menu-option selected/)
  assert.match(html, /aria-checked="true"/)
  assert.equal(html.includes('<select'), false)
})

test('project rules require the unified secondary-menu template', () => {
  const rules = readFileSync('AGENTS.md', 'utf8')
  const source = readFileSync(
    'apps/web/src/components/AgentPanel.tsx',
    'utf8',
  )
  const imagePlan = source.slice(
    source.indexOf('<div className="agent-image-params"'),
    source.indexOf('{!selectedAgentImageModel'),
  )

  assert.match(rules, /所有用户可见的二级菜单、下拉菜单和参数选择菜单/)
  assert.match(rules, /SecondaryMenuSelect/)
  assert.match(rules, /不得使用原生 `<select>`/)
  assert.equal((imagePlan.match(/<SecondaryMenuSelect/g) ?? []).length, 4)
  assert.equal(imagePlan.includes('<select'), false)
})
