import assert from 'node:assert/strict'
import test from 'node:test'
import type { Asset } from '@jimeng-flow/shared/asset'
import {
  HOME_MEDIA_PAGE_SIZE,
  distributeHomeMediaAssets,
  filterCanvasGeneratedAssets,
  getHomeMediaColumnCount,
  getHomeMediaLayoutKey,
  getNextHomeMediaVisibleCount,
} from '../src/utils/homeMediaFeed'

function asset(overrides: Partial<Asset> & Pick<Asset, 'id'>): Asset {
  return {
    id: overrides.id,
    type: 'image',
    path: `outputs/${overrides.id}.png`,
    createdAt: '2026-07-31T12:00:00.000Z',
    ...overrides,
  }
}

test('home media feed keeps only canvas-generated images and videos in newest-first order', () => {
  const result = filterCanvasGeneratedAssets([
    asset({ id: 'older-image', sourceNodeId: 'image-1', createdAt: '2026-07-31T10:00:00.000Z' }),
    asset({ id: 'upload', params: { origin: 'upload' }, createdAt: '2026-07-31T13:00:00.000Z' }),
    asset({ id: 'newer-video', type: 'video', path: 'outputs/newer-video.mp4', sourceNodeId: 'video-1', createdAt: '2026-07-31T11:00:00.000Z' }),
  ])

  assert.deepEqual(result.map((item) => item.id), ['newer-video', 'older-image'])
})

test('home media layout key changes when a deleted asset leaves the visible batch', () => {
  const before = [asset({ id: 'a' }), asset({ id: 'b' }), asset({ id: 'c' })]
  const after = [before[0], before[2]]

  assert.equal(getHomeMediaLayoutKey(before), getHomeMediaLayoutKey([...before]))
  assert.notEqual(getHomeMediaLayoutKey(before), getHomeMediaLayoutKey(after))
})

test('home media feed fills every visible masonry column without waiting for scroll', () => {
  const assets = Array.from({ length: 12 }, (_, index) => asset({ id: `asset-${index}` }))

  assert.equal(getHomeMediaColumnCount(1200), 5)
  assert.equal(getHomeMediaColumnCount(900), 3)
  assert.equal(getHomeMediaColumnCount(600), 2)
  assert.deepEqual(
    distributeHomeMediaAssets(assets, 5).map((column) => column.map((item) => item.id)),
    [
      ['asset-0', 'asset-5', 'asset-10'],
      ['asset-1', 'asset-6', 'asset-11'],
      ['asset-2', 'asset-7'],
      ['asset-3', 'asset-8'],
      ['asset-4', 'asset-9'],
    ],
  )
})

test('home media feed reveals one bounded batch at a time', () => {
  assert.equal(HOME_MEDIA_PAGE_SIZE, 12)
  assert.equal(getNextHomeMediaVisibleCount(0, 40), 12)
  assert.equal(getNextHomeMediaVisibleCount(12, 40), 24)
  assert.equal(getNextHomeMediaVisibleCount(36, 40), 40)
  assert.equal(getNextHomeMediaVisibleCount(40, 40), 40)
})
