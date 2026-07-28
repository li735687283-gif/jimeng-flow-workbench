import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { WindowControls } from '../src/components/WindowControls'

Object.assign(globalThis, { React })

test('浏览器环境（无 mokDesktop）不渲染窗口按钮', () => {
  const html = renderToStaticMarkup(createElement(WindowControls))
  assert.equal(html, '')
})

test('桌面环境渲染最小化/最大化/关闭三个按钮', () => {
  const stub = {
    isDesktop: true,
    windowControls: {
      minimize: async () => undefined,
      toggleMaximize: async () => false,
      close: async () => undefined,
      isMaximized: async () => false,
    },
  }
  ;(globalThis as { window?: unknown }).window = {
    mokDesktop: stub,
  } as unknown as Window
  try {
    const html = renderToStaticMarkup(createElement(WindowControls))
    assert.equal(html.includes('最小化'), true)
    assert.equal(html.includes('最大化'), true)
    assert.equal(html.includes('关闭'), true)
    assert.equal(html.includes('window-controls'), true)
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
})
