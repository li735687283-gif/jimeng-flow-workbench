import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  buildUpscaleSummary,
  formatMegapixels,
  formatUpscaleScale,
  getAspectRatioLabel,
  getUpscaleOutputPlan,
  getUpscaleResolutionOptions,
  normalizeUpscaleResolutionForEngine,
} from '../src/utils/upscalePlan'

Object.assign(globalThis, { React })

test('upscale output plan scales the long edge to the target within ratio', () => {
  assert.deepEqual(getUpscaleOutputPlan(1920, 1080, '4k'), {
    width: 4096,
    height: 2304,
    scale: 4096 / 1920,
  })
  // 竖图按长边（高）对齐
  const portrait = getUpscaleOutputPlan(1080, 1920, '2k')
  assert.equal(portrait?.height, 2048)
  assert.equal(portrait?.width, 1152)
  // 8K
  assert.deepEqual(getUpscaleOutputPlan(1000, 1000, '8k'), {
    width: 8192,
    height: 8192,
    scale: 8.192,
  })
  // 非法输入
  assert.equal(getUpscaleOutputPlan(0, 1080, '2k'), null)
  assert.equal(getUpscaleOutputPlan(-5, 10, '2k'), null)
  assert.equal(getUpscaleOutputPlan(Number.NaN, 10, '2k'), null)
})

test('upscale display helpers format scale, ratio, megapixels and summary', () => {
  assert.equal(formatUpscaleScale(4096 / 1920), '≈ 2.1x')
  assert.equal(getAspectRatioLabel(1920, 1080), '16:9')
  assert.equal(getAspectRatioLabel(1000, 1000), '1:1')
  assert.equal(getAspectRatioLabel(0, 10), '')
  assert.equal(formatMegapixels(1920, 1080), '2.1 MP')
  assert.equal(buildUpscaleSummary('dreamina', '4k'), '高清 · 即梦放大 · 4K')
  assert.deepEqual(getUpscaleResolutionOptions('nanobanana-pro'), ['2k', '4k'])
  assert.equal(normalizeUpscaleResolutionForEngine('nanobanana-pro', '8k'), '4k')
  assert.equal(
    buildUpscaleSummary('nanobanana-pro', '2k'),
    '高清 · Nano Banana Pro · 2K',
  )
})

