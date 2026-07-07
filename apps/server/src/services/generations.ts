// 即梦 Flow 后端 - Generations service
// 生成任务编排：状态机（idle → queued → running → success/error）、
// 调用 jimeng client、下载图片/视频、保存为 Asset、写入同名 metadata。
// 参考 PRD 8.3（生成任务）、8.4（视频生成任务）、8.5（本地文件管理）、9.3（数据流）、10.3、11.2（Asset）、12.2（错误处理）。
//
// 目录约定（与 assets.ts 保持一致）：
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.<ext>   媒体本体
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.json   元数据（由 saveUploadFile 写入）

import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type {
  GenerationRequest,
  GenerationResponse,
  GenerationResult,
  GenerationStatus,
  ImageGenerationRun,
} from '@jimeng-flow/shared/generateNode'
import type { Flow, FlowNode } from '@jimeng-flow/shared/flow'
import {
  appendImageGenerationRun,
  isJimengImageModel,
} from '@jimeng-flow/shared/generateNode'
import type {
  VideoMediaReference,
  VideoGenerationRequest,
  VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import type {
  ModelCapability,
  Settings,
} from '@jimeng-flow/shared/settings'
import { getModelConfigsByCapability } from '@jimeng-flow/shared/settings'
import {
  appendVideoGenerationRun,
  buildVideoReferencesFromInputImages,
  isJimengVideoModel,
  normalizeVideoReferences,
} from '@jimeng-flow/shared/videoNode'
import { generateImage, generateVideo, JimengError } from './jimeng'
import { generateOpenAiCompatibleImage } from './openaiImage'
import { generateOpenAiCompatibleVideo } from './openaiVideo'
import { generateCodexCliImage, isCodexImageModel } from './codexImage'
import { saveUploadFile } from './assets'
import { getFlow, updateFlow } from './flows'
import { getSettings } from './settings'

/** 生成任务 ID：gen_<timestamp>_<random> */
function makeGenerationId(): string {
  const ts = Date.now()
  const rand = randomBytes(4).toString('hex')
  return `gen_${ts}_${rand}`
}

/** 生成任务状态监听器 */
export type GenerationStatusListener = (status: GenerationStatus, record: GenerationRecord) => void

/** 内存中的生成任务记录（M0 阶段不持久化，进程重启后丢失） */
export interface GenerationRecord {
  id: string
  nodeId: string
  status: GenerationStatus
  error?: string
  results?: GenerationResult[]
  request: GenerationRequest | VideoGenerationRequest
  createdAt: string
  finishedAt?: string
}

/** 任务存储（M0 内存实现，单进程足够） */
const store = new Map<string, GenerationRecord>()

interface ImageGenerationFlowPatch {
  nodeId: string
  generationId: string
  prompt: string
  model: string
  width: number
  height: number
  count: number
  seed?: number | null
  inputImageAssetIds?: string[]
  quality?: string
  ratio?: string
  resolution?: string
  assetIds: string[]
  status: GenerationStatus
  error?: string
  createdAt?: string
  updatedAt: string
}

interface VideoGenerationFlowPatch {
  nodeId: string
  generationId: string
  prompt: string
  model: string
  mode: VideoGenerationRequest['mode']
  aspectRatio: VideoGenerationRequest['aspectRatio']
  resolution: VideoGenerationRequest['resolution']
  quality: VideoGenerationRequest['quality']
  durationSeconds: number
  count: number
  generateAudio: boolean
  inputImageAssetIds?: string[]
  references?: VideoMediaReference[]
  assetIds: string[]
  status: GenerationStatus
  error?: string
  createdAt?: string
  updatedAt: string
}

function buildImageGenerationRun(
  patch: ImageGenerationFlowPatch,
): ImageGenerationRun {
  const generationRun: ImageGenerationRun = {
    id: patch.generationId,
    generationId: patch.generationId,
    status: patch.status,
    assetIds: patch.assetIds,
    prompt: patch.prompt,
    model: patch.model,
    width: patch.width,
    height: patch.height,
    count: patch.count,
    seed: patch.seed ?? null,
    inputImageAssetIds: patch.inputImageAssetIds ?? [],
    createdAt: patch.createdAt ?? patch.updatedAt,
    finishedAt: patch.updatedAt,
  }
  if (patch.quality) generationRun.quality = patch.quality
  if (patch.ratio) generationRun.ratio = patch.ratio
  if (patch.resolution) generationRun.resolution = patch.resolution
  if (patch.error) generationRun.error = patch.error
  return generationRun
}

function applyImageGenerationPatchToNode(
  node: FlowNode,
  patch: ImageGenerationFlowPatch,
): FlowNode {
  const generationRun = buildImageGenerationRun(patch)
  return {
    ...node,
    data: {
      ...node.data,
      status: patch.status,
      error: patch.error,
      outputAssetIds: patch.assetIds,
      assetId: patch.assetIds[0] ?? node.data.assetId,
      generationId: patch.generationId,
      prompt: patch.prompt,
      model: patch.model,
      width: patch.width,
      height: patch.height,
      count: patch.count,
      seed: patch.seed ?? null,
      inputImageAssetIds: patch.inputImageAssetIds ?? [],
      quality: patch.quality ?? node.data.quality,
      ratio: patch.ratio ?? node.data.ratio,
      resolution: patch.resolution ?? node.data.resolution,
      generationRuns: appendImageGenerationRun(
        node.data.generationRuns,
        generationRun,
      ),
      updatedAt: patch.updatedAt,
    },
  }
}

function createRecoveredImageNode(flow: Flow, patch: ImageGenerationFlowPatch): FlowNode {
  const maxX = flow.nodes.reduce(
    (value, node) => Math.max(value, node.position?.x ?? 0),
    0,
  )
  const imageNodeCount = flow.nodes.filter((node) => node.type === 'image').length
  return applyImageGenerationPatchToNode(
    {
      id: patch.nodeId,
      type: 'image',
      position: {
        x: maxX + 420,
        y: 160,
      },
      data: {
        title: `图片节点 ${imageNodeCount + 1}`,
        status: 'idle',
      },
    },
    patch,
  )
}

export function applyImageGenerationResultToFlow(
  flow: Flow,
  patch: ImageGenerationFlowPatch,
): Flow {
  let matched = false
  const nodes = flow.nodes.map((node) => {
    if (node.id !== patch.nodeId) return node
    matched = true
    return applyImageGenerationPatchToNode(node, patch)
  })

  if (matched) return { ...flow, nodes }
  return {
    ...flow,
    nodes: [...nodes, createRecoveredImageNode(flow, patch)],
  }
}

function buildVideoGenerationRun(
  patch: VideoGenerationFlowPatch,
): VideoGenerationRun {
  const generationRun: VideoGenerationRun = {
    id: patch.generationId,
    generationId: patch.generationId,
    status: patch.status,
    assetIds: patch.assetIds,
    prompt: patch.prompt,
    model: patch.model,
    mode: patch.mode,
    aspectRatio: patch.aspectRatio,
    resolution: patch.resolution,
    quality: patch.quality,
    durationSeconds: patch.durationSeconds,
    count: patch.count,
    generateAudio: patch.generateAudio,
    inputImageAssetIds: patch.inputImageAssetIds ?? [],
    references: normalizeVideoReferences(patch.references).length > 0
      ? normalizeVideoReferences(patch.references)
      : buildVideoReferencesFromInputImages(
          patch.mode,
          patch.inputImageAssetIds ?? [],
        ),
    createdAt: patch.createdAt ?? patch.updatedAt,
    finishedAt: patch.updatedAt,
  }
  if (patch.error) generationRun.error = patch.error
  return generationRun
}

function applyVideoGenerationPatchToNode(
  node: FlowNode,
  patch: VideoGenerationFlowPatch,
): FlowNode {
  const generationRun = buildVideoGenerationRun(patch)
  return {
    ...node,
    data: {
      ...node.data,
      status: patch.status,
      error: patch.error,
      assetIds: patch.assetIds,
      generationId: patch.generationId,
      prompt: patch.prompt,
      model: patch.model,
      mode: patch.mode,
      aspectRatio: patch.aspectRatio,
      resolution: patch.resolution,
      quality: patch.quality,
      durationSeconds: patch.durationSeconds,
      count: patch.count,
      generateAudio: patch.generateAudio,
      inputImageAssetIds: patch.inputImageAssetIds ?? [],
      references: normalizeVideoReferences(patch.references),
      generationRuns: appendVideoGenerationRun(
        node.data.generationRuns,
        generationRun,
      ),
      updatedAt: patch.updatedAt,
    },
  }
}

function createRecoveredVideoNode(flow: Flow, patch: VideoGenerationFlowPatch): FlowNode {
  const maxX = flow.nodes.reduce(
    (value, node) => Math.max(value, node.position?.x ?? 0),
    0,
  )
  const videoNodeCount = flow.nodes.filter((node) => node.type === 'video').length
  return applyVideoGenerationPatchToNode(
    {
      id: patch.nodeId,
      type: 'video',
      position: {
        x: maxX + 620,
        y: 220,
      },
      data: {
        title: `视频节点 ${videoNodeCount + 1}`,
        status: 'idle',
      },
    },
    patch,
  )
}

export function applyVideoGenerationResultToFlow(
  flow: Flow,
  patch: VideoGenerationFlowPatch,
): Flow {
  let matched = false
  const nodes = flow.nodes.map((node) => {
    if (node.id !== patch.nodeId) return node
    matched = true
    return applyVideoGenerationPatchToNode(node, patch)
  })

  if (matched) return { ...flow, nodes }
  return {
    ...flow,
    nodes: [...nodes, createRecoveredVideoNode(flow, patch)],
  }
}

/** 状态监听器存储 */
const listeners = new Map<string, Set<GenerationStatusListener>>()

/** 添加状态监听器 */
export function addGenerationListener(id: string, listener: GenerationStatusListener): void {
  let set = listeners.get(id)
  if (!set) {
    set = new Set()
    listeners.set(id, set)
  }
  set.add(listener)
}

/** 移除状态监听器 */
export function removeGenerationListener(id: string, listener: GenerationStatusListener): void {
  const set = listeners.get(id)
  if (!set) return
  set.delete(listener)
  if (set.size === 0) {
    listeners.delete(id)
  }
}

/** 通知所有监听器 */
function notifyListeners(record: GenerationRecord): void {
  const set = listeners.get(record.id)
  if (!set) return
  for (const listener of set) {
    try {
      listener(record.status, record)
    } catch {
      // 忽略监听器错误
    }
  }
}

/** 从 URL 推断图片扩展名 */
function extFromImageUrl(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif|bmp)(?:\?|#|$)/i)
  if (m) {
    const ext = m[1].toLowerCase()
    return ext === 'jpeg' ? '.jpg' : `.${ext}`
  }
  return '.png'
}

/** 从 URL 推断视频扩展名 */
function extFromVideoUrl(url: string): string {
  const m = url.match(/\.(mp4|mov|webm|avi|mkv|m4v)(?:\?|#|$)/i)
  if (m) {
    return `.${m[1].toLowerCase()}`
  }
  return '.mp4'
}

function mimeFromImageExt(ext: string): string {
  const normalized = ext.toLowerCase()
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg'
  if (normalized === '.webp') return 'image/webp'
  if (normalized === '.gif') return 'image/gif'
  if (normalized === '.bmp') return 'image/bmp'
  return 'image/png'
}

function extFromImageMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/jpeg') return '.jpg'
  if (normalized === 'image/webp') return '.webp'
  if (normalized === 'image/gif') return '.gif'
  if (normalized === 'image/bmp') return '.bmp'
  return '.png'
}

export type ImageGenerationProvider =
  | 'dreamina'
  | 'codex'
  | 'openai-compatible'

export type VideoGenerationProvider =
  | 'dreamina'
  | 'openai-compatible'

export function getImageGenerationProvider(
  model: string,
): ImageGenerationProvider {
  if (isJimengImageModel(model)) return 'dreamina'
  if (isCodexImageModel(model)) return 'codex'
  return 'openai-compatible'
}

function configuredProviderForModel(
  model: string,
  settings: Pick<Settings, 'modelConfigs'> | undefined,
  capability: ModelCapability,
): string | undefined {
  const id = model.trim()
  if (!id) return undefined
  return getModelConfigsByCapability(settings?.modelConfigs, capability)
    .find((item) => item.id === id)
    ?.provider
    ?.trim()
}

export function getImageGenerationProviderForSettings(
  model: string,
  settings?: Pick<Settings, 'modelConfigs'>,
): ImageGenerationProvider {
  const provider = configuredProviderForModel(model, settings, 'image')
  if (provider === 'dreamina') return 'dreamina'
  if (provider === 'codex') return 'codex'
  if (provider === 'openai-compatible' || provider === 'custom') {
    return 'openai-compatible'
  }
  return getImageGenerationProvider(model)
}

function imageProviderForModel(model: string): string {
  return getImageGenerationProvider(model)
}

export function getVideoGenerationProvider(
  model: string,
): VideoGenerationProvider {
  return isJimengVideoModel(model) ? 'dreamina' : 'openai-compatible'
}

export function getVideoGenerationProviderForSettings(
  model: string,
  settings?: Pick<Settings, 'modelConfigs'>,
): VideoGenerationProvider {
  const provider = configuredProviderForModel(model, settings, 'video')
  if (provider === 'dreamina') return 'dreamina'
  if (provider === 'openai-compatible' || provider === 'custom') {
    return 'openai-compatible'
  }
  return getVideoGenerationProvider(model)
}

function mimeFromVideoExt(ext: string): string {
  const normalized = ext.toLowerCase()
  if (normalized === '.webm') return 'video/webm'
  if (normalized === '.mov') return 'video/quicktime'
  if (normalized === '.avi') return 'video/x-msvideo'
  return 'video/mp4'
}

async function persistImageGenerationResultToFlow(
  req: GenerationRequest,
  record: GenerationRecord,
): Promise<void> {
  const flowId = req.flowId?.trim()
  if (!flowId || flowId === 'local') return

  const assetIds =
    record.results
      ?.map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId) ?? []

  try {
    const flow = await getFlow(flowId)
    const next = applyImageGenerationResultToFlow(flow, {
      nodeId: req.nodeId,
      generationId: record.id,
      prompt: req.prompt,
      model: req.model,
      width: req.width,
      height: req.height,
      count: req.count,
      seed: req.seed ?? null,
      inputImageAssetIds: req.inputImages ?? [],
      assetIds,
      status: record.status,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.finishedAt ?? new Date().toISOString(),
    })

    if (next !== flow) {
      await updateFlow(flowId, { nodes: next.nodes })
    }
  } catch (err) {
    console.warn('[generations] 写回图片生成结果到 flow 失败:', err)
  }
}

async function persistVideoGenerationResultToFlow(
  req: VideoGenerationRequest,
  record: GenerationRecord,
): Promise<void> {
  const flowId = req.flowId?.trim()
  if (!flowId || flowId === 'local') return

  const assetIds =
    record.results
      ?.map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId) ?? []

  try {
    const flow = await getFlow(flowId)
    const next = applyVideoGenerationResultToFlow(flow, {
      nodeId: req.nodeId,
      generationId: record.id,
      prompt: req.prompt,
      model: req.model,
      mode: req.mode,
      aspectRatio: req.aspectRatio,
      resolution: req.resolution,
      quality: req.quality,
      durationSeconds: req.durationSeconds,
      count: req.count,
      generateAudio: req.generateAudio,
      inputImageAssetIds: req.inputImages ?? [],
      references: normalizeVideoReferences(req.references).length > 0
        ? normalizeVideoReferences(req.references)
        : buildVideoReferencesFromInputImages(req.mode, req.inputImages),
      assetIds,
      status: record.status,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.finishedAt ?? new Date().toISOString(),
    })

    if (next !== flow) {
      await updateFlow(flowId, { nodes: next.nodes })
    }
  } catch (err) {
    console.warn('[generations] 写回视频生成结果到 flow 失败:', err)
  }
}

