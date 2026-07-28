import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { GRID_PRESET_CONFIGS, buildGridImagePrompt } from '@jimeng-flow/shared/grid'
import { useCanvasStore } from '../src/state/canvasStore'

function seedSourceNode() {
  const sourceNode: Node = {
    id: 'image-source',
    type: 'image',
    position: { x: 100, y: 220 },
    measured: { width: 360, height: 240 },
    data: {
      title: '原图',
      status: 'success',
      assetId: 'asset-source',
      width: 1536,
      height: 864,
      ratio: '16:9',
      model: 'jimeng-5.0-pro',
      quality: 'high',
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })
}

test('createGridImageNode creates a running grid image node to the right and connects it', () => {
  seedSourceNode()

  const targetId = useCanvasStore.getState().createGridImageNode('image-source', '3x3')
  const { nodes, edges, selectedNodeId } = useCanvasStore.getState()
  const targetNode = nodes.find((node) => node.id === targetId)

  assert.ok(targetNode)
  assert.equal(targetNode.type, 'image')
  assert.equal(targetNode.position.x, 580)
  assert.equal(targetNode.position.y, 220)
  assert.equal(targetNode.data.status, 'running')
  assert.equal(targetNode.data.title, '原图 3x3宫格')
  assert.deepEqual(targetNode.data.gridSpec, GRID_PRESET_CONFIGS['3x3'])
  assert.equal(targetNode.data.gridSourceNodeId, 'image-source')
  assert.equal(targetNode.data.prompt, buildGridImagePrompt(3, 3))
  assert.equal(targetNode.data.resolution, '4k')
  assert.equal(targetNode.data.width, 1536)
  assert.equal(targetNode.data.height, 864)
  assert.equal(targetNode.data.ratio, '16:9')
  assert.equal(targetNode.data.model, 'jimeng-5.0-pro')
  assert.equal(targetNode.data.quality, 'high')
  assert.deepEqual(targetNode.data.inputImageAssetIds, ['asset-source'])
  assert.equal(selectedNodeId, targetId)

  assert.equal(edges.length, 1)
  assert.equal(edges[0].source, 'image-source')
  assert.equal(edges[0].target, targetId)
  assert.equal(edges[0].type, 'cut')
})

test('createGridImageNode stacks repeated grid nodes downwards', () => {
  seedSourceNode()

  const firstId = useCanvasStore.getState().createGridImageNode('image-source', '2x2')
  const secondId = useCanvasStore.getState().createGridImageNode('image-source', '4x4')
  const { nodes, edges } = useCanvasStore.getState()
  const first = nodes.find((node) => node.id === firstId)
  const second = nodes.find((node) => node.id === secondId)

  assert.ok(first)
  assert.ok(second)
  assert.notEqual(firstId, secondId)
  assert.equal(first.position.x, second.position.x)
  assert.equal(second.position.y, first.position.y + 240 + 40)
  assert.deepEqual(first.data.gridSpec, { rows: 2, cols: 2 })
  assert.deepEqual(second.data.gridSpec, { rows: 4, cols: 4 })
  assert.equal(edges.length, 2)
  assert.deepEqual(
    edges.map((edge) => [edge.source, edge.target]),
    [
      ['image-source', firstId],
      ['image-source', secondId],
    ],
  )
})

test('createGridImageNode returns empty string for unknown source', () => {
  seedSourceNode()

  assert.equal(useCanvasStore.getState().createGridImageNode('missing', '3x3'), '')
  assert.equal(useCanvasStore.getState().nodes.length, 1)
})
