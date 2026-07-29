import type { Node } from '@xyflow/react'

/**
 * 画框组（GroupFrame）：组是画布上的真实节点（type === 'groupFrame'），
 * 有自己的位置与宽高；成员节点 data.groupId 指向 frame 的 id。
 * 框的大小只由手柄改变，成员拖出框自动脱离、外部节点拖入框自动加入。
 */

export const GROUP_FRAME_TYPE = 'groupFrame'
export const GROUP_FRAME_PADDING = 40
export const DEFAULT_GROUP_COLOR = '#757575'

/** 组名标题反向缩放的上下限：最小 1 倍（不缩小）、最大 20 倍（= 1/画布最小 zoom 0.05，全缩放范围内组名屏幕尺寸恒定可读） */
export const GROUP_TITLE_MIN_ZOOM_FACTOR = 1
export const GROUP_TITLE_MAX_ZOOM_FACTOR = 20

/**
 * 组名随画布缩放的反向放大因子：zoom 变小时按 1/zoom 放大字号，
 * 保证画布缩得很小时仍能看清组名；上下限见 GROUP_TITLE_*_ZOOM_FACTOR。
 */
export function getGroupTitleZoomFactor(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return GROUP_TITLE_MIN_ZOOM_FACTOR
  return Math.min(
    Math.max(1 / zoom, GROUP_TITLE_MIN_ZOOM_FACTOR),
    GROUP_TITLE_MAX_ZOOM_FACTOR,
  )
}

// 组框颜色预设：遵循前端配色约定（中性色或已批准的语义强调色）
export const GROUP_COLOR_PRESETS = [
  { id: 'gray', color: '#757575', label: '雾灰' },
  { id: 'graphite', color: '#4a4a4a', label: '石墨' },
  { id: 'blue', color: '#4a9eff', label: '行动蓝' },
  { id: 'gold', color: '#f0b429', label: '精选金' },
  { id: 'red', color: '#ff5c5c', label: '警示红' },
] as const

export function isGroupFrame(node: Node | null | undefined): boolean {
  return node?.type === GROUP_FRAME_TYPE
}

export function getNodeGroupId(node: Node | null | undefined): string | null {
  if (!node || isGroupFrame(node)) return null
  const value = node.data?.groupId
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function getGroupColor(node: Node | null | undefined): string {
  const value = node?.data?.color
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_GROUP_COLOR
}

export function getGroupMembers(nodes: Node[], frameId: string): Node[] {
  return nodes.filter((n) => getNodeGroupId(n) === frameId)
}

export interface NodeSize {
  width: number
  height: number
}

export function getNodeSize(node: {
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
}): NodeSize {
  const width = node.measured?.width ?? node.width ?? 200
  const height = node.measured?.height ?? node.height ?? 150
  return { width, height }
}

export interface FlowBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function getNodesBounds(nodes: Node[]): FlowBounds | null {
  if (nodes.length === 0) return null
  const sizes = nodes.map(getNodeSize)
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))
  const maxX = Math.max(...nodes.map((n, i) => n.position.x + sizes[i].width))
  const maxY = Math.max(...nodes.map((n, i) => n.position.y + sizes[i].height))
  return { minX, minY, maxX, maxY }
}

/** 由选区生成画框节点：包围盒 + padding，尺寸存在节点 width/height 字段 */
export function createGroupFrame(nodes: Node[], selectedIds: string[]): Node | null {
  const members = nodes.filter((n) => selectedIds.includes(n.id) && !isGroupFrame(n))
  if (members.length < 2) return null
  const bounds = getNodesBounds(members)
  if (!bounds) return null
  // 自动命名：组 1、组 2……（按现有画框数量递增）
  const index = nodes.filter(isGroupFrame).length + 1
  return {
    id: `groupFrame-${crypto.randomUUID()}`,
    type: GROUP_FRAME_TYPE,
    position: {
      x: bounds.minX - GROUP_FRAME_PADDING,
      y: bounds.minY - GROUP_FRAME_PADDING,
    },
    width: bounds.maxX - bounds.minX + GROUP_FRAME_PADDING * 2,
    height: bounds.maxY - bounds.minY + GROUP_FRAME_PADDING * 2,
    data: { title: `组 ${index}`, status: 'idle', color: DEFAULT_GROUP_COLOR },
    zIndex: -1,
  } as Node
}

