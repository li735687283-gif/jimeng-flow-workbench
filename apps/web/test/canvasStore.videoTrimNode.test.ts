import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'

function createSourceNode(): Node {
  return {
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
}

test('createTrimmedVideoNode creates and connects a running result on the right', () => {
  useCanvasStore.setState({
    nodes: [createSourceNode()],
    edges: [],
    selectedNodeId: null,
  })

  const targetId = useCanvasStore
    .getState()
    .createTrimmedVideoNode('video-source', 2.5, 3.2)
  const { nodes, edges, selectedNodeId } = useCanvasStore.getState()
  const targetNode = nodes.find((node) => node.id === targetId)

  assert.ok(targetNode)
  assert.equal(targetNode.type, 'video')
  assert.deepEqual(targetNode.position, { x: 920, y: 140 })
  assert.equal(targetNode.data.status, 'running')
  assert.equal(targetNode.data.title, '原视频 裁切 2.5s')
  assert.equal(targetNode.data.trimSourceNodeId, 'video-source')
  assert.equal(targetNode.data.trimStartSeconds, 2.5)
  assert.equal(targetNode.data.trimDurationSeconds, 3.2)
  assert.equal(targetNode.data.durationSeconds, 3.2)
  assert.deepEqual(targetNode.data.assetIds, [])
  assert.deepEqual(targetNode.data.inputVideoAssetIds, ['asset-video-source'])
  assert.equal(selectedNodeId, targetId)
  assert.deepEqual(
    edges.map((edge) => [edge.source, edge.target, edge.type]),
    [['video-source', targetId, 'cut']],
  )
})

test('compression and trim outputs share the same vertical stack', () => {
  useCanvasStore.setState({
    nodes: [createSourceNode()],
    edges: [],
    selectedNodeId: null,
  })

  const compressedId = useCanvasStore
    .getState()
    .createCompressedVideoNode('video-source', 480)
  const trimmedId = useCanvasStore
    .getState()
    .createTrimmedVideoNode('video-source', 1, 4)
  const { nodes } = useCanvasStore.getState()
  const compressed = nodes.find((node) => node.id === compressedId)
  const trimmed = nodes.find((node) => node.id === trimmedId)

  assert.ok(compressed)
  assert.ok(trimmed)
  assert.equal(compressed.position.x, trimmed.position.x)
  assert.notEqual(compressed.position.y, trimmed.position.y)
})
