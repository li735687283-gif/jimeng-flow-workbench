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