test('upscale overlay renders preview info, engine cards, resolution pills and summary', async () => {
  const { UpscaleOverlay } = await import('../src/components/UpscaleOverlay')

  const html = renderToStaticMarkup(
    <UpscaleOverlay
      open={true}
      imageUrl="/api/assets/a1/file"
      naturalWidth={1920}
      naturalHeight={1080}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  // 左侧原图预览
  assert.equal(html.includes('原图预览'), true)
  assert.equal(html.includes('/api/assets/a1/file'), true)
  // 图片信息区
  assert.equal(html.includes('1920×1080 px'), true)
  assert.equal(html.includes('16:9'), true)
  assert.equal(html.includes('2.1 MP'), true)
  // 引擎卡片：两张都在，默认选中即梦放大
  assert.equal(html.includes('即梦放大'), true)
  assert.equal(html.includes('Nano Banana Pro'), true)
  assert.equal(html.includes('生成式放大，会重绘补充细节'), true)
  assert.equal(html.includes('智能高清增强，尽量保持原图构图与内容'), true)
  assert.match(html, /upscale-engine-card active[^>]*>\s*<span[^>]*>即梦放大/)
  // 目标分辨率：默认 2K 输出 2048×1152，倍率 ≈ 1.1x
  assert.equal(html.includes('2048×1152 px'), true)
  assert.equal(html.includes('≈ 1.1x'), true)
  for (const value of ['2K', '4K', '8K']) {
    assert.equal(html.includes(value), true)
  }
  // 底部摘要 + 发送按钮
  assert.equal(html.includes('高清 · 即梦放大 · 2K'), true)
  assert.equal(html.includes('aria-label="开始高清"'), true)
  assert.equal(html.includes('aria-label="关闭高清配置"'), true)
})

test('upscale overlay respects default engine/resolution and busy/error states', async () => {
  const { UpscaleOverlay } = await import('../src/components/UpscaleOverlay')

  const html = renderToStaticMarkup(
    <UpscaleOverlay
      open={true}
      imageUrl="/x.png"
      naturalWidth={1920}
      naturalHeight={1080}
      defaultEngine="nanobanana-pro"
      defaultResolution="4k"
      busy={true}
      error="Nano Banana Pro 服务暂时不可用"
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )

  assert.equal(html.includes('高清 · Nano Banana Pro · 4K'), true)
  assert.equal(html.includes('4096×2304 px'), true)
  assert.match(html, /upscale-engine-card active[^>]*>\s*<span[^>]*>Nano Banana Pro/)
  assert.equal(html.includes('>8K<'), false)
  // 发送中：控件禁用 + loading 态
  assert.match(html, /disabled=""[^>]*aria-label="高清处理中"/)
  assert.equal(html.includes('upscale-send-spinner'), true)
  // 失败原因显示在面板内
  assert.equal(html.includes('role="alert"'), true)
  assert.equal(html.includes('Nano Banana Pro 服务暂时不可用'), true)

  const closed = renderToStaticMarkup(
    <UpscaleOverlay
      open={false}
      imageUrl="/x.png"
      naturalWidth={100}
      naturalHeight={100}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )
  assert.equal(closed, '')
})

test('upscale overlay can always be dismissed, even while busy', async () => {
  const { UpscaleOverlay } = await import('../src/components/UpscaleOverlay')

  // busy 状态下关闭按钮不被禁用
  const html = renderToStaticMarkup(
    <UpscaleOverlay
      open={true}
      imageUrl="/x.png"
      naturalWidth={100}
      naturalHeight={100}
      busy={true}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />,
  )
  assert.doesNotMatch(html, /disabled=""[^>]*aria-label="关闭高清配置"/)
  assert.equal(html.includes('aria-label="关闭高清配置"'), true)

  // Escape 任何时候都可关闭：任务派发后画布节点自带进度，退出不影响后台任务
  const source = await readFile(
    new URL('../src/components/UpscaleOverlay.tsx', import.meta.url),
    'utf8',
  )
  assert.match(source, /event\.key === 'Escape'\)/)
  assert.doesNotMatch(source, /Escape' && !busy/)
  assert.match(source, /createPortal/)
})

test('upscale dispatch closes the overlay immediately and guards late callbacks', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )
  const handlerStart = source.indexOf('const handleUpscaleImage')
  const handlerEnd = source.indexOf('const handleGridGenerate', handlerStart)
  assert.ok(handlerStart > -1 && handlerEnd > handlerStart)
  const handler = source.slice(handlerStart, handlerEnd)

  // 任务一发出（派生节点已建、已登记 running）即关闭 overlay，不等 HTTP 返回
  const registerIndex = handler.indexOf("setStatus(targetNodeId, 'running')")
  const closeIndex = handler.indexOf('setUpscaleOpen(false)')
  const awaitIndex = handler.indexOf('await upscaleImageAsset')
  assert.ok(registerIndex > -1 && closeIndex > registerIndex)
  assert.ok(closeIndex < awaitIndex)
  // 异步回调写本地 state 前检查组件仍挂载，失败只落到派生节点 error
  assert.match(handler, /if \(mountedRef\.current\) setUpscaleError\(message\)/)
  assert.match(handler, /if \(mountedRef\.current\) setActionBusy\(false\)/)
})

test('upscale flow passes engine through and writes measured size back to the node', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )

  // 引擎与分辨率来自配置界面，一路传给服务端
  assert.match(source, /upscaleImageAsset\(nodeData\.assetId, resolution, engine\)/)
  // 成功后实测新图真实尺寸并写回 width/height/ratio（修尺寸残留旧值的 bug）
  assert.match(source, /measureImageAssetSize\(asset\.id\)/)
  assert.match(source, /width: measured\.width/)
  assert.match(source, /height: measured\.height/)
  assert.match(source, /ratio: getAspectRatioLabel\(measured\.width, measured\.height\)/)
  // 高清按钮改为打开配置界面；失败原因进面板错误区
  assert.match(source, /<UpscaleOverlay/)
  assert.match(source, /setUpscaleError\(message\)/)
  assert.match(source, /error=\{upscaleError\}/)
  assert.match(
    source,
    /onConfirm=\{\(engine, resolution\)\s*=>\s*void handleUpscaleImage\(engine, resolution\)/,
  )
})
