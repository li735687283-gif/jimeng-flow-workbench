import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAssetThumbUrl } from '../src/api/assets'

test('getAssetThumbUrl 生成缩略图地址并编码资产 ID', () => {
  assert.equal(getAssetThumbUrl('asset_123'), '/api/assets/asset_123/thumb?w=640')
  assert.equal(getAssetThumbUrl('asset_123', 960), '/api/assets/asset_123/thumb?w=960')
  assert.equal(getAssetThumbUrl('a/b'), '/api/assets/a%2Fb/thumb?w=640')
})