/** 从 URL 下载图片二进制 */
async function downloadImage(
  url: string,
  timeoutMs = 60_000,
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`下载图片失败：HTTP ${res.status} ${res.statusText}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = extFromImageUrl(url)
    const mimeType =
      res.headers.get('content-type')?.split(';')[0]?.trim() ||
      (ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/png')
    return { buffer: buf, mimeType, ext }
  } finally {
    clearTimeout(timer)
  }
}

/** 从 URL 下载视频二进制 */
async function downloadVideo(
  url: string,
  timeoutMs = 300_000,
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`下载视频失败：HTTP ${res.status} ${res.statusText}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = extFromVideoUrl(url)
    const mimeType =
      res.headers.get('content-type')?.split(';')[0]?.trim() ||
      (ext === '.webm' ? 'video/webm' : 'video/mp4')
    return { buffer: buf, mimeType, ext }
  } finally {
    clearTimeout(timer)
  }
}

/** 把单张图片生成结果保存为 Asset（下载 → saveUploadFile） */
async function saveImageGenerationResult(
  result: GenerationResult,
  req: GenerationRequest,
  providerOverride?: ImageGenerationProvider,
): Promise<GenerationResult> {
  const provider = providerOverride ?? imageProviderForModel(req.model)

  if (result.localPath) {
    const ext = extname(result.localPath) || '.png'
    const buffer = await readFile(result.localPath)
    const asset = await saveUploadFile({
      fileBuffer: buffer,
      originalName: `generation-${req.nodeId}${ext}`,
      mimeType: mimeFromImageExt(ext),
      prompt: req.prompt,
      sourceNodeId: req.nodeId,
      inputAssetIds: req.inputImages,
      provider,
      params: {
        model: req.model,
        width: req.width,
        height: req.height,
        count: req.count,
        seed: req.seed ?? null,
        localPath: result.localPath,
      },
    })
    return {
      ...result,
      assetId: asset.id,
      url: asset.id,
    }
  }

  if (result.base64Data) {
    const mimeType = result.mimeType || 'image/png'
    const ext = extFromImageMime(mimeType)
    const asset = await saveUploadFile({
      fileBuffer: Buffer.from(result.base64Data, 'base64'),
      originalName: `generation-${req.nodeId}${ext}`,
      mimeType,
      prompt: req.prompt,
      sourceNodeId: req.nodeId,
      inputAssetIds: req.inputImages,
      provider,
      params: {
        model: req.model,
        width: req.width,
        height: req.height,
        count: req.count,
        seed: req.seed ?? null,
        responseType: 'base64',
      },
    })
    return {
      ...result,
      assetId: asset.id,
      url: asset.id,
    }
  }

  const remoteUrl = result.remoteUrl || result.url
  if (!remoteUrl) {
    throw new Error('生成结果缺少 url，无法保存')
  }
  const { buffer, mimeType, ext } = await downloadImage(remoteUrl)
  const originalName = `generation-${req.nodeId}${ext}`
  const asset = await saveUploadFile({
    fileBuffer: buffer,
    originalName,
    mimeType,
    prompt: req.prompt,
    sourceNodeId: req.nodeId,
    inputAssetIds: req.inputImages,
    provider,
    params: {
      model: req.model,
      width: req.width,
      height: req.height,
      count: req.count,
      seed: req.seed ?? null,
      remoteUrl,
    },
  })
  return {
    ...result,
    assetId: asset.id,
    url: asset.id,
  }
}

