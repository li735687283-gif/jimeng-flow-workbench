import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useCanvasStore } from '../src/state/canvasStore'

test('canvas store opens and closes the asset reference picker for image and video nodes', () => {
  useCanvasStore.setState({ assetReferenceTarget: null })

  useCanvasStore.getState().openAssetReferencePicker(' image-1 ', 'image')
  assert.deepEqual(useCanvasStore.getState().assetReferenceTarget, {
    nodeId: 'image-1',
    nodeType: 'image',
  })

  useCanvasStore.getState().openAssetReferencePicker('video-1', 'video')
  assert.deepEqual(useCanvasStore.getState().assetReferenceTarget, {
    nodeId: 'video-1',
    nodeType: 'video',
  })

  useCanvasStore.getState().closeAssetReferencePicker()
  assert.equal(useCanvasStore.getState().assetReferenceTarget, null)
})