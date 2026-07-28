import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import {
  buildMissingGroupFrames,
  createGroupFrame,
  getCompleteGroupId,
  GROUP_FRAME_PADDING,
  GROUP_FRAME_TYPE,
  reconcileGroupMembership,
} from '../src/utils/nodeGroup'
import { useCanvasStore } from '../src/state/canvasStore'

// getNodeSize 无 measured 时回退 200x150
function makeNode(id: string, x = 0, y = 0, groupId?: string): Node {
  return {
    id,
    type: 'image',
    position: { x, y },
    data: groupId ? { groupId } : {},
  } as Node
}

function makeFrame(id: string, x = -40, y = -40, w = 880, h = 630): Node {
  return {
    id,
    type: GROUP_FRAME_TYPE,
    position: { x, y },
    width: w,
    height: h,
    data: {},
  } as Node
}

test('createGroupFrame 按选区包围盒加 padding 生成画框，忽略画框自身', () => {
  const nodes = [makeNode('a', 100, 100), makeNode('b', 500, 400)]
  const frame = createGroupFrame(nodes, ['a', 'b'])
  assert.ok(frame)
  assert.equal(frame.type, GROUP_FRAME_TYPE)
  // bbox: x100..700, y100..550 → 加 40 padding
  assert.deepEqual(frame.position, { x: 100 - GROUP_FRAME_PADDING, y: 100 - GROUP_FRAME_PADDING })
  assert.equal(frame.width, 600 + GROUP_FRAME_PADDING * 2)
  assert.equal(frame.height, 450 + GROUP_FRAME_PADDING * 2)
  assert.equal(frame.zIndex, -1)
  // 少于 2 个普通节点不建框
  assert.equal(createGroupFrame(nodes, ['a']), null)
  assert.equal(createGroupFrame([...nodes, makeFrame('f')], ['a', 'f']), null)
})

test('createGroupFrame 按现有画框数量自动命名', () => {
  const nodes = [makeNode('a', 0, 0), makeNode('b', 400, 0)]
  const first = createGroupFrame(nodes, ['a', 'b'])!
  assert.equal(first.data.title, '组 1')
  const second = createGroupFrame([...nodes, first], ['a', 'b'])!
  assert.equal(second.data.title, '组 2')
})

test('reconcileGroupMembership 成员拖出框脱离、外部节点拖入框加入', () => {
  const frame = makeFrame('f1', 0, 0, 400, 300)
  // 成员中心在框内：无变更
  const inside = [frame, makeNode('a', 50, 50, 'f1')]
  assert.equal(reconcileGroupMembership(inside, 'a'), null)
  // 成员中心拖出框：脱离
  const outside = [frame, makeNode('a', 800, 50, 'f1')]
  assert.deepEqual(reconcileGroupMembership(outside, 'a'), { id: 'a', groupId: null })
  // 无组节点中心入框：加入
  const stranger = [frame, makeNode('b', 100, 100)]
  assert.deepEqual(reconcileGroupMembership(stranger, 'b'), { id: 'b', groupId: 'f1' })
  // 无组节点在框外：无变更
  const far = [frame, makeNode('c', 900, 900)]
  assert.equal(reconcileGroupMembership(far, 'c'), null)
  // 拖动画框自身不判定
  assert.equal(reconcileGroupMembership(inside, 'f1'), null)
})

test('buildMissingGroupFrames 为旧 groupId 数据补建画框且幂等', () => {
  const nodes = [makeNode('a', 0, 0, 'group_old'), makeNode('b', 400, 0, 'group_old'), makeNode('c')]
  const created = buildMissingGroupFrames(nodes)
  assert.equal(created.length, 1)
  assert.equal(created[0].id, 'group_old')
  assert.equal(created[0].type, GROUP_FRAME_TYPE)
  // 已有 frame 的组不再补建
  assert.equal(buildMissingGroupFrames([...nodes, ...created]).length, 0)
})

test('getCompleteGroupId 选区恰好为某画框全部成员时返回 frame id', () => {
  const frame = makeFrame('f1')
  const nodes = [frame, makeNode('a', 0, 0, 'f1'), makeNode('b', 400, 0, 'f1'), makeNode('c', 900, 900)]
  assert.equal(getCompleteGroupId(nodes, ['a', 'b']), 'f1')
  assert.equal(getCompleteGroupId(nodes, ['a', 'b', 'c']), null)
  assert.equal(getCompleteGroupId(nodes, ['a']), null)
})

test('canvasStore 打组创建画框并写入 groupId，解组删除画框并清除', () => {
  useCanvasStore.setState({ nodes: [], edges: [] })
  const store = useCanvasStore.getState()
  const a = store.addNode('image', { x: 0, y: 0 })
  const b = store.addNode('image', { x: 400, y: 0 })

  useCanvasStore.getState().groupNodes([a, b])
  let nodes = useCanvasStore.getState().nodes
  const frame = nodes.find((n) => n.type === GROUP_FRAME_TYPE)
  assert.ok(frame)
  assert.equal(nodes.find((n) => n.id === a)?.data.groupId, frame.id)
  assert.equal(nodes.find((n) => n.id === b)?.data.groupId, frame.id)

  useCanvasStore.getState().ungroupNodes([a, b])
  nodes = useCanvasStore.getState().nodes
  assert.equal(nodes.some((n) => n.type === GROUP_FRAME_TYPE), false)
  assert.equal(nodes.find((n) => n.id === a)?.data.groupId, undefined)
  assert.equal(nodes.find((n) => n.id === b)?.data.groupId, undefined)
})

test('canvasStore 排列时忽略画框节点', () => {
  useCanvasStore.setState({ nodes: [], edges: [] })
  const store = useCanvasStore.getState()
  const a = store.addNode('image', { x: 0, y: 0 })
  const b = store.addNode('image', { x: 500, y: 300 })
  useCanvasStore.getState().groupNodes([a, b])
  const frame = useCanvasStore.getState().nodes.find((n) => n.type === GROUP_FRAME_TYPE)!
  const framePos = { ...frame.position }

  useCanvasStore.getState().arrangeGrid([a, b, frame.id])
  const after = useCanvasStore.getState().nodes.find((n) => n.id === frame.id)!
  assert.deepEqual(after.position, framePos)
})
