import type { AgentSuggestedParams } from '@jimeng-flow/shared/agentMessage'
import { IMAGE_COUNTS } from '@jimeng-flow/shared/generateNode'
import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_COUNTS,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_RESOLUTIONS,
  type VideoAspectRatio,
  type VideoMode,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'

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

export interface AgentImageGenerationParams {
  model: string
  aspectRatio: AgentImageAspectRatio
  resolution: AgentImageResolution
  count: number
}

export interface AgentVideoGenerationParams {
  model: string
  mode: VideoMode
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  durationSeconds: number
  count: number
  quality: 'standard' | 'high'
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nearestNumber(value: unknown, options: readonly number[], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  fallback)
}

function closestImageAspectRatio(width: unknown, height: unknown): AgentImageAspectRatio | null {
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return null
  }
  const ratio = width / height
  return AGENT_IMAGE_ASPECT_RATIOS.reduce((best, option) => {
    const [w, h] = option.split(':').map(Number)
    const [bestW, bestH] = best.split(':').map(Number)
    return Math.abs(w / h - ratio) < Math.abs(bestW / bestH - ratio) ? option : best
  }, '1:1' as AgentImageAspectRatio)
}

function suggestedImageResolution(params: AgentSuggestedParams): AgentImageResolution | null {
  const value = stringValue(params.resolution).toUpperCase()
  if (AGENT_IMAGE_RESOLUTIONS.includes(value as AgentImageResolution)) {
    return value as AgentImageResolution
  }
  const maxSide = Math.max(
    typeof params.width === 'number' ? params.width : 0,
    typeof params.height === 'number' ? params.height : 0,
  )
  if (maxSide >= 3000) return '4K'
  if (maxSide > 0 && maxSide <= 1024) return '1K'
  if (maxSide > 0) return '2K'
  return null
}

export function getAgentImageResolutionOptions(model: string): AgentImageResolution[] {
  if (model === 'jimeng-5.0-pro') return [...AGENT_IMAGE_RESOLUTIONS]
  if (model.startsWith('jimeng')) return ['2K', '4K']
  return ['1K', '2K']
}

export function resolveAgentImageGenerationParams(
  current: AgentImageGenerationParams,
  suggested: AgentSuggestedParams | undefined,
  availableModels: readonly string[],
): AgentImageGenerationParams {
  const params = suggested ?? {}
  const suggestedModel = stringValue(params.model)
  const model = availableModels.includes(suggestedModel)
    ? suggestedModel
    : current.model
  const suggestedRatio = stringValue(params.aspectRatio)
  const aspectRatio = AGENT_IMAGE_ASPECT_RATIOS.includes(
    suggestedRatio as AgentImageAspectRatio,
  )
    ? suggestedRatio as AgentImageAspectRatio
    : closestImageAspectRatio(params.width, params.height) ?? current.aspectRatio
  const resolutionOptions = getAgentImageResolutionOptions(model)
  const requestedResolution = suggestedImageResolution(params) ?? current.resolution
  const resolution = resolutionOptions.includes(requestedResolution)
    ? requestedResolution
    : resolutionOptions.includes(current.resolution)
      ? current.resolution
      : resolutionOptions[0]

  return {
    model,
    aspectRatio,
    resolution,
    count: nearestNumber(params.count, IMAGE_COUNTS, current.count),
  }
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

export function resolveAgentVideoGenerationParams(
  current: AgentVideoGenerationParams,
  suggested: AgentSuggestedParams | undefined,
  availableModels: readonly string[],
): AgentVideoGenerationParams {
  const params = suggested ?? {}
  const modelValue = stringValue(params.model)
  const modeValue = stringValue(params.mode)
  const aspectRatioValue = stringValue(params.aspectRatio)
  const resolutionValue = stringValue(params.resolution).toUpperCase()
  const qualityValue = stringValue(params.quality)

  return {
    model: availableModels.includes(modelValue) ? modelValue : current.model,
    mode: VIDEO_MODES.some((option) => option.id === modeValue)
      ? modeValue as VideoMode
      : current.mode,
    aspectRatio: VIDEO_ASPECT_RATIOS.includes(aspectRatioValue as VideoAspectRatio)
      ? aspectRatioValue as VideoAspectRatio
      : current.aspectRatio,
    resolution: VIDEO_RESOLUTIONS.includes(resolutionValue as VideoResolution)
      ? resolutionValue as VideoResolution
      : current.resolution,
    durationSeconds: nearestNumber(
      params.durationSeconds,
      VIDEO_DURATIONS,
      current.durationSeconds,
    ),
    count: nearestNumber(params.count, VIDEO_COUNTS, current.count),
    quality: qualityValue === 'high' || qualityValue === 'standard'
      ? qualityValue
      : current.quality,
  }
}
