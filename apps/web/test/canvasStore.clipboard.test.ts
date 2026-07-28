import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useCanvasStore } from '../src/state/canvasStore'

test('canvas clipboard copies, pastes and removes any node', () => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    clipboardNode: null,
    selectedNodeId: null,
    deletedNodeIds: [],
  })

  const sourceId = useCanvasStore.getState().addNode('image', { x: 10, y: 20 })
  useCanvasStore.getState().updateNodeData(sourceId, {
    title: '原图',
    assetId: 'asset_source',
    status: 'success',
  })

  assert.equal(useCanvasStore.getState().copyNode(sourceId), true)
  assert.equal(useCanvasStore.getState().clipboardNode?.id, sourceId)

  const pastedId = useCanvasStore.getState().pasteNode({ x: 200, y: 220 })
  assert.notEqual(pastedId, '')
  const pasted = useCanvasStore.getState().nodes.find((node) => node.id === pastedId)
  assert.deepEqual(pasted?.position, { x: 200, y: 220 })
  assert.equal((pasted?.data as { assetId?: string }).assetId, 'asset_source')
  assert.equal((pasted?.data as { title?: string }).title, '原图 副本')

  useCanvasStore.getState().removeNode(pastedId)
  assert.equal(useCanvasStore.getState().nodes.some((node) => node.id === pastedId), false)
  assert.equal(useCanvasStore.getState().copyNode('missing-node'), false)

  useCanvasStore.setState({ clipboardNode: null })
  assert.equal(useCanvasStore.getState().pasteNode(), '')
})

test('pasted running generation nodes detach from the source task', () => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    clipboardNode: null,
    selectedNodeId: null,
    deletedNodeIds: [],
  })
  const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
  useCanvasStore.getState().updateNodeData(sourceId, {
    title: '生成中',
    status: 'running',
    generationId: 'gen-source',
    error: '旧错误',
  })
  useCanvasStore.getState().copyNode(sourceId)
  const pastedId = useCanvasStore.getState().pasteNode({ x: 30, y: 30 })
  const pastedData = useCanvasStore.getState().nodes.find((node) => node.id === pastedId)?.data as Record<string, unknown>
  const sourceData = useCanvasStore.getState().nodes.find((node) => node.id === sourceId)?.data as Record<string, unknown>

  assert.equal(pastedData.generationId, undefined)
  assert.equal(pastedData.status, 'idle')
  assert.equal(pastedData.error, undefined)
  assert.equal(sourceData.generationId, 'gen-source')
  assert.equal(sourceData.status, 'running')
})

test('pasted running nodes with an old result become successful and keep the asset', () => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    clipboardNode: null,
    selectedNodeId: null,
    deletedNodeIds: [],
  })
  const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
  useCanvasStore.getState().updateNodeData(sourceId, {
    title: '再次生成中',
    status: 'running',
    generationId: 'gen-redraw',
    assetId: 'asset-existing',
    generationRuns: [{ generationId: 'gen-old', assetIds: ['asset-existing'] }],
  })
  useCanvasStore.getState().copyNode(sourceId)
  const pastedId = useCanvasStore.getState().pasteNode({ x: 60, y: 60 })
  const pastedData = useCanvasStore.getState().nodes.find((node) => node.id === pastedId)?.data as Record<string, unknown>

  assert.equal(pastedData.generationId, undefined)
  assert.equal(pastedData.status, 'success')
  assert.equal(pastedData.assetId, 'asset-existing')
  assert.deepEqual(pastedData.generationRuns, [
    { generationId: 'gen-old', assetIds: ['asset-existing'] },
  ])
})
