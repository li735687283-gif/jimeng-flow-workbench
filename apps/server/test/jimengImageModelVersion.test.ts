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
  assert.equal(getImageResolutionType(4096, 2304, 'jimeng-5.0-pro'), '4k')
})
