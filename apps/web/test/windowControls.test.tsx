import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { WindowControls } from '../src/components/WindowControls'

Object.assign(globalThis, { React })

const desktopStub = {
  isDesktop: true,
  windowControls: {
    minimize: async () => undefined,
    toggleMaximize: async () => false,
    close: async () => undefined,
    isMaximized: async () => false,
  },
}

function withDesktopStub(run: () => void) {
  ;(globalThis as { window?: unknown }).window = {
    mokDesktop: desktopStub,
  } as unknown as Window
  try {
    run()
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
}

test('浏览器环境（无 mokDesktop）不渲染窗口按钮', () => {
  const html = renderToStaticMarkup(createElement(WindowControls))
  assert.equal(html, '')
})

test('桌面环境渲染最小化/最大化/关闭三个按钮', () => {
  withDesktopStub(() => {
    const html = renderToStaticMarkup(createElement(WindowControls))
    assert.equal(html.includes('最小化'), true)
    assert.equal(html.includes('最大化'), true)
    assert.equal(html.includes('关闭'), true)
    assert.equal(html.includes('window-controls'), true)
  })
})

test('缺口箭头是落下按钮栏的唯一触发入口', () => {
  withDesktopStub(() => {
    const html = renderToStaticMarkup(createElement(WindowControls))
    assert.equal(html.includes('aria-label="显示窗口控制按钮"'), true)
    assert.equal(html.includes('aria-expanded="false"'), true)
    assert.match(html, /<button[^>]*class="window-controls-notch"/)
  })
})

test('下拉触发收窄到缺口箭头：热区与按钮栏不主动弹出', () => {
  const source = readFileSync(
    'apps/web/src/components/WindowControls.tsx',
    'utf8',
  )
  const css = readFileSync('apps/web/src/App.css', 'utf8')

  // 触发 hover 只挂在缺口箭头按钮上
  const notchBlock = source.match(
    /className="window-controls-notch"[\s\S]*?\/>/,
  )
  assert.ok(notchBlock)
  assert.match(notchBlock[0], /onMouseEnter=\{show\}/)

  // 热区容器本身不再挂 hover 触发
  const zoneBlock = source.match(/<div\s+className=\{`window-controls-zone[\s\S]*?>/)
  assert.ok(zoneBlock)
  assert.doesNotMatch(zoneBlock[0], /onMouseEnter/)

  // CSS 层：热区不拦截指针，缺口箭头恢复指针事件
  const zoneCss = css.match(/\.window-controls-zone\s*\{[^}]*\}/)
  assert.ok(zoneCss)
  assert.match(zoneCss[0], /pointer-events:\s*none/)
  const notchCss = css.match(/\.window-controls-notch\s*\{[^}]*\}/)
  assert.ok(notchCss)
  assert.match(notchCss[0], /pointer-events:\s*auto/)
})
