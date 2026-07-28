import assert from 'node:assert/strict'
import test from 'node:test'
import { Jimp } from 'jimp'
import type { Asset } from '@jimeng-flow/shared/asset'

import {
  computeSliceCells,
  cropAssetRegions,
  normalizeCropRegions,
  SliceGridError,
  type SliceGridDeps,
} from '../src/services/sliceGrid'
import type { SaveUploadInput } from '../src/services/assets'

test('computeSliceCells 行列正确，余数像素归最后一行/列', () => {
  // 10×7，3×3：cellW=3、cellH=2，最后一列宽 4，最后一行高 3
  const cells = computeSliceCells(10, 7, 3, 3)
  assert.equal(cells.length, 9)
  assert.deepEqual(cells[0], { x: 0, y: 0, w: 3, h: 2 })
  assert.deepEqual(cells[1], { x: 3, y: 0, w: 3, h: 2 })
  assert.deepEqual(cells[2], { x: 6, y: 0, w: 4, h: 2 })
  assert.deepEqual(cells[6], { x: 0, y: 4, w: 3, h: 3 })
  assert.deepEqual(cells[8], { x: 6, y: 4, w: 4, h: 3 })
  // 覆盖全图无重叠
  const area = cells.reduce((sum, c) => sum + c.w * c.h, 0)
  assert.equal(area, 10 * 7)
})

test('computeSliceCells inset 向内收缩且防负尺寸', () => {
  // 100×60，2 行 4 列：cellW=25、cellH=30，10% inset → 各边收 3px
  const cells = computeSliceCells(100, 60, 2, 4, 10)
  assert.deepEqual(cells[0], { x: 3, y: 3, w: 19, h: 24 })
  assert.deepEqual(cells[3], { x: 78, y: 3, w: 19, h: 24 })
  assert.deepEqual(cells[7], { x: 78, y: 33, w: 19, h: 24 })
  // cellW=2、25% inset → 收 1px，裸宽 0，防负后最小 1px
  const tiny = computeSliceCells(8, 8, 4, 4, 25)
  for (const cell of tiny) {
    assert.ok(cell.w >= 1 && cell.h >= 1)
  }
})

test('normalizeCropRegions 校验 regions 数组与每项取值', () => {
  assert.deepEqual(normalizeCropRegions({ regions: [{ x: 0, y: 0, w: 10, h: 10 }] }), [
    { x: 0, y: 0, w: 10, h: 10 },
  ])
  const maxed = {
    regions: Array.from({ length: 49 }, () => ({ x: 0, y: 0, w: 1, h: 1 })),
  }
  assert.equal(normalizeCropRegions(maxed).length, 49)

  const tooMany = {
    regions: Array.from({ length: 50 }, () => ({ x: 0, y: 0, w: 1, h: 1 })),
  }
  for (const bad of [
    {},
    { regions: [] },
    { regions: 'not-array' },
    tooMany,
    { regions: [{ x: -1, y: 0, w: 10, h: 10 }] },
    { regions: [{ x: 0, y: -2, w: 10, h: 10 }] },
    { regions: [{ x: 0, y: 0, w: 0, h: 10 }] },
    { regions: [{ x: 0, y: 0, w: 10, h: 0.5 }] },
    { regions: [{ x: Number.NaN, y: 0, w: 10, h: 10 }] },
    { regions: [{ x: 0, y: 0, w: Number.POSITIVE_INFINITY, h: 10 }] },
    { regions: [null] },
    { regions: [{ x: 0, y: 0, w: 1, h: 1 }, 'garbage'] },
    null,
  ]) {
    assert.throws(
      () => normalizeCropRegions(bad),
      (error: unknown) =>
        error instanceof SliceGridError && error.statusCode === 400,
    )
  }
})

const COLORS = {
  red: 0xff0000ff,
  green: 0x00ff00ff,
  blue: 0x0000ffff,
  white: 0xffffffff,
}

/** 生成 2×2 四色测试图：左上红、右上绿、左下蓝、右下白 */
async function makeQuadrantImage(size = 12): Promise<Awaited<ReturnType<typeof Jimp.read>>> {
  const image = new Jimp({ width: size, height: size, color: COLORS.white })
  const half = size / 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color =
        y < half
          ? x < half
            ? COLORS.red
            : COLORS.green
          : x < half
            ? COLORS.blue
            : COLORS.white
      image.setPixelColor(color, x, y)
    }
  }
  return image
}

function makeDeps(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  saved: SaveUploadInput[],
): SliceGridDeps {
  return {
    getAssetImpl: async () =>
      ({
        id: 'asset_test_grid',
        type: 'image',
        path: 'outputs/2026-01-01/asset_test_grid.png',
        createdAt: new Date().toISOString(),
      }) as Asset,
    readImageImpl: async () => image,
    saveAssetImpl: async (input) => {
      saved.push(input)
      return {
        id: `asset_crop_${saved.length}`,
        type: 'image',
        path: `outputs/2026-01-01/asset_crop_${saved.length}.png`,
        inputAssetIds: input.inputAssetIds ?? [],
        params: input.params,
        createdAt: new Date().toISOString(),
      } as Asset
    },
  }
}

