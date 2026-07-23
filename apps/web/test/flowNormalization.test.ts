import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFlowCanvasArrays } from '../src/state/flowStore'

test('flowStore defensively normalizes missing and invalid canvas arrays', () => {
  assert.deepEqual(normalizeFlowCanvasArrays({}), {
    nodes: [],
    edges: [],
  })
  assert.deepEqual(
    normalizeFlowCanvasArrays({
      nodes: { bad: true },
      edges: 'bad',
    }),
    {
      nodes: [],
      edges: [],
    },
  )
  const nodes = [
    {
      id: 'node-1',
      position: { x: 0, y: 0 },
      data: {},
    },
  ]
  const edges = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
    },
  ]
  assert.deepEqual(normalizeFlowCanvasArrays({ nodes, edges }), { nodes, edges })
})