interface ImageGenerationResultsForRequestDeps {
  settings?: Pick<Settings, 'modelConfigs'>
  generateImageImpl?: typeof generateImage
  generateCodexCliImageImpl?: typeof generateCodexCliImage
  generateOpenAiCompatibleImageImpl?: typeof generateOpenAiCompatibleImage
  saveImageGenerationResultImpl?: (
    result: GenerationResult,
    req: GenerationRequest,
    provider: ImageGenerationProvider,
  ) => Promise<GenerationResult>
}

export interface ImageGenerationResultsForRequest {
  provider: ImageGenerationProvider
  results: GenerationResult[]
  successCount: number
  errors: string[]
  error?: string
}

function summarizeImageSaveErrors(
  successCount: number,
  totalCount: number,
  errors: string[],
): string | undefined {
  if (errors.length === 0) return undefined
  return successCount > 0
    ? `部分图片保存失败（${successCount}/${totalCount} 成功）：${errors.join('；')}`
    : `所有图片保存失败：${errors.join('；')}`
}

export async function generateImageResultsForRequest(
  req: GenerationRequest,
  deps: ImageGenerationResultsForRequestDeps = {},
): Promise<ImageGenerationResultsForRequest> {
  const settings = deps.settings ?? await getSettings()
  const provider = getImageGenerationProviderForSettings(req.model, settings)
  const rawResults = provider === 'dreamina'
    ? await (deps.generateImageImpl ?? generateImage)(req)
    : provider === 'codex'
      ? await (deps.generateCodexCliImageImpl ?? generateCodexCliImage)(req)
      : await (deps.generateOpenAiCompatibleImageImpl ?? generateOpenAiCompatibleImage)(req)

  const saved: GenerationResult[] = []
  let successCount = 0
  const errors: string[] = []
  const saveResult = deps.saveImageGenerationResultImpl ?? saveImageGenerationResult

  for (const result of rawResults) {
    try {
      const savedResult = await saveResult(result, req, provider)
      saved.push(savedResult)
      successCount++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      saved.push({
        ...result,
        assetId: undefined,
      })
      errors.push(message)
    }
  }

  return {
    provider,
    results: saved,
    successCount,
    errors,
    error: summarizeImageSaveErrors(successCount, rawResults.length, errors),
  }
}

