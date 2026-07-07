import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type {
  VideoMediaReference,
  VideoGenerationRequest,
  VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import {
  buildVideoReferencesFromInputImages,
  normalizeVideoGenerationRuns,
  normalizeVideoReferences,
} from '@jimeng-flow/shared/videoNode'

export interface VideoGenerationEditorState {
  prompt: string
  model: string
  mode: VideoGenerationRun['mode']
  aspectRatio: VideoGenerationRun['aspectRatio']
  resolution: VideoGenerationRun['resolution']
  quality: VideoGenerationRun['quality']
  durationSeconds: number
  count: number
  generateAudio: boolean
  assetIds: string[]
  inputImageAssetIds: string[]
  references: VideoMediaReference[]
}

export interface VideoGenerationHistoryItem {
  run: VideoGenerationRun
  assetId: string
  assetIndex: number
}

const HISTORY_PREVIEW_SCALE = 2.8

export function buildVideoGenerationRunFromResponse(
  response: GenerationResponse,
  request: VideoGenerationRequest,
): VideoGenerationRun {
  const assetIds =
    response.results
      ?.map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId) ?? []

  const run: VideoGenerationRun = {
    id: response.id,
    generationId: response.id,
    status: response.status,
    assetIds,
    prompt: request.prompt,
    model: request.model,
    mode: request.mode,
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    quality: request.quality,
    durationSeconds: request.durationSeconds,
    count: request.count,
    generateAudio: request.generateAudio,
    inputImageAssetIds: request.inputImages ?? [],
    references: normalizeVideoReferences(request.references).length > 0
      ? normalizeVideoReferences(request.references)
      : buildVideoReferencesFromInputImages(request.mode, request.inputImages),
    createdAt: response.createdAt,
    finishedAt: response.finishedAt,
  }
  if (response.error) run.error = response.error
  return run
}

export function getEditorStateFromVideoGenerationRun(
  run: VideoGenerationRun,
): VideoGenerationEditorState {
  return {
    prompt: run.prompt,
    model: run.model,
    mode: run.mode,
    aspectRatio: run.aspectRatio,
    resolution: run.resolution,
    quality: run.quality,
    durationSeconds: run.durationSeconds,
    count: run.count,
    generateAudio: run.generateAudio,
    assetIds: run.assetIds,
    inputImageAssetIds: run.inputImageAssetIds,
    references: normalizeVideoReferences(run.references),
  }
}

export function getEditorStateFromVideoGenerationHistoryItem(
  item: VideoGenerationHistoryItem,
): VideoGenerationEditorState {
  const state = getEditorStateFromVideoGenerationRun(item.run)
  const selectedAssetId = item.assetId
  return {
    ...state,
    assetIds: [
      selectedAssetId,
      ...state.assetIds.filter((assetId) => assetId !== selectedAssetId),
    ],
  }
}

export function getVideoGenerationHistoryItems(
  value: unknown,
): VideoGenerationHistoryItem[] {
  return normalizeVideoGenerationRuns(value)
    .flatMap((run) =>
      run.assetIds
        .map((assetId, assetIndex) => ({ run, assetId, assetIndex }))
        .filter((item) => item.assetId.length > 0),
    )
}

export function getVideoGenerationHistoryPreviewScale(): number {
  return HISTORY_PREVIEW_SCALE
}
