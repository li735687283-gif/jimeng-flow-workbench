import type {
  VideoMode,
  VideoGenerationRequest,
  VideoGenerationRun,
  VideoNodeData,
} from '@jimeng-flow/shared/videoNode'
import {
  appendVideoGenerationRun,
  buildVideoReferencesFromInputImages,
  normalizeVideoReferences,
} from '@jimeng-flow/shared/videoNode'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import { buildVideoGenerationRunFromResponse } from './videoGenerationHistory'

function normalizeVideoCount(count: number): VideoNodeData['count'] {
  return count === 2 || count === 4 ? count : 1
}

export function resolveVideoInputImages(
  storedInputImages: string[] | undefined,
  upstreamInputImages: string[] | undefined,
  options: { preferUpstream?: boolean } = {},
): string[] {
  const inputImages: string[] = []
  const seen = new Set<string>()
  const pushUnique = (value: unknown) => {
    const image = typeof value === 'string' ? value.trim() : ''
    if (!image || seen.has(image)) return
    seen.add(image)
    inputImages.push(image)
  }

  if (options.preferUpstream) {
    for (const image of upstreamInputImages ?? []) pushUnique(image)
    if (inputImages.length > 0) return inputImages
  }
  for (const image of storedInputImages ?? []) pushUnique(image)
  for (const image of upstreamInputImages ?? []) pushUnique(image)
  return inputImages
}

export function resolveVideoModeForInputImages(
  mode: VideoMode,
  inputImages: string[] | undefined,
): VideoMode {
  if (mode !== 'text_to_video') return mode
  const inputCount = (inputImages ?? []).filter(Boolean).length
  if (inputCount >= 2) return 'first_last_frame'
  if (inputCount === 1) return 'image_to_video'
  return 'text_to_video'
}

export function buildVideoRunningNodePatch(
  request: VideoGenerationRequest,
  currentData: Partial<VideoNodeData>,
  updatedAt = new Date().toISOString(),
): Partial<VideoNodeData> {
  const references = normalizeVideoReferences(request.references)
  return {
    status: 'running',
    error: undefined,
    assetIds: currentData.assetIds ?? [],
    generationRuns: currentData.generationRuns,
    prompt: request.prompt,
    model: request.model,
    inputImageAssetIds: request.inputImages,
    references:
      references.length > 0
        ? references
        : buildVideoReferencesFromInputImages(request.mode, request.inputImages),
    mode: request.mode,
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    quality: request.quality,
    durationSeconds: request.durationSeconds,
    count: normalizeVideoCount(request.count),
    generateAudio: request.generateAudio,
    updatedAt,
  }
}

export function buildVideoCompletionNodePatch(
  response: GenerationResponse,
  request: VideoGenerationRequest,
  currentData: Pick<Partial<VideoNodeData>, 'assetIds' | 'generationRuns'>,
  updatedAt = new Date().toISOString(),
): {
  status: GenerationResponse['status']
  error: GenerationResponse['error']
  assetIds: string[]
  generationId: string
  generationRuns: VideoGenerationRun[]
  updatedAt: string
} {
  const nextAssetIds =
    response.results
      ?.map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId) ?? []
  const previousAssetIds = currentData.assetIds ?? []
  if (response.status !== 'success' && response.status !== 'error') {
    return {
      status: response.status,
      error: response.error,
      assetIds: previousAssetIds,
      generationId: response.id,
      generationRuns: currentData.generationRuns ?? [],
      updatedAt,
    }
  }

  const generationRun = buildVideoGenerationRunFromResponse(response, request)

  return {
    status: response.status,
    error: response.error,
    assetIds: nextAssetIds.length > 0 ? nextAssetIds : previousAssetIds,
    generationId: response.id,
    generationRuns: appendVideoGenerationRun(
      currentData.generationRuns,
      generationRun,
    ),
    updatedAt,
  }
}

export function getVideoSubmitLabel(
  running: boolean,
  hasCurrentVideo: boolean,
): string {
  if (running) return '生成中'
  return hasCurrentVideo ? '再抽一次' : '生成'
}
