import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import {
  buildZipEntries,
  collectGroupAssets,
  collectImageAssets,
} from '../src/utils/batchDownload'
import { GROUP_FRAME_TYPE } from '../src/utils/nodeGroup'

function mediaNode(
  id: string,
  type: string,
  data: Record<string, unknown>,
  groupId?: string,
): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: groupId ? { ...data, groupId } : data,
  } as Node
}

const frame = {
  id: 'f1',
  type: GROUP_FRAME_TYPE,
  position: { x: 0, y: 0 },
  width: 800,
  height: 600,
  data: {},
} as Node

test('collectGroupAssets 收集组内全部图片和视频，与选区无关', () => {
  const nodes = [
    frame,
    mediaNode('a', 'image', { title: '海报', outputAssetIds: ['a1', 'a2'] }, 'f1'),
    mediaNode('b', 'video', { title: '片头', assetIds: ['v1'] }, 'f1'),
    mediaNode('c', 'image', { title: '组外图', assetId: 'x1' }),
    mediaNode('d', 'text', { title: '文本' }, 'f1'),
  ]
  const groups = collectGroupAssets(nodes, 'f1')
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0], {
    title: '海报',
    items: [
      { assetId: 'a1', ext: 'png' },
      { assetId: 'a2', ext: 'png' },
    ],
  })
  assert.deepEqual(groups[1], { title: '片头', items: [{ assetId: 'v1', ext: 'mp4' }] })
})

test('collectImageAssets 收集选中节点的图片和视频素材', () => {
  const nodes = [
    mediaNode('a', 'image', { title: '海报', outputAssetIds: ['a1', 'a2'], assetId: 'a1' }),
    mediaNode('b', 'video', { title: '视频', assetIds: ['v1'] }),
    mediaNode('c', 'image', { title: '空的' }),
  ]
  const groups = collectImageAssets(nodes, ['a', 'b', 'c'])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[1], { title: '视频', items: [{ assetId: 'v1', ext: 'mp4' }] })
})

test('buildZipEntries 按扩展名生成文件名并处理非法字符与重名', () => {
  const entries = buildZipEntries([
    { title: '图1 龙窑/余热', items: [{ assetId: 'x1', ext: 'png' }, { assetId: 'x2', ext: 'png' }] },
    { title: '片头', items: [{ assetId: 'v1', ext: 'mp4' }] },
    { title: '图1 龙窑_余热', items: [{ assetId: 'y1', ext: 'png' }] },
  ])
  assert.deepEqual(
    entries.map((e) => e.name),
    ['图1 龙窑_余热-1.png', '图1 龙窑_余热-2.png', '片头-1.mp4', '图1 龙窑_余热-1-2.png'],
  )
  assert.deepEqual(
    entries.map((e) => e.assetId),
    ['x1', 'x2', 'v1', 'y1'],
  )
})