/** 把单个视频生成结果保存为 Asset（下载 → saveUploadFile） */
async function saveVideoGenerationResult(
  result: GenerationResult,
  req: VideoGenerationRequest,
  providerOverride?: VideoGenerationProvider,
): Promise<GenerationResult> {
  const provider = providerOverride ?? getVideoGenerationProvider(req.model)
  if (result.localPath) {
    const ext = extname(result.localPath) || '.mp4'
    const buffer = await readFile(result.localPath)
    const asset = await saveUploadFile({
      fileBuffer: buffer,
      originalName: `generation-${req.nodeId}${ext}`,
      mimeType: mimeFromVideoExt(ext),
      prompt: req.prompt,
      sourceNodeId: req.nodeId,
      inputAssetIds: req.inputImages,
      provider,
      params: {
        model: req.model,
        mode: req.mode,
        aspectRatio: req.aspectRatio,
        resolution: req.resolution,
        quality: req.quality,
        durationSeconds: req.durationSeconds,
        count: req.count,
        generateAudio: req.generateAudio,
        localPath: result.localPath,
      },
    })
    return {
      ...result,
      assetId: asset.id,
      url: asset.id,
    }
  }

  const remoteUrl = result.remoteUrl || result.url
  if (!remoteUrl) {
    throw new Error('生成结果缺少 url，无法保存')
  }
  const { buffer, mimeType, ext } = await downloadVideo(remoteUrl)
  const originalName = `generation-${req.nodeId}${ext}`
  const asset = await saveUploadFile({
    fileBuffer: buffer,
    originalName,
    mimeType,
    prompt: req.prompt,
    sourceNodeId: req.nodeId,
    inputAssetIds: req.inputImages,
    provider,
    params: {
      model: req.model,
      mode: req.mode,
      aspectRatio: req.aspectRatio,
      resolution: req.resolution,
      quality: req.quality,
      durationSeconds: req.durationSeconds,
      count: req.count,
      generateAudio: req.generateAudio,
      remoteUrl,
    },
  })
  return {
    ...result,
    assetId: asset.id,
    url: asset.id,
  }
}

