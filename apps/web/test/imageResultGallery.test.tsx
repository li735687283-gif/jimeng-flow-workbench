import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('image result gallery deduplicates generated assets and shows the collapsed card count', async () => {
  const { getImageResultAssetIds, ImageResultGallery } =
    await import('../src/components/ImageResultGallery')

  assert.deepEqual(getImageResultAssetIds(['asset-a', ' asset-a ', '', 4, 'asset-b']), [
    'asset-a',
    'asset-b',
  ])

  const html = renderToStaticMarkup(
    <ImageResultGallery
      assetIds={['asset-a', 'asset-b', 'asset-c']}
      primaryAssetId="asset-a"
      onSetPrimary={() => undefined}
      onDownload={() => undefined}
    />,
  )

  assert.equal(html.includes('展开3张图片'), true)
  assert.equal(html.includes('3张'), true)
  assert.equal(html.includes('image-result-gallery-stack-card-primary'), true)
})

test('image node exposes the 3-image count and persists the selected result as primary', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /const COUNT_OPTIONS = \[1, 2, 3, 4\] as const/)
  assert.match(source, /ImageResultGallery/)
  assert.match(source, /outputAssetIds: nextOutputAssetIds/)
  assert.match(source, /setSendError\(`主图已切换/) 
})
