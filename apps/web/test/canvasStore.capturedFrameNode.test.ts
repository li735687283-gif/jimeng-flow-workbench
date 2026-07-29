import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'

function seedVideoNode() {
  const sourceNode: Node = {
    id: 'video-source',
    type: 'video',
    position: { x: 100, y: 220 },
    measured: { width: 720, height: 405 },
    data: {
      title: '镜头测试',
      status: 'success',
      assetIds: ['video-asset'],
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })
}

test('createCapturedFrameNode creates an embedded image node to the right without an asset', () => {
  seedVideoNode()

  const targetId = useCanvasStore.getState().createCapturedFrameNode('video-source', {
    dataUrl: 'data:image/jpeg;base64,frame-data',
    width: 1920,
    height: 1080,
    capturedAtSeconds: 9.375,
  })
  const { nodes, edges, selectedNodeId } = useCanvasStore.getState()
  const targetNode = nodes.find((node) => node.id === targetId)

  assert.ok(targetNode)
  assert.equal(targetNode.type, 'image')
  assert.deepEqual(targetNode.position, { x: 940, y: 220 })
  assert.equal(targetNode.data.status, 'success')
  assert.equal(targetNode.data.title, '镜头测试 00:09.375 帧')
  assert.equal(targetNode.data.localPreviewUrl, 'data:image/jpeg;base64,frame-data')
  assert.equal(targetNode.data.sourceOnly, true)
  assert.equal(targetNode.data.width, 1920)
  assert.equal(targetNode.data.height, 1080)
  assert.equal(targetNode.data.ratio, '16:9')
  assert.equal(targetNode.data.capturedFromVideoNodeId, 'video-source')
  assert.equal(targetNode.data.capturedAtSeconds, 9.375)
  assert.equal(targetNode.data.assetId, undefined)
  assert.equal(targetNode.data.outputAssetIds, undefined)
  assert.equal(selectedNodeId, targetId)

  assert.equal(edges.length, 1)
  assert.equal(edges[0].source, 'video-source')
  assert.equal(edges[0].target, targetId)
  assert.equal(edges[0].type, 'cut')
})

test('createCapturedFrameNode stacks repeated captures and rejects unknown sources', () => {
  seedVideoNode()
  const store = useCanvasStore.getState()
  const firstId = store.createCapturedFrameNode('video-source', {
    dataUrl: 'data:image/jpeg;base64,first',
    width: 1080,
    height: 1920,
    capturedAtSeconds: 1,
  })
  const secondId = useCanvasStore.getState().createCapturedFrameNode('video-source', {
    dataUrl: 'data:image/jpeg;base64,second',
    width: 1080,
    height: 1920,
    capturedAtSeconds: 2,
  })
  const { nodes } = useCanvasStore.getState()
  const first = nodes.find((node) => node.id === firstId)
  const second = nodes.find((node) => node.id === secondId)

  assert.ok(first)
  assert.ok(second)
  assert.equal(first.data.ratio, '9:16')
  assert.equal(second.position.x, first.position.x)
  assert.equal(second.position.y, first.position.y + 405 + 40)
  assert.equal(
    useCanvasStore.getState().createCapturedFrameNode('missing', {
      dataUrl: 'data:image/jpeg;base64,missing',
      width: 1,
      height: 1,
      capturedAtSeconds: 0,
    }),
    '',
  )
})