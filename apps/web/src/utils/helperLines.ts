import type { Node, XYPosition } from '@xyflow/react'

/**
 * 卡片对齐辅助线：拖动某张卡靠近其它卡时，
 * 在对齐的边缘（上/中/下、左/中/右）画出虚线并吸附。
 * 参考：Jimeng 等产品里「拿着卡片和别人对齐」的行为。
 */
export interface HelperLinesState {
  /** 垂直虚线 x 列表（flow 坐标） */
  verticals: number[]
  /** 水平虚线 y 列表（flow 坐标） */
  horizontals: number[]
}

export interface HelperLinesSnapResult extends HelperLinesState {
  position: XYPosition
  snapped: boolean
}

interface NodeBox {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
  x: number
  y: number
}

const FALLBACK_WIDTH = 200
const FALLBACK_HEIGHT = 150

/** 默认吸附阈值（flow 坐标，会按缩放再校正） */
export const HELPER_LINE_SNAP_THRESHOLD = 8

export function getNodeBox(node: Node): NodeBox {
  const width =
    node.measured?.width ??
    (typeof node.width === 'number' ? node.width : undefined) ??
    FALLBACK_WIDTH
  const height =
    node.measured?.height ??
    (typeof node.height === 'number' ? node.height : undefined) ??
    FALLBACK_HEIGHT
  const x = node.position.x
  const y = node.position.y
  return {
    id: node.id,
    x,
    y,
    width,
    height,
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  }
}

function uniqueSorted(values: number[], epsilon = 0.5): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const value of sorted) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - value) > epsilon) {
      out.push(value)
    }
  }
  return out
}

/**
 * 拖动节点与其它节点做边对齐吸附，并返回所有当前对齐的辅助线。
 * 等高卡片顶对齐时，中线、底边也会一起画出来（与参考截图一致）。
 */
export function computeHelperLines(
  dragged: Node,
  nodes: Node[],
  threshold = HELPER_LINE_SNAP_THRESHOLD,
): HelperLinesSnapResult {
  const drag = getNodeBox(dragged)
  let snapX = drag.x
  let snapY = drag.y
  let bestVDist = threshold
  let bestHDist = threshold

  for (const node of nodes) {
    if (node.id === dragged.id) continue
    // 多选拖动时其它选中节点一起动，不作为对齐参考
    if (node.selected && dragged.selected) continue

    const other = getNodeBox(node)

    const verticalCandidates: Array<{ dist: number; x: number }> = [
      { dist: Math.abs(drag.left - other.left), x: other.left },
      { dist: Math.abs(drag.left - other.centerX), x: other.centerX },
      { dist: Math.abs(drag.left - other.right), x: other.right },
      {
        dist: Math.abs(drag.centerX - other.left),
        x: other.left - drag.width / 2,
      },
      {
        dist: Math.abs(drag.centerX - other.centerX),
        x: other.centerX - drag.width / 2,
      },
      {
        dist: Math.abs(drag.centerX - other.right),
        x: other.right - drag.width / 2,
      },
      {
        dist: Math.abs(drag.right - other.left),
        x: other.left - drag.width,
      },
      {
        dist: Math.abs(drag.right - other.centerX),
        x: other.centerX - drag.width,
      },
      {
        dist: Math.abs(drag.right - other.right),
        x: other.right - drag.width,
      },
    ]

    for (const candidate of verticalCandidates) {
      if (candidate.dist < bestVDist) {
        bestVDist = candidate.dist
        snapX = candidate.x
      }
    }

    const horizontalCandidates: Array<{ dist: number; y: number }> = [
      { dist: Math.abs(drag.top - other.top), y: other.top },
      { dist: Math.abs(drag.top - other.centerY), y: other.centerY },
      { dist: Math.abs(drag.top - other.bottom), y: other.bottom },
      {
        dist: Math.abs(drag.centerY - other.top),
        y: other.top - drag.height / 2,
      },
      {
        dist: Math.abs(drag.centerY - other.centerY),
        y: other.centerY - drag.height / 2,
      },
      {
        dist: Math.abs(drag.centerY - other.bottom),
        y: other.bottom - drag.height / 2,
      },
      {
        dist: Math.abs(drag.bottom - other.top),
        y: other.top - drag.height,
      },
      {
        dist: Math.abs(drag.bottom - other.centerY),
        y: other.centerY - drag.height,
      },
      {
        dist: Math.abs(drag.bottom - other.bottom),
        y: other.bottom - drag.height,
      },
    ]

    for (const candidate of horizontalCandidates) {
      if (candidate.dist < bestHDist) {
        bestHDist = candidate.dist
        snapY = candidate.y
      }
    }
  }

  const snapped = snapX !== drag.x || snapY !== drag.y
  const finalBox: NodeBox = {
    ...drag,
    x: snapX,
    y: snapY,
    left: snapX,
    right: snapX + drag.width,
    top: snapY,
    bottom: snapY + drag.height,
    centerX: snapX + drag.width / 2,
    centerY: snapY + drag.height / 2,
  }

  // 吸附后收集所有已对齐的边（阈值稍松一点，保证顶对齐时中/底也画出来）
  const lineEpsilon = Math.max(1, threshold * 0.35)
  const verticals: number[] = []
  const horizontals: number[] = []

  for (const node of nodes) {
    if (node.id === dragged.id) continue
    if (node.selected && dragged.selected) continue
    const other = getNodeBox(node)

    const vEdges = [
      finalBox.left,
      finalBox.centerX,
      finalBox.right,
    ] as const
    const oVEdges = [other.left, other.centerX, other.right] as const
    for (const a of vEdges) {
      for (const b of oVEdges) {
        if (Math.abs(a - b) <= lineEpsilon) verticals.push(b)
      }
    }

    const hEdges = [
      finalBox.top,
      finalBox.centerY,
      finalBox.bottom,
    ] as const
    const oHEdges = [other.top, other.centerY, other.bottom] as const
    for (const a of hEdges) {
      for (const b of oHEdges) {
        if (Math.abs(a - b) <= lineEpsilon) horizontals.push(b)
      }
    }
  }

  return {
    position: { x: snapX, y: snapY },
    snapped,
    verticals: uniqueSorted(verticals),
    horizontals: uniqueSorted(horizontals),
  }
}

/** 按视口缩放校正吸附阈值（屏幕约 8–10px） */
export function getSnapThreshold(zoom: number): number {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return Math.max(5, 10 / z)
}
