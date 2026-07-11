import { Position, type Node } from '@xyflow/react'

const FALLBACK_NODE_WIDTH = 200
const FALLBACK_NODE_HEIGHT = 150

function getNodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT,
  }
}

export function getCardEdgePoint(
  node: Node | undefined,
  fallback: { x: number; y: number },
  position: Position,
): { x: number; y: number } {
  if (!node) return fallback

  const { width, height } = getNodeSize(node)
  const left = node.position.x
  const right = node.position.x + width
  const top = node.position.y
  const bottom = node.position.y + height

  if (position === Position.Left || position === Position.Right) {
    return {
      x: position === Position.Left ? left : right,
      y: top + height / 2,
    }
  }

  return {
    x: Math.min(right, Math.max(left, fallback.x)),
    y: position === Position.Top ? top : bottom,
  }
}
