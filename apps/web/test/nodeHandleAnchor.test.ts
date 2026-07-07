import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('media node handles align to the primary media card anchor', () => {
  const wrapperSource = readFileSync(
    resolve('apps/web/src/nodes/NodeWrapper.tsx'),
    'utf8',
  )
  const imageSource = readFileSync(
    resolve('apps/web/src/nodes/ImageNode.tsx'),
    'utf8',
  )
  const videoSource = readFileSync(
    resolve('apps/web/src/nodes/VideoNode.tsx'),
    'utf8',
  )
  const cssSource = readFileSync(resolve('apps/web/src/App.css'), 'utf8')

  assert.equal(wrapperSource.includes('[data-node-handle-anchor]'), true)
  assert.equal(wrapperSource.includes("'--node-handle-y'"), true)
  assert.equal(wrapperSource.includes('new MutationObserver(observeAnchor)'), true)
  assert.equal(wrapperSource.includes('}, [nodeId, applyHandleCenterY])'), true)
  assert.equal(
    wrapperSource.includes('[handleCenterY, nodeId, updateNodeInternals]'),
    true,
  )
  assert.equal(imageSource.includes('data-node-handle-anchor'), true)
  assert.equal(videoSource.includes('data-node-handle-anchor'), true)
  assert.equal(cssSource.includes('top: var(--node-handle-y, 50%);'), true)
})
