import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('image node validates the provider for the selected image model', () => {
  const source = readFileSync('apps/web/src/nodes/ImageNode.tsx', 'utf8')

  assert.match(source, /getCodexStatus/)
  assert.match(source, /testJimengConnection/)
  assert.match(source, /shouldRequireJimengCliForImageModel\(selectedModel\.id\)/)
  assert.match(source, /isCodexImageModel\(selectedModel\.id\)/)
  assert.match(source, /validationLabel=/)
  assert.match(source, /校验 OpenAI/)
  assert.doesNotMatch(source, /onValidate=\{\(\) => void handleValidateJimeng\(\)\}/)
})
