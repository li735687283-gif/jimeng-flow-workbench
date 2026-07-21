// Agent 图片生成的尺寸换算工具：比例 + 清晰度 → 具体像素尺寸。

export const AGENT_IMAGE_ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
] as const

export const AGENT_IMAGE_RESOLUTIONS = ['1K', '2K', '4K'] as const

export type AgentImageAspectRatio = (typeof AGENT_IMAGE_ASPECT_RATIOS)[number]
export type AgentImageResolution = (typeof AGENT_IMAGE_RESOLUTIONS)[number]

/** 与服务端 isCodexImageModel 对齐：走 Codex CLI（gpt-image-2）的图片模型 */
function isOpenAiCliImageModelId(model: string): boolean {
  const id = model.trim().toLowerCase()
  return id === '$imagegen' || id === 'gpt-image-2' || id.startsWith('codex:')
}

export function getAgentImageResolutionOptions(model: string): AgentImageResolution[] {
  if (model === 'jimeng-5.0-pro') return [...AGENT_IMAGE_RESOLUTIONS]
  if (model.startsWith('jimeng')) return ['2K', '4K']
  // gpt-image-2 支持 2K/4K（服务端会把长边规范化到 ≤3840）
  if (isOpenAiCliImageModelId(model)) return [...AGENT_IMAGE_RESOLUTIONS]
  // 其余第三方兼容接口只认固定三档尺寸，清晰度不生效，不开放 4K
  return ['1K', '2K']
}

function roundToMultipleOfEight(value: number): number {
  return Math.max(8, Math.round(value / 8) * 8)
}

/** 清晰度档位 = 长边像素数，全应用（Agent 与画布图片节点）共用这一套 */
export const IMAGE_RESOLUTION_LONG_SIDES: Record<AgentImageResolution, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
}

/**
 * 比例 + 清晰度 → 具体像素尺寸。比例支持任意 "W:H"，
 * 无法解析时（如「自适应」）按方形处理；短边对齐到 8 的倍数。
 */
export function getImageDimensionsByRatio(
  ratio: string,
  resolution: AgentImageResolution,
): { width: number; height: number } {
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  const longSide = IMAGE_RESOLUTION_LONG_SIDES[resolution]
  if (!ratioWidth || !ratioHeight) {
    return { width: longSide, height: longSide }
  }
  if (ratioWidth >= ratioHeight) {
    return {
      width: longSide,
      height: roundToMultipleOfEight(longSide * ratioHeight / ratioWidth),
    }
  }
  return {
    width: roundToMultipleOfEight(longSide * ratioWidth / ratioHeight),
    height: longSide,
  }
}

export function getAgentImageDimensions(
  aspectRatio: AgentImageAspectRatio,
  resolution: AgentImageResolution,
): { width: number; height: number } {
  return getImageDimensionsByRatio(aspectRatio, resolution)
}
