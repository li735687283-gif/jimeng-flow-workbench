import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getImageDimensionsToPersist,
  getImageFrameSize,
} from '../src/utils/imageDimensions'

test('uses the loaded image dimensions for an uploaded local preview', () => {
  assert.deepEqual(
    getImageDimensionsToPersist(
      { naturalWidth: 1600, naturalHeight: 900 },
      { localPreviewUrl: 'blob:uploaded-image', width: 1024, height: 1024 },
    ),
    { width: 1600, height: 900 },
  )
})

test('does not replace persisted generated dimensions after a remote load', () => {
  assert.equal(
    getImageDimensionsToPersist(
      { naturalWidth: 1536, naturalHeight: 864 },
      { width: 1792, height: 1024 },
    ),
    null,
  )
})

test('ignores images without usable natural dimensions', () => {
  assert.equal(
    getImageDimensionsToPersist(
      { naturalWidth: 0, naturalHeight: 900 },
      { localPreviewUrl: 'blob:uploaded-image' },
    ),
    null,
  )
})

test('keeps the persisted image frame size when the editor opens', () => {
  assert.deepEqual(
    getImageFrameSize(
      { width: 1600, height: 900 },
      { width: 1024, height: 1024 },
    ),
    { width: 1600, height: 900 },
  )
})

test('uses the selected generation size when the image has no saved size', () => {
  assert.deepEqual(
    getImageFrameSize(null, { width: 1024, height: 1024 }),
    { width: 1024, height: 1024 },
  )
})
