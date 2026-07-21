import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getImageModelVersion,
  getImageResolutionType,
} from '../src/services/jimeng/index'

test('maps Jimeng image model ids to Dreamina CLI model_version values', () => {
  assert.equal(getImageModelVersion('jimeng-5.0-pro'), '5.0Pro')
  assert.equal(getImageModelVersion('jimeng-5.0'), '5.0')
  assert.equal(getImageModelVersion('jimeng-4.7'), '4.7')
  assert.equal(getImageModelVersion('jimeng'), null)
})

test('maps agent image dimensions to supported Dreamina resolutions', () => {
  assert.equal(getImageResolutionType(1024, 1024, 'jimeng-5.0-pro'), '1k')
  assert.equal(getImageResolutionType(1024, 1024, 'jimeng-5.0'), '2k')
  // 统一尺寸表：2K = 长边 2048 → 2k；4K = 长边 4096 → 4k（画布与 Agent 一致）
  assert.equal(getImageResolutionType(2048, 1152, 'jimeng-5.0'), '2k')
  assert.equal(getImageResolutionType(2048, 1152, 'jimeng-5.0-pro'), '2k')
  assert.equal(getImageResolutionType(4096, 2304, 'jimeng-5.0'), '4k')
  assert.equal(getImageResolutionType(4096, 2304, 'jimeng-5.0-pro'), '4k')
})
