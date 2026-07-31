import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('reference asset strip renders one thumbnail square per referenced image', async () => {
  const { ReferenceAssetStrip } = await import('../src/components/ReferenceAssetStrip')

  const emptyHtml = renderToStaticMarkup(<ReferenceAssetStrip assetIds={[]} />)
  assert.equal(emptyHtml, '')

  const html = renderToStaticMarkup(
    <ReferenceAssetStrip assetIds={['asset_ref_a', 'asset_ref_b']} />,
  )

  assert.equal(html.includes('reference-asset-strip'), true)
  assert.equal(html.includes('aria-label="已引用 2 张图片"'), true)
  assert.equal(html.includes('/api/assets/asset_ref_a/thumb?w=320'), true)
  assert.equal(html.includes('/api/assets/asset_ref_b/thumb?w=320'), true)
  assert.equal(html.includes('reference-asset-preview'), true)
  assert.equal(
    html.includes(
      '<span class="reference-asset-preview" aria-hidden="true"><img src="/api/assets/asset_ref_a/thumb?w=640"',
    ),
    true,
  )
})

test('reference asset strip exposes a remove button for each referenced image', async () => {
  const { ReferenceAssetStrip } = await import('../src/components/ReferenceAssetStrip')

  const html = renderToStaticMarkup(
    <ReferenceAssetStrip
      assetIds={['asset_ref_a', 'asset_ref_b']}
      onRemove={() => undefined}
    />,
  )

  assert.equal(html.includes('reference-asset-remove'), true)
  assert.equal(html.includes('aria-label="取消引用图 1"'), true)
  assert.equal(html.includes('aria-label="取消引用图 2"'), true)
})
test('reference asset strip keeps a fixed add card even without references', async () => {
  const { ReferenceAssetStrip } = await import('../src/components/ReferenceAssetStrip')

  const html = renderToStaticMarkup(
    <ReferenceAssetStrip assetIds={[]} onAdd={() => undefined} />,
  )

  assert.equal(html.includes('reference-asset-strip'), true)
  assert.equal(html.includes('reference-asset-add'), true)
  assert.equal(html.includes('aria-label="从素材库添加参考图片"'), true)
})
