import assert from 'node:assert/strict'
import test from 'node:test'
import { inferAssetCategory } from '../src/services/assets'

test('asset library auto classification maps character, prop and scene prompts', () => {
  assert.equal(inferAssetCategory({ type: 'image', prompt: 'a character portrait', params: {} }), '角色')
  assert.equal(inferAssetCategory({ type: 'image', prompt: 'a sword and prop table', params: {} }), '道具')
  assert.equal(inferAssetCategory({ type: 'image', prompt: 'a misty mountain background', params: {} }), '场景')
})