/** 构造 GenerationResponse */
function toResponse(rec: GenerationRecord): GenerationResponse {
  return {
    id: rec.id,
    nodeId: rec.nodeId,
    status: rec.status,
    error: rec.error,
    results: rec.results,
    createdAt: rec.createdAt,
    finishedAt: rec.finishedAt,
  }
}

/** 创建任务前的通用校验 */
function validateCreateRequest(
  req: GenerationRequest | VideoGenerationRequest,
): void {
  if (!req.prompt || !req.prompt.trim()) {
    throw new JimengError('INVALID_INPUT', 'Prompt 不能为空', 400)
  }
  if (!req.nodeId) {
    throw new JimengError('INVALID_INPUT', 'nodeId 不能为空', 400)
  }
}

/** 创建图片生成任务（异步执行） */
async function createImageGeneration(
  req: GenerationRequest,
): Promise<GenerationResponse> {
  const id = makeGenerationId()
  const record: GenerationRecord = {
    id,
    nodeId: req.nodeId,
    status: 'queued',
    request: req,
    createdAt: new Date().toISOString(),
  }
  store.set(id, record)

  // 异步执行生成任务
  setImmediate(() => {
    runImageGeneration(id, req).catch(() => {
      // 忽略异步执行错误，已在 runImageGeneration 中处理
    })
  })

  return toResponse(record)
}

