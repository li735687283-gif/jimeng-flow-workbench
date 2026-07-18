import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

Object.assign(globalThis, { React })

test('node context menu exposes separate save, copy, paste and delete actions', async () => {
  const { ContextMenu } = await import('../src/components/menus/ContextMenu')
  const html = renderToStaticMarkup(
    <ContextMenu
      state={{ x: 0, y: 0, flowPosition: { x: 0, y: 0 }, nodeId: 'image-1', assetId: 'asset-1', hasClipboard: true }}
      onAddNode={() => undefined}
      onUpload={() => undefined}
      onSaveToAssetLibrary={() => undefined}
      onCopyNode={() => undefined}
      onPasteNode={() => undefined}
      onDeleteNode={() => undefined}
      onClose={() => undefined}
    />,
  )

  assert.equal(html.includes('保存到资产库'), true)
  assert.equal(html.includes('复制'), true)
  assert.equal(html.includes('粘贴'), true)
  assert.equal(html.includes('删除'), true)
  assert.equal(html.includes('复制粘贴'), false)
  assert.equal(html.includes('取消删除'), false)
  assert.equal(html.includes('上传'), false)
  assert.equal(html.includes('添加节点'), false)
  assert.equal(html.includes('menu-divider'), true)
})

test('asset library cards are read-only articles instead of action buttons', async () => {
  const { AssetLibraryModal } = await import('../src/components/AssetLibraryModal')
  const html = renderToStaticMarkup(
    <AssetLibraryModal
      open={true}
      onClose={() => undefined}
      initialAssets={[{
        id: 'asset_readonly',
        type: 'image',
        path: 'workspace/outputs/asset_readonly.png',
        category: '场景',
        createdAt: '2026-07-07T10:00:00.000Z',
      }]}
    />,
  )

  assert.equal(html.includes('<article class="asset-preview-card"'), true)
  assert.equal(html.includes('<button class="asset-preview-card"'), false)
  assert.equal(html.includes('场景'), true)
})
