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

export function getAgentImageResolutionOptions(model: string): AgentImageResolution[] {
  if (model === 'jimeng-5.0-pro') return [...AGENT_IMAGE_RESOLUTIONS]
  if (model.startsWith('jimeng')) return ['2K', '4K']
  return ['1K', '2K']
}

function roundToMultipleOfEight(value: number): number {
  return Math.max(8, Math.round(value / 8) * 8)
}

export function getAgentImageDimensions(
  aspectRatio: AgentImageAspectRatio,
  resolution: AgentImageResolution,
): { width: number; height: number } {
  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number)
  const longSide = resolution === '4K' ? 4096 : resolution === '2K' ? 2048 : 1024
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
