import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { Position, type Node } from '@xyflow/react'
import { getCardEdgePoint } from '../src/components/canvas/cutEdgeGeometry'

test('node handles stay vertically centered on the node card', () => {
  const wrapperSource = readFileSync(
    resolve('apps/web/src/nodes/NodeWrapper.tsx'),
    'utf8',
  )
  const cssSource = readFileSync(resolve('apps/web/src/App.css'), 'utf8')

  assert.equal(wrapperSource.includes('[data-node-handle-anchor]'), false)
  assert.equal(wrapperSource.includes("'--node-handle-y'"), false)
  assert.equal(wrapperSource.includes('new MutationObserver(observeAnchor)'), false)
  assert.equal(cssSource.includes('top: 50%;'), true)
  assert.equal(cssSource.includes('top: var(--node-handle-y, 50%);'), false)
})

test('cut edges attach to the vertical middle of node sides', () => {
  const node = {
    id: 'image-1',
    position: { x: 100, y: 200 },
    measured: { width: 360, height: 240 },
    data: {},
  } as Node

  assert.deepEqual(
    getCardEdgePoint(node, { x: 460, y: 212 }, Position.Right),
    { x: 460, y: 320 },
  )
  assert.deepEqual(
    getCardEdgePoint(node, { x: 100, y: 428 }, Position.Left),
    { x: 100, y: 320 },
  )
})
