import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image send button stays busy until generation reaches a terminal state', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const flowStartIndex = source.indexOf('const flow = startImageGenerationFlow')
  assert.notEqual(flowStartIndex, -1)
  const afterFlowStart = source.slice(flowStartIndex)
  const onCompleteIndex = afterFlowStart.indexOf('onComplete:')
  const onErrorIndex = afterFlowStart.indexOf('onError:')
  const errorHandlerIndex = source.indexOf('const handleGenerationError')
  assert.notEqual(onCompleteIndex, -1)
  assert.notEqual(onErrorIndex, -1)
  assert.notEqual(errorHandlerIndex, -1)

  assert.equal(
    /generationUnsubscribeRef\.current = flow\.cancel[\s\S]*setIsGenerating\(false\)/.test(
      afterFlowStart,
    ),
    false,
  )
  assert.match(source.slice(errorHandlerIndex, flowStartIndex), /setIsGenerating\(false\)/)
  assert.match(afterFlowStart.slice(onCompleteIndex, onErrorIndex), /setIsGenerating\(false\)/)
  assert.match(afterFlowStart.slice(onErrorIndex), /handleGenerationError\(error\)/)
})

test('image generation persists the generation id as soon as the task is queued', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')
  const queuedStart = source.indexOf('onQueued: (response) =>')
  const queuedBlock = source.slice(
    queuedStart,
    source.indexOf('onUpdate:', queuedStart),
  )

  assert.notEqual(queuedStart, -1)
  assert.match(queuedBlock, /generationId: response\.id/)
  assert.match(queuedBlock, /setGenerationId\(id, response\.id\)/)
  assert.match(queuedBlock, /saveCurrent\(\)/)
})