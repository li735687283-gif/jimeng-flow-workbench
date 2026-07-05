import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'

test('removeEdge removes image asset references from the target node', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset-a' },
  }
  const targetNode: Node = {
    id: 'generate-1',
    type: 'generate',
    position: { x: 320, y: 0 },
    data: {
      title: 'Generate 1',
      status: 'idle',
      inputImageAssetIds: ['asset-a', 'asset-b'],
    },
  }
  const edge: Edge = {
    id: 'edge-1',
    source: imageNode.id,
    target: targetNode.id,
    type: 'cut',
  }

  useCanvasStore.setState({
    nodes: [imageNode, targetNode],
    edges: [edge],
    selectedNodeId: null,
  })

  useCanvasStore.getState().removeEdge(edge.id)

  const updatedTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, ['asset-b'])
})
