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
      upscaleResolution="4k"
      onUpscale={() => undefined}
      onUpscaleResolutionChange={() => undefined}
      onValidate={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )
  const errorHtml = renderToStaticMarkup(
    <ImageActionCard
      validationStatus="error"
      upscaleResolution="2k"
      onUpscale={() => undefined}
      onUpscaleResolutionChange={() => undefined}
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
  assert.equal(html.includes('aria-haspopup="menu"'), true)
  assert.equal(html.includes('aria-label="高清参数"'), false)
  assert.equal(html.includes('确定'), false)
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
      upscaleResolution="2k"
      onUpscale={() => undefined}
      onUpscaleResolutionChange={() => undefined}
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
