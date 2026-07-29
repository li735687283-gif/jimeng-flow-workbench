import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getImageGenerationProgressState } from '../src/utils/imageGenerationProgress'

test('upscale nodes show an indeterminate progress state with upscale wording', () => {
  assert.deepEqual(getImageGenerationProgressState('running', true, 'upscale'), {
    visible: true,
    label: '高清处理中',
    valueText: '处理中',
  })
  assert.deepEqual(getImageGenerationProgressState('queued', false, 'upscale'), {
    visible: true,
    label: '高清处理中',
    valueText: '处理中',
  })
  // 完成/失败后不再显示
  assert.equal(getImageGenerationProgressState('success', false, 'upscale').visible, false)
  assert.equal(getImageGenerationProgressState('error', false, 'upscale').visible, false)
  // 默认生成标签不受影响
  assert.equal(getImageGenerationProgressState('running', false).label, '图片生成中')
})

test('upscale flow registers the derived node in the generate store while in flight', async () => {
  const source = await readFile(
    new URL('../src/nodes/ImageNode.tsx', import.meta.url),
    'utf8',
  )

  const handlerStart = source.indexOf('const handleUpscaleImage')
  assert.notEqual(handlerStart, -1)
  const handlerEnd = source.indexOf('const handleGridGenerate', handlerStart)
  assert.notEqual(handlerEnd, -1)
  const handler = source.slice(handlerStart, handlerEnd)

  // 派生节点 status:'running' 但没有 generationId；必须登记进 generateStore，
  // 否则 isInterruptedImageGeneration 会把它误判成「中断」并直接改写为 error，
  // 进度遮罩随之消失。登记必须先于首个 await，保证节点挂载时已处于 running。
  const createIndex = handler.indexOf('createUpscaleImageNode')
  const registerIndex = handler.indexOf("setStatus(targetNodeId, 'running')")
  const awaitIndex = handler.indexOf('await upscaleImageAsset')
  assert.notEqual(createIndex, -1)
  assert.notEqual(registerIndex, -1)
  assert.ok(createIndex < registerIndex)
  assert.ok(registerIndex < awaitIndex)
  // 收尾（成功或失败）都要清掉 store 状态，遮罩才会随节点 data 状态隐藏
  assert.match(handler, /finally\s*\{[\s\S]*?reset\(targetNodeId\)/)

  // 高清节点的进度遮罩使用高清文案
  assert.match(
    source,
    /getImageGenerationProgressState\(\s*nodeData\.status,\s*generationRequestInFlight,\s*nodeData\.upscaleSourceNodeId \? 'upscale' : 'generate',?\s*\)/,
  )
})