export interface FrameRect {
  x: number
  y: number
  width: number
  height: number
}

export function getFrameRect(frame: Node): FrameRect {
  const size = getNodeSize(frame)
  return { x: frame.position.x, y: frame.position.y, width: size.width, height: size.height }
}

function getNodeCenter(node: Node): { x: number; y: number } {
  const size = getNodeSize(node)
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 }
}

function pointInRect(point: { x: number; y: number }, rect: FrameRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export interface MembershipChange {
  id: string
  groupId: string | null
}

/**
 * 拖拽结束后的归属判定（中心点为准）：
 * - 组成员中心点被拖出所属 frame → 脱离（groupId: null）
 * - 无组节点中心点进入某 frame → 加入（groupId: frame.id）
 * 无变更返回 null。
 */
export function reconcileGroupMembership(
  nodes: Node[],
  draggedNodeId: string,
): MembershipChange | null {
  const node = nodes.find((n) => n.id === draggedNodeId)
  if (!node || isGroupFrame(node)) return null
  const center = getNodeCenter(node)
  const frames = nodes.filter(isGroupFrame)
  const currentGroupId = getNodeGroupId(node)

  if (currentGroupId) {
    const frame = frames.find((f) => f.id === currentGroupId)
    if (frame && !pointInRect(center, getFrameRect(frame))) {
      return { id: node.id, groupId: null }
    }
    return null
  }

  const target = frames.find((f) => pointInRect(center, getFrameRect(f)))
  if (target) return { id: node.id, groupId: target.id }
  return null
}

/**
 * 旧数据迁移：存在 groupId 标记但没有对应 frame 节点时，按成员包围盒补建。
 * 幂等：已有 frame 的组不会产生重复 frame。
 */
export function buildMissingGroupFrames(nodes: Node[]): Node[] {
  const frameIds = new Set(nodes.filter(isGroupFrame).map((f) => f.id))
  const orphanGroupIds = new Set<string>()
  for (const node of nodes) {
    const groupId = getNodeGroupId(node)
    if (groupId && !frameIds.has(groupId)) orphanGroupIds.add(groupId)
  }
  if (orphanGroupIds.size === 0) return []
  const created: Node[] = []
  for (const groupId of orphanGroupIds) {
    const memberIds = getGroupMembers(nodes, groupId).map((n) => n.id)
    // createGroupFrame 会生成新 id，需要把成员指过去——这里直接手工构造保持原 id
    const members = nodes.filter((n) => memberIds.includes(n.id))
    const bounds = getNodesBounds(members)
    if (!bounds) continue
    created.push({
      id: groupId,
      type: GROUP_FRAME_TYPE,
      position: {
        x: bounds.minX - GROUP_FRAME_PADDING,
        y: bounds.minY - GROUP_FRAME_PADDING,
      },
      width: bounds.maxX - bounds.minX + GROUP_FRAME_PADDING * 2,
      height: bounds.maxY - bounds.minY + GROUP_FRAME_PADDING * 2,
      data: { title: '组', status: 'idle', color: DEFAULT_GROUP_COLOR },
      zIndex: -1,
    } as Node)
  }
  return created
}

/**
 * 选区是否恰好覆盖某 frame 的全部成员（用于工具栏“解组”状态）。
 */
export function getCompleteGroupId(nodes: Node[], selectedIds: string[]): string | null {
  if (selectedIds.length < 2) return null
  const frames = nodes.filter(isGroupFrame)
  for (const frame of frames) {
    const members = getGroupMembers(nodes, frame.id)
    if (members.length < 2) continue
    const memberIds = new Set(members.map((n) => n.id))
    const selected = new Set(selectedIds)
    const allMembersSelected = [...memberIds].every((id) => selected.has(id))
    const onlyMembers = [...selected].every((id) => memberIds.has(id))
    if (allMembersSelected && onlyMembers) return frame.id
  }
  return null
}
