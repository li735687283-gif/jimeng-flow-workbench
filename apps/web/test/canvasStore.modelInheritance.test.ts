import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../src/state/canvasStore'
import { useGenerationDefaultsStore } from '../src/state/generationDefaultsStore'

test('new image nodes inherit the last selected image model', () => {
  useGenerationDefaultsStore.setState({
    image: { model: 'codex:gpt-5.5' },
    video: null,
  })
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
  })

  const nodeId = useCanvasStore.getState().addNode('image', { x: 10, y: 20 })
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)

  assert.equal(node?.data.model, 'codex:gpt-5.5')
})

test('image nodes created from a connection inherit the source image model', () => {
  useGenerationDefaultsStore.setState({
    image: { model: 'jimeng-default' },
    video: null,
  })
  const sourceNode: Node = {
    id: 'image-source',
    type: 'image',
    position: { x: 0, y: 0 },
    data: {
      title: 'Source',
      status: 'idle',
      model: 'codex:gpt-5.5',
    },
  }

  useCanvasStore.setState({
    nodes: [sourceNode],
    edges: [],
    selectedNodeId: null,
  })

  const targetId = useCanvasStore.getState().addNode('image', { x: 320, y: 0 })
  useCanvasStore.getState().onConnect({
    source: sourceNode.id,
    target: targetId,
    sourceHandle: null,
    targetHandle: null,
  })
  const targetNode = useCanvasStore
    .getState()
    .nodes.find((item) => item.id === targetId)

  assert.equal(targetNode?.data.model, 'codex:gpt-5.5')
})
