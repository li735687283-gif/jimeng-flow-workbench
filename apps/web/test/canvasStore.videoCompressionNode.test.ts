import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'

test('createCompressedVideoNode creates a running video node to the right and connects it', () => {
  const sourceNode: Node = {
    id: 'video-source',
    type: 'video',
    position: { x: 80, y: 140 },
    measured: { width: 720, height: 405 },
    data: {
      title: '原视频',
      status: 'success',
      assetIds: ['asset-video-source'],
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })

  const targetId = useCanvasStore
    .getState()
    .createCompressedVideoNode('video-source', 480)
  const { nodes, edges, selectedNodeId } = useCanvasStore.getState()
  const targetNode = nodes.find((node) => node.id === targetId)

  assert.ok(targetNode)
  assert.equal(targetNode.type, 'video')
  assert.equal(targetNode.position.x, 920)
  assert.equal(targetNode.position.y, 140)
  assert.equal(targetNode.data.status, 'running')
  assert.equal(targetNode.data.title, '原视频 480P')
  assert.equal(targetNode.data.compressionSourceNodeId, 'video-source')
  assert.equal(targetNode.data.compressionTargetHeight, 480)
  assert.deepEqual(targetNode.data.assetIds, [])
  assert.deepEqual(targetNode.data.inputVideoAssetIds, ['asset-video-source'])
  assert.equal(selectedNodeId, targetId)
  assert.deepEqual(
    edges.map((edge) => [edge.source, edge.target, edge.type]),
    [['video-source', targetId, 'cut']],
  )
})

test('createCompressedVideoNode stacks repeated outputs without covering them', () => {
  const sourceNode: Node = {
    id: 'video-source',
    type: 'video',
    position: { x: 80, y: 140 },
    measured: { width: 720, height: 405 },
    data: {
      title: '原视频',
      status: 'success',
      assetIds: ['asset-video-source'],
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })

  const firstId = useCanvasStore
    .getState()
    .createCompressedVideoNode('video-source', 480)
  const secondId = useCanvasStore
    .getState()
    .createCompressedVideoNode('video-source', 360)
  const { nodes, edges } = useCanvasStore.getState()
  const first = nodes.find((node) => node.id === firstId)
  const second = nodes.find((node) => node.id === secondId)

  assert.ok(first)
  assert.ok(second)
  assert.equal(first.position.x, second.position.x)
  assert.notEqual(first.position.y, second.position.y)
  assert.equal(edges.length, 2)
})