/** 在后台运行图片生成 */
async function runImageGeneration(
  id: string,
  req: GenerationRequest,
): Promise<void> {
  const record = store.get(id)
  if (!record) return

  try {
    record.status = 'running'
    notifyListeners(record)

    const settings = await getSettings()
    const generationResult = await generateImageResultsForRequest(req, {
      settings,
    })

    record.results = generationResult.results
    record.status = generationResult.successCount > 0 ? 'success' : 'error'
    if (generationResult.error) record.error = generationResult.error
    record.finishedAt = new Date().toISOString()
    await persistImageGenerationResultToFlow(req, record)
    notifyListeners(record)
  } catch (err) {
    record.status = 'error'
    record.error = err instanceof Error ? err.message : String(err)
    record.finishedAt = new Date().toISOString()
    await persistImageGenerationResultToFlow(req, record)
    notifyListeners(record)
  }
}

/** 创建视频生成任务（异步执行） */
async function createVideoGeneration(
  req: VideoGenerationRequest,
): Promise<GenerationResponse> {
  const id = makeGenerationId()
  const record: GenerationRecord = {
    id,
    nodeId: req.nodeId,
    status: 'queued',
    request: req,
    createdAt: new Date().toISOString(),
  }
  store.set(id, record)

  // 异步执行生成任务
  setImmediate(() => {
    runVideoGeneration(id, req).catch(() => {
      // 忽略异步执行错误
    })
  })

  return toResponse(record)
}

