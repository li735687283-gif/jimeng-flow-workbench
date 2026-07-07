import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'

test('createUpscaleImageNode creates a running image node to the right and connects it', () => {
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
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })

  const createUpscaleImageNode = (
    useCanvasStore.getState() as unknown as {
      createUpscaleImageNode?: (sourceId: string, resolution: '2k' | '4k' | '8k') => string
    }
  ).createUpscaleImageNode

  assert.equal(typeof createUpscaleImageNode, 'function')

  const targetId = createUpscaleImageNode('image-source', '4k')
  const { nodes, edges, selectedNodeId } = useCanvasStore.getState()
  const targetNode = nodes.find((node) => node.id === targetId)

  assert.ok(targetNode)
  assert.equal(targetNode.type, 'image')
  assert.equal(targetNode.position.x, 580)
  assert.equal(targetNode.position.y, 220)
  assert.equal(targetNode.data.status, 'running')
  assert.equal(targetNode.data.title, '原图 高清')
  assert.equal(targetNode.data.upscaleResolution, '4k')
  assert.equal(targetNode.data.upscaleSourceNodeId, 'image-source')
  assert.deepEqual(targetNode.data.inputImageAssetIds, ['asset-source'])
  assert.equal(selectedNodeId, targetId)

  assert.equal(edges.length, 1)
  assert.equal(edges[0].source, 'image-source')
  assert.equal(edges[0].target, targetId)
  assert.equal(edges[0].type, 'cut')
})
