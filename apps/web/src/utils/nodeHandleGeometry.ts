export const NODE_HANDLE_OFFSET_FLOW = 22
export const NODE_HANDLE_ZONE_SIZE_FLOW = 88
export const NODE_HANDLE_ZONE_INSET_FLOW =
  -(NODE_HANDLE_ZONE_SIZE_FLOW / 2 + NODE_HANDLE_OFFSET_FLOW)

const MAGNET_RADIUS_FLOW = 42
const MAGNET_PULL_FLOW = 16

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getNodeHandleMagnetRadius(zoom: number): number {
  return clamp(MAGNET_RADIUS_FLOW * zoom, 32, 112)
}

export function getNodeHandleMagnetPull(zoom: number): number {
  return clamp(MAGNET_PULL_FLOW * zoom, 12, 36)
}
