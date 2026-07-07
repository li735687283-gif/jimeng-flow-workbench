import type { ImageModelOption } from './imageModels'
import type { VideoModelOption } from './videoModels'
import type { VideoAspectRatio, VideoNodeData, VideoResolution } from '@jimeng-flow/shared/videoNode'

export interface RememberedImageGenerationDefaults {
  model?: string
  quality?: string
  ratio?: string
  resolution?: string
  count?: number
}

export interface RememberedVideoGenerationDefaults {
  model?: string
  aspectRatio?: VideoAspectRatio
  resolution?: VideoResolution
  durationSeconds?: number
  count?: VideoNodeData['count']
}

export interface ImageDefaultsNodeData {
  model?: unknown
  quality?: unknown
  ratio?: unknown
  resolution?: unknown
  count?: unknown
}

export interface VideoDefaultsNodeData {
  model?: unknown
  aspectRatio?: unknown
  resolution?: unknown
  durationSeconds?: unknown
  count?: unknown
}

const IMAGE_FALLBACKS = {
  quality: '标准画质',
  ratio: '16:9',
  resolution: '2K',
  count: 1,
}

const VIDEO_FALLBACKS = {
  aspectRatio: '16:9' as VideoAspectRatio,
  resolution: '720P' as VideoResolution,
  durationSeconds: 5,
  count: 1 as VideoNodeData['count'],
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function modelInOptions(modelId: string, options: Array<{ id: string }>): string {
  return options.find((model) => model.id === modelId)?.id ?? ''
}

function videoCount(value: unknown): VideoNodeData['count'] | null {
  return value === 1 || value === 2 || value === 4 ? value : null
}

export function resolveImageGenerationDefaults({
  nodeData,
  remembered,
  modelOptions,
}: {
  nodeData: ImageDefaultsNodeData
  remembered: RememberedImageGenerationDefaults | null | undefined
  modelOptions: ImageModelOption[]
}): {
  modelId: string
  quality: string
  ratio: string
  resolution: string
  count: number
} {
  const nodeModel = modelInOptions(stringValue(nodeData.model), modelOptions)
  const rememberedModel = modelInOptions(remembered?.model ?? '', modelOptions)

  return {
    modelId: nodeModel || rememberedModel || modelOptions[0]?.id || '',
    quality:
      stringValue(nodeData.quality) ||
      stringValue(remembered?.quality) ||
      IMAGE_FALLBACKS.quality,
    ratio:
      stringValue(nodeData.ratio) ||
      stringValue(remembered?.ratio) ||
      IMAGE_FALLBACKS.ratio,
    resolution:
      stringValue(nodeData.resolution) ||
      stringValue(remembered?.resolution) ||
      IMAGE_FALLBACKS.resolution,
    count:
      numberValue(nodeData.count) ??
      numberValue(remembered?.count) ??
      IMAGE_FALLBACKS.count,
  }
}

export function resolveVideoGenerationDefaults({
  nodeData,
  remembered,
  modelOptions,
}: {
  nodeData: VideoDefaultsNodeData
  remembered: RememberedVideoGenerationDefaults | null | undefined
  modelOptions: VideoModelOption[]
}): {
  modelId: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  durationSeconds: number
  count: VideoNodeData['count']
} {
  const nodeModel = modelInOptions(stringValue(nodeData.model), modelOptions)
  const rememberedModel = modelInOptions(remembered?.model ?? '', modelOptions)

  return {
    modelId: nodeModel || rememberedModel || modelOptions[0]?.id || '',
    aspectRatio:
      (stringValue(nodeData.aspectRatio) as VideoAspectRatio) ||
      remembered?.aspectRatio ||
      VIDEO_FALLBACKS.aspectRatio,
    resolution:
      (stringValue(nodeData.resolution) as VideoResolution) ||
      remembered?.resolution ||
      VIDEO_FALLBACKS.resolution,
    durationSeconds:
      numberValue(nodeData.durationSeconds) ??
      numberValue(remembered?.durationSeconds) ??
      VIDEO_FALLBACKS.durationSeconds,
    count:
      videoCount(nodeData.count) ??
      videoCount(remembered?.count) ??
      VIDEO_FALLBACKS.count,
  }
}