/** 在后台运行视频生成 */
async function runVideoGeneration(
  id: string,
  req: VideoGenerationRequest,
): Promise<void> {
  const record = store.get(id)
  if (!record) return

  try {
    record.status = 'running'
    notifyListeners(record)

    const settings = await getSettings()
    const provider = getVideoGenerationProviderForSettings(req.model, settings)
    const results = provider === 'dreamina'
      ? await generateVideo(req)
      : await generateOpenAiCompatibleVideo(req)

    // 顺序下载并保存每个视频为 Asset
    const saved: GenerationResult[] = []
    let successCount = 0
    const errors: string[] = []
    for (const r of results) {
      try {
        const s = await saveVideoGenerationResult(r, req, provider)
        saved.push(s)
        successCount++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        saved.push({
          ...r,
          assetId: undefined,
        })
        errors.push(msg)
      }
    }

    record.results = saved
    record.status = successCount > 0 ? 'success' : 'error'
    if (errors.length > 0) {
      record.error = successCount > 0
        ? `部分视频保存失败（${successCount}/${results.length} 成功）：${errors.join('；')}`
        : `所有视频保存失败：${errors.join('；')}`
    }
    record.finishedAt = new Date().toISOString()
    await persistVideoGenerationResultToFlow(req, record)
    notifyListeners(record)
  } catch (err) {
    record.status = 'error'
    record.error = err instanceof Error ? err.message : String(err)
    record.finishedAt = new Date().toISOString()
    await persistVideoGenerationResultToFlow(req, record)
    notifyListeners(record)
  }
}

/**
 * 创建一次生成任务（POST /api/generations）。
 * 状态机：idle → queued → running → success/error。
 * 成功后每个结果下载保存到 workspace/outputs/yyyy-mm-dd/，metadata JSON 同名保存。
 */
export async function createGeneration(
  req: GenerationRequest | VideoGenerationRequest,
): Promise<GenerationResponse> {
  validateCreateRequest(req)

  if (req.mediaType === 'video') {
    return createVideoGeneration(req)
  }

  // 默认按图片处理（兼容早期未传 mediaType 的请求）
  return createImageGeneration(req as GenerationRequest)
}

/**
 * 按 id 查询生成任务（GET /api/generations/:id）。
 */
export async function getGeneration(
  id: string,
): Promise<GenerationResponse | null> {
  const rec = store.get(id)
  if (!rec) return null
  return toResponse(rec)
}

/**
 * 重试生成任务（POST /api/generations/:id/retry）。
 * 复用原请求参数重新创建；返回新任务响应。
 */
export async function retryGeneration(
  id: string,
): Promise<GenerationResponse> {
  const rec = store.get(id)
  if (!rec) {
    throw new JimengError(
      'NOT_FOUND',
      `生成任务 ${id} 不存在`,
      404,
    )
  }
  // 复用原请求重新创建
  return createGeneration(rec.request)
}
