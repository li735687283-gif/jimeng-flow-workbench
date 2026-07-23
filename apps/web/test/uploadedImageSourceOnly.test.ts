import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('uploaded images are marked source-only and cannot open the generation panel', async () => {
  const [canvasView, imageNode] = await Promise.all([
    readFile(new URL('../src/components/canvas/CanvasView.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/nodes/ImageNode.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(canvasView, /localPreviewUrl,\s+sourceOnly: true,\s+status: 'running'/)
  assert.match(canvasView, /assetId: asset\.id,\s+localPreviewUrl: undefined,\s+sourceOnly: true/)
  assert.match(imageNode, /editorMounted && !sourceOnly/)
  assert.match(imageNode, /asset\?\.params\?\.origin !== 'upload'/)
  assert.match(imageNode, /sourceOnly: true,[\s\S]*saveCurrent/)
  assert.match(imageNode, /if \(sourceOnly\) \{[\s\S]*上传图片只能作为参考源/)
})
