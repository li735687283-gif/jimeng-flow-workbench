import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAssetDisplayName } from '../src/utils/assetDisplayName'

test('getAssetDisplayName prefers the filename from an asset path', () => {
  assert.equal(
    getAssetDisplayName(
      'asset_1',
      'outputs/2026-07-31/IMG_GEN_20260722.png',
    ),
    'IMG_GEN_20260722.png',
  )
  assert.equal(
    getAssetDisplayName('asset_2', 'outputs\\2026-07-31\\mountain.jpg'),
    'mountain.jpg',
  )
})

test('getAssetDisplayName falls back to the asset id', () => {
  assert.equal(getAssetDisplayName('asset_3'), 'asset_3')
  assert.equal(getAssetDisplayName('asset_4', '   '), 'asset_4')
})
