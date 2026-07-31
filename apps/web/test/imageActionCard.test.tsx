import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('image action card keeps zoom action icon-only and exposes core actions', async () => {
  const { ImageActionCard } = await import('../src/components/ImageActionCard')

  const html = renderToStaticMarkup(
    <ImageActionCard
      validationStatus="success"
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )
  const errorHtml = renderToStaticMarkup(
    <ImageActionCard
      validationStatus="error"
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )

  for (const label of ['高清', '校验', '下载']) {
    assert.equal(html.includes(label), true)
  }

  assert.equal(html.includes('100%'), false)
  assert.equal(html.includes('就绪'), false)
  assert.equal(html.includes('CLI 校验通过'), false)
  assert.equal(html.includes('validation-success'), true)
  assert.equal(errorHtml.includes('validation-error'), true)
  assert.equal(html.includes('aria-haspopup="menu"'), false)
  assert.equal(html.includes('aria-label="高清参数"'), false)
  assert.equal(html.includes('确定'), false)
  // 高清按钮改为直接打开配置界面，不再内联 2K/4K/8K 小菜单
  assert.equal(html.includes('image-upscale-menu'), false)
  for (const value of ['2K', '4K', '8K']) {
    assert.equal(html.includes(value), false)
  }

  for (const ariaLabel of [
    '图片高清',
    '校验当前图片模型',
    '下载图片到本地',
    '放大查看图片',
  ]) {
    assert.equal(html.includes(`aria-label="${ariaLabel}"`), true)
  }
})

test('image action card can label provider-specific validation', async () => {
  const { ImageActionCard } = await import('../src/components/ImageActionCard')

  const html = renderToStaticMarkup(
    <ImageActionCard
      validationLabel="校验 OpenAI"
      validationAriaLabel="校验 OpenAI CLI"
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )

  assert.equal(html.includes('校验 OpenAI'), true)
  assert.equal(html.includes('aria-label="校验 OpenAI CLI"'), true)
  assert.equal(html.includes('aria-label="校验即梦 CLI"'), false)
})

test('image action card uses the two-arrow maximize icon for enlargement', async () => {
  const source = await readFile(
    new URL('../src/components/ImageActionCard.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /\bMaximize2\b/)
  assert.doesNotMatch(source, /\bExpand\b/)
})

test('image action card hides grid actions without grid handlers', async () => {
  const { ImageActionCard } = await import('../src/components/ImageActionCard')

  const html = renderToStaticMarkup(
    <ImageActionCard
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )

  assert.equal(html.includes('宫格生成'), false)
  assert.equal(html.includes('宫格切分'), false)
})

test('image action card renders grid generate and grid crop actions', async () => {
  const { ImageActionCard } = await import('../src/components/ImageActionCard')

  const html = renderToStaticMarkup(
    <ImageActionCard
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
      onGridGenerate={() => undefined}
      onGridCrop={() => undefined}
    />,
  )

  assert.equal(html.includes('aria-label="宫格生成"'), true)
  assert.equal(html.includes('aria-label="宫格切分"'), true)
  // 菜单初始关闭，选项不渲染
  assert.equal(html.includes('宫格生成规格'), false)
  assert.equal(html.includes('3×3'), false)
})

test('image action card disables grid actions when gridDisabled', async () => {
  const { ImageActionCard } = await import('../src/components/ImageActionCard')

  const html = renderToStaticMarkup(
    <ImageActionCard
      gridDisabled={true}
      onUpscale={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
      onGridGenerate={() => undefined}
      onGridCrop={() => undefined}
    />,
  )

  assert.match(html, /disabled="" aria-label="宫格生成"/)
  assert.match(html, /disabled="" aria-label="宫格切分"/)
})

test('image action card wires grid callbacks with 3x3 default first', async () => {
  const source = await readFile(
    new URL('../src/components/ImageActionCard.tsx', import.meta.url),
    'utf8',
  )

  // 宫格生成菜单顺序：3×3 默认在最前，其次 2×2、4×4
  assert.match(source, /\['3x3', '2x2', '4x4'\]/)
  // 点选项即触发回调并关闭菜单
  assert.match(source, /setGridMenuOpen\(false\)\s+onGridGenerate\(grid\)/)
  assert.match(source, /onClick=\{onGridCrop\}/)
  // 统一视口菜单负责点外部关闭、Escape 与上下碰撞检测
  assert.match(source, /<ViewportMenuPortal/)
  assert.match(source, /onClose=\{\(\) => setGridMenuOpen\(false\)\}/)
  assert.doesNotMatch(source, /addEventListener\('pointerdown'/)
})
