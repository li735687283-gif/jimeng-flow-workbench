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
    id: 'image-2',
    type: 'image',
    position: { x: 320, y: 0 },
    data: {
      title: 'Image 2',
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

test('removeEdge removes matching video media references from the target node', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const targetNode: Node = {
    id: 'video-1',
    type: 'video',
    position: { x: 320, y: 0 },
    data: {
      title: 'Video 1',
      status: 'idle',
      inputImageAssetIds: ['asset_a', 'asset_b'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_a' },
        { kind: 'image', role: 'last_frame', assetId: 'asset_b' },
      ],
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

  assert.equal(updatedTarget?.data.mode, 'image_to_video')
  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, ['asset_b'])
  assert.deepEqual(updatedTarget?.data.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_b' },
  ])
})

test('removeIncomingImageReference cuts the matching image edge and clears target references', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const otherImageNode: Node = {
    id: 'image-2',
    type: 'image',
    position: { x: 0, y: 200 },
    data: { title: 'Image 2', status: 'idle', assetId: 'asset_b' },
  }
  const targetNode: Node = {
    id: 'video-1',
    type: 'video',
    position: { x: 320, y: 0 },
    data: {
      title: 'Video 1',
      status: 'idle',
      inputImageAssetIds: ['asset_a', 'asset_b'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_a' },
        { kind: 'image', role: 'last_frame', assetId: 'asset_b' },
      ],
    },
  }
  const edgeA: Edge = {
    id: 'edge-a',
    source: imageNode.id,
    target: targetNode.id,
    type: 'cut',
  }
  const edgeB: Edge = {
    id: 'edge-b',
    source: otherImageNode.id,
    target: targetNode.id,
    type: 'cut',
  }

  useCanvasStore.setState({
    nodes: [imageNode, otherImageNode, targetNode],
    edges: [edgeA, edgeB],
    selectedNodeId: null,
  })

  useCanvasStore
    .getState()
    .removeIncomingImageReference(targetNode.id, 'asset_a')

  const state = useCanvasStore.getState()
  const updatedTarget = state.nodes.find((node) => node.id === targetNode.id)

  assert.deepEqual(state.edges.map((edge) => edge.id), ['edge-b'])
  assert.equal(updatedTarget?.data.mode, 'image_to_video')
  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, ['asset_b'])
  assert.deepEqual(updatedTarget?.data.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_b' },
  ])
})

test('onConnect appends image asset references to the target node', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const targetNode: Node = {
    id: 'image-2',
    type: 'image',
    position: { x: 320, y: 0 },
    data: {
      title: 'Image 2',
      status: 'idle',
      inputImageAssetIds: ['asset_b'],
    },
  }

  useCanvasStore.setState({
    nodes: [imageNode, targetNode],
    edges: [],
    selectedNodeId: null,
  })

  useCanvasStore.getState().onConnect({
    source: imageNode.id,
    target: targetNode.id,
    sourceHandle: null,
    targetHandle: null,
  })

  const updatedTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, [
    'asset_b',
    'asset_a',
  ])
})

test('onConnect stores video image references with first and last frame roles', () => {
  const firstImageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const lastImageNode: Node = {
    id: 'image-2',
    type: 'image',
    position: { x: 0, y: 200 },
    data: { title: 'Image 2', status: 'idle', assetId: 'asset_b' },
  }
  const targetNode: Node = {
    id: 'video-1',
    type: 'video',
    position: { x: 320, y: 0 },
    data: {
      title: 'Video 1',
      status: 'idle',
      mode: 'text_to_video',
      inputImageAssetIds: [],
      references: [],
    },
  }

  useCanvasStore.setState({
    nodes: [firstImageNode, lastImageNode, targetNode],
    edges: [],
    selectedNodeId: null,
  })

  useCanvasStore.getState().onConnect({
    source: firstImageNode.id,
    target: targetNode.id,
    sourceHandle: null,
    targetHandle: null,
  })
  useCanvasStore.getState().onConnect({
    source: lastImageNode.id,
    target: targetNode.id,
    sourceHandle: null,
    targetHandle: null,
  })

  const updatedTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, [
    'asset_a',
    'asset_b',
  ])
  assert.deepEqual(updatedTarget?.data.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_a' },
    { kind: 'image', role: 'last_frame', assetId: 'asset_b' },
  ])
})

test('onConnect syncs video mode with connected image references', () => {
  const firstImageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const lastImageNode: Node = {
    id: 'image-2',
    type: 'image',
    position: { x: 0, y: 200 },
    data: { title: 'Image 2', status: 'idle', assetId: 'asset_b' },
  }
  const targetNode: Node = {
    id: 'video-1',
    type: 'video',
    position: { x: 320, y: 0 },
    data: {
      title: 'Video 1',
      status: 'idle',
      mode: 'text_to_video',
      inputImageAssetIds: [],
      references: [],
    },
  }

  useCanvasStore.setState({
    nodes: [firstImageNode, lastImageNode, targetNode],
    edges: [],
    selectedNodeId: null,
  })

  useCanvasStore.getState().onConnect({
    source: firstImageNode.id,
    target: targetNode.id,
    sourceHandle: null,
    targetHandle: null,
  })

  const imageToVideoTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.equal(imageToVideoTarget?.data.mode, 'image_to_video')

  useCanvasStore.getState().onConnect({
    source: lastImageNode.id,
    target: targetNode.id,
    sourceHandle: null,
    targetHandle: null,
  })

  const firstLastTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.equal(firstLastTarget?.data.mode, 'first_last_frame')
})

test('removeNode removes connected image references from downstream nodes', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset-a' },
  }
  const targetNode: Node = {
    id: 'image-2',
    type: 'image',
    position: { x: 320, y: 0 },
    data: {
      title: 'Image 2',
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

  useCanvasStore.getState().removeNode(imageNode.id)

  const updatedTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, ['asset-b'])
})

test('onNodesDelete removes connected image references from downstream nodes', () => {
  const imageNode: Node = {
    id: 'image-1',
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Image 1', status: 'idle', assetId: 'asset_a' },
  }
  const targetNode: Node = {
    id: 'video-1',
    type: 'video',
    position: { x: 320, y: 0 },
    data: {
      title: 'Video 1',
      status: 'idle',
      inputImageAssetIds: ['asset_a', 'asset_b'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_a' },
        { kind: 'image', role: 'last_frame', assetId: 'asset_b' },
      ],
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

  useCanvasStore.getState().onNodesDelete([imageNode])

  const updatedTarget = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === targetNode.id)

  assert.equal(updatedTarget?.data.mode, 'image_to_video')
  assert.deepEqual(updatedTarget?.data.inputImageAssetIds, ['asset_b'])
  assert.deepEqual(updatedTarget?.data.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_b' },
  ])
})