test('cropAssetRegions 按传入顺序裁剪，颜色与来源元数据正确', async () => {
  const saved: SaveUploadInput[] = []
  const image = await makeQuadrantImage(12)
  const { assets } = await cropAssetRegions(
    'asset_test_grid',
    {
      regions: [
        { x: 0, y: 0, w: 6, h: 6 },
        { x: 6, y: 0, w: 6, h: 6 },
        { x: 0, y: 6, w: 6, h: 6 },
        { x: 6, y: 6, w: 6, h: 6 },
      ],
    },
    makeDeps(image, saved),
  )

  assert.equal(assets.length, 4)
  assert.equal(saved.length, 4)
  const expectedColors = [COLORS.red, COLORS.green, COLORS.blue, COLORS.white]
  for (let i = 0; i < 4; i += 1) {
    const tile = await Jimp.read(saved[i].fileBuffer)
    assert.equal(tile.width, 6)
    assert.equal(tile.height, 6)
    assert.equal(tile.getPixelColor(0, 0), expectedColors[i])
    assert.equal(tile.getPixelColor(5, 5), expectedColors[i])
    assert.deepEqual(saved[i].inputAssetIds, ['asset_test_grid'])
    assert.equal(saved[i].originalName, `crop-asset_test_grid-${i + 1}.png`)
    assert.equal(saved[i].prompt, `宫格裁剪 第${i + 1}张（来源 asset_test_grid）`)
    assert.equal(saved[i].mimeType, 'image/png')
    assert.deepEqual(saved[i].params, {
      operation: 'crop_region',
      sourceAssetId: 'asset_test_grid',
      index: i + 1,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 6,
      w: 6,
      h: 6,
    })
  }
})

test('cropAssetRegions 越界区域夹紧到图像范围', async () => {
  const saved: SaveUploadInput[] = []
  const image = await makeQuadrantImage(12)
  // 跨过右边界和下边界：应夹紧为 x=6,y=6,w=6,h=6（白色象限）
  const { assets } = await cropAssetRegions(
    'asset_test_grid',
    { regions: [{ x: 6, y: 6, w: 100, h: 100 }] },
    makeDeps(image, saved),
  )
  assert.equal(assets.length, 1)
  const tile = await Jimp.read(saved[0].fileBuffer)
  assert.equal(tile.width, 6)
  assert.equal(tile.height, 6)
  assert.equal(tile.getPixelColor(0, 0), COLORS.white)
  assert.deepEqual(saved[0].params, {
    operation: 'crop_region',
    sourceAssetId: 'asset_test_grid',
    index: 1,
    x: 6,
    y: 6,
    w: 6,
    h: 6,
  })
})

test('cropAssetRegions 完全出界的区域跳过，其余保留原顺序', async () => {
  const saved: SaveUploadInput[] = []
  const image = await makeQuadrantImage(12)
  const { assets } = await cropAssetRegions(
    'asset_test_grid',
    {
      regions: [
        { x: 100, y: 0, w: 5, h: 5 }, // 起点出界，跳过
        { x: 0, y: 0, w: 6, h: 6 }, // 红
        { x: 6, y: 0, w: 6, h: 6 }, // 绿
      ],
    },
    makeDeps(image, saved),
  )
  assert.equal(assets.length, 2)
  // params.index 保留原传入序号（第 1 项被跳过，剩 2、3）
  assert.equal(saved[0].params?.index, 2)
  assert.equal(saved[1].params?.index, 3)
  const first = await Jimp.read(saved[0].fileBuffer)
  assert.equal(first.getPixelColor(0, 0), COLORS.red)
  const second = await Jimp.read(saved[1].fileBuffer)
  assert.equal(second.getPixelColor(0, 0), COLORS.green)
})

test('cropAssetRegions 全部区域出界时报 400', async () => {
  const image = await makeQuadrantImage(12)
  await assert.rejects(
    cropAssetRegions(
      'asset_test_grid',
      {
        regions: [
          { x: 100, y: 0, w: 5, h: 5 },
          { x: 0, y: 100, w: 5, h: 5 },
        ],
      },
      makeDeps(image, []),
    ),
    (error: unknown) =>
      error instanceof SliceGridError && error.statusCode === 400,
  )
})

test('cropAssetRegions 资产不存在报 404，非图片报 400', async () => {
  await assert.rejects(
    cropAssetRegions(
      'asset_missing',
      { regions: [{ x: 0, y: 0, w: 1, h: 1 }] },
      { getAssetImpl: async () => null },
    ),
    (error: unknown) =>
      error instanceof SliceGridError && error.statusCode === 404,
  )
  await assert.rejects(
    cropAssetRegions(
      'asset_video',
      { regions: [{ x: 0, y: 0, w: 1, h: 1 }] },
      {
        getAssetImpl: async () =>
          ({
            id: 'asset_video',
            type: 'video',
            path: 'outputs/2026-01-01/asset_video.mp4',
            createdAt: new Date().toISOString(),
          }) as Asset,
      },
    ),
    (error: unknown) =>
      error instanceof SliceGridError && error.statusCode === 400,
  )
})

test('cropAssetRegions 参数非法在读取资产前就报 400', async () => {
  let lookedUp = false
  await assert.rejects(
    cropAssetRegions(
      'asset_test_grid',
      { regions: [] },
      {
        getAssetImpl: async () => {
          lookedUp = true
          return null
        },
      },
    ),
    (error: unknown) =>
      error instanceof SliceGridError && error.statusCode === 400,
  )
  assert.equal(lookedUp, false)
})
