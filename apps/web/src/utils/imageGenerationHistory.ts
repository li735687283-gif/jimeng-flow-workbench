import type {
  GenerationRequest,
  GenerationResponse,
  ImageGenerationRun,
} from '@jimeng-flow/shared/generateNode'
import { normalizeImageGenerationRuns } from '@jimeng-flow/shared/generateNode'

export interface ImageGenerationRunOptions {
  quality?: string
  ratio?: string
  resolution?: string
  inputImageAssetIds?: string[]
}

export interface ImageGenerationEditorState {
  prompt: string
  modelId: string
  quality?: string
  ratio?: string
  resolution?: string
  count: number
  width: number
  height: number
  assetId?: string
  outputAssetIds: string[]
  inputImageAssetIds: string[]
}

export interface ImageGenerationHistoryItem {
  run: ImageGenerationRun
  assetId: string
}

const HISTORY_PREVIEW_SCALE = 2.8

export function buildImageGenerationRunFromResponse(
  response: GenerationResponse,
  request: GenerationRequest,
  options: ImageGenerationRunOptions = {},
): ImageGenerationRun {
  const assetIds =
    response.results
      ?.map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId) ?? []
  const run: ImageGenerationRun = {
    id: response.id,
    generationId: response.id,
    status: response.status,
    assetIds,
    prompt: request.prompt,
    model: request.model,
    width: request.width,
    height: request.height,
    count: request.count,
    seed: request.seed ?? null,
    inputImageAssetIds: options.inputImageAssetIds ?? request.inputImages ?? [],
    createdAt: response.createdAt,
    finishedAt: response.finishedAt,
  }
  if (options.quality) run.quality = options.quality
  if (options.ratio) run.ratio = options.ratio
  if (options.resolution) run.resolution = options.resolution
  if (response.error) run.error = response.error
  return run
}

export function getEditorStateFromImageGenerationRun(
  run: ImageGenerationRun,
): ImageGenerationEditorState {
  return {
    prompt: run.prompt,
    modelId: run.model,
    quality: run.quality,
    ratio: run.ratio,
    resolution: run.resolution,
    count: run.count,
    width: run.width,
    height: run.height,
    assetId: run.assetIds[0],
    outputAssetIds: run.assetIds,
    inputImageAssetIds: run.inputImageAssetIds,
  }
}

export function getImageGenerationHistoryItems(
  value: unknown,
): ImageGenerationHistoryItem[] {
  return normalizeImageGenerationRuns(value)
    .map((run) => ({ run, assetId: run.assetIds[0] }))
    .filter(
      (item): item is ImageGenerationHistoryItem =>
        typeof item.assetId === 'string' && item.assetId.length > 0,
    )
}

export function getImageGenerationHistoryPreviewScale(): number {
  return HISTORY_PREVIEW_SCALE
}
