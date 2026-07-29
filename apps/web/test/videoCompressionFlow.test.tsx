import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { VideoActionCard } from '../src/components/VideoActionCard'

Object.assign(globalThis, { React })

test('video action card exposes the video compression entry', () => {
  const html = renderToStaticMarkup(
    <VideoActionCard
      onValidate={() => undefined}
      onCompress={() => undefined}
      onDownload={() => undefined}
      onOpenFullSize={() => undefined}
    />,
  )

  assert.equal(html.includes('aria-label="压缩视频"'), true)
  assert.equal(html.includes('视频压缩'), true)
})

test('video compression dispatch creates a running node before calling the API', async () => {
  const source = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  const handlerStart = source.indexOf('const handleCompressVideo')
  const handlerEnd = source.indexOf(
    '/** 退出节点上可能触发的浏览器原生全屏',
    handlerStart,
  )
  assert.ok(handlerStart > -1 && handlerEnd > handlerStart)
  const handler = source.slice(handlerStart, handlerEnd)

  const createIndex = handler.indexOf('createCompressedVideoNode')
  const runningIndex = handler.indexOf("setStatus(targetNodeId, 'running')")
  const closeIndex = handler.indexOf('setCompressionOpen(false)')
  const requestIndex = handler.indexOf('await compressVideoAsset')
  assert.ok(createIndex > -1)
  assert.ok(runningIndex > createIndex)
  assert.ok(closeIndex > runningIndex)
  assert.ok(requestIndex > closeIndex)
  assert.match(handler, /assetIds: \[asset\.id\]/)
  assert.match(handler, /width: outputWidth/)
  assert.match(handler, /height: outputHeight/)
})

test('video compression progress uses compression-specific wording', async () => {
  const source = await readFile(
    new URL('../src/nodes/VideoNode.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    source,
    /nodeData\.compressionSourceNodeId \? '视频压缩中' : '视频生成中'/,
  )
  assert.match(source, /<VideoCompressionOverlay/)
  assert.match(source, /onCompress=\{handleOpenCompression\}/)
})
