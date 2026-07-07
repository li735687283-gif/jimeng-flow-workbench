import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVideoReferencesFromInputImages,
  getVideoReferenceInputs,
} from '@jimeng-flow/shared/videoNode'

test('buildVideoReferencesFromInputImages marks first and last frame inputs', () => {
  const refs = buildVideoReferencesFromInputImages('first_last_frame', [
    'asset_first',
    'asset_last',
  ])

  assert.deepEqual(refs, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
    { kind: 'image', role: 'last_frame', assetId: 'asset_last' },
  ])
})

test('buildVideoReferencesFromInputImages keeps multi-image references as regular references', () => {
  const refs = buildVideoReferencesFromInputImages('all_reference', [
    'asset_a',
    'asset_b',
  ])

  assert.deepEqual(refs, [
    { kind: 'image', role: 'reference', assetId: 'asset_a' },
    { kind: 'image', role: 'reference', assetId: 'asset_b' },
  ])
})

test('getVideoReferenceInputs returns asset ids and external urls in request order', () => {
  const inputs = getVideoReferenceInputs([
    { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
    { kind: 'image', role: 'last_frame', url: 'workspace/last.png' },
  ])

  assert.deepEqual(inputs, ['asset_first', 'workspace/last.png'])
})
