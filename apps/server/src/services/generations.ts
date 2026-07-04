// 即梦 Flow 后端 - Generations service
// 生成任务编排：状态机（idle → queued → running → success/error）、
// 调用 jimeng client、下载图片、保存为 Asset、写入同名 metadata。
// 参考 PRD 8.3（生成任务）、8.5（本地文件管理）、9.3（数据流）、10.3、11.2（Asset）、12.2（错误处理）。
//
// 目录约定（与 assets.ts 保持一致）：
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.<ext>   媒体本体
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.json   元数据（由 saveUploadFile 写入）

import { randomBytes } from 'node:crypto'
import type {
  GenerationRequest,
  GenerationResponse,
  GenerationResult,
  GenerationStatus,
} from '@jimeng-flow/shared/generateNode'
import { generateImage, JimengError } from './jimeng'
import { saveUploadFile } from './assets'

/** 生成任务 ID：gen_<timestamp>_<random> */
function makeGenerationId(): string {
  const ts = Date.now()
  const rand = randomBytes(4).toString('hex')
  return `gen_${ts}_${rand}`
}

/** 内存中的生成任务记录（M0 阶段不持久化，进程重启后丢失） */
interface GenerationRecord {
  id: string
  nodeId: string
  status: GenerationStatus
  error?: string
  results?: GenerationResult[]
  request: GenerationRequest
  createdAt: string
  finishedAt?: string
}

/** 任务存储（M0 内存实现，单进程足够） */
const store = new Map<string, GenerationRecord>()

/** 从 URL 推断图片扩展名 */
function extFromUrl(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif|bmp)(?:\?|#|$)/i)
  if (m) {
    const ext = m[1].toLowerCase()
    return ext === 'jpeg' ? '.jpg' : `.${ext}`
  }
  return '.png'
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
    const ext = extFromUrl(url)
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

/** 把单张生成结果保存为 Asset（下载 → saveUploadFile） */
async function saveGenerationResult(
  result: GenerationResult,
  req: GenerationRequest,
): Promise<GenerationResult> {
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
    provider: 'jimeng',
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

/**
 * 创建一次生成任务（POST /api/generations）。
 * 状态机：idle → queued → running → success/error。
 * 成功后每张图下载保存到 workspace/outputs/yyyy-mm-dd/，metadata JSON 同名保存。
 */
export async function createGeneration(
  req: GenerationRequest,
): Promise<GenerationResponse> {
  if (!req.prompt || !req.prompt.trim()) {
    throw new JimengError(
      'JIMENG_BAD_RESPONSE',
      'Prompt 不能为空',
      400,
    )
  }
  if (!req.nodeId) {
    throw new JimengError(
      'JIMENG_BAD_RESPONSE',
      'nodeId 不能为空',
      400,
    )
  }

  const id = makeGenerationId()
  const record: GenerationRecord = {
    id,
    nodeId: req.nodeId,
    status: 'queued',
    request: req,
    createdAt: new Date().toISOString(),
  }
  store.set(id, record)

  try {
    record.status = 'running'
    const results = await generateImage(req)

    // 顺序下载并保存每张图为 Asset（避免并发占用过多内存）
    const saved: GenerationResult[] = []
    for (const r of results) {
      try {
        const s = await saveGenerationResult(r, req)
        saved.push(s)
      } catch (err) {
        // 单张下载/保存失败：保留 remoteUrl，不阻断整体
        const msg = err instanceof Error ? err.message : String(err)
        saved.push({
          ...r,
          assetId: undefined,
        })
        // 记录到 record.error 但不改变 status（部分成功）
        if (!record.error) record.error = `部分图片保存失败：${msg}`
      }
    }

    record.results = saved
    record.status = saved.length > 0 ? 'success' : 'error'
    if (record.status === 'error' && !record.error) {
      record.error = '所有图片保存失败'
    }
    record.finishedAt = new Date().toISOString()
  } catch (err) {
    record.status = 'error'
    record.error =
      err instanceof Error ? err.message : String(err)
    record.finishedAt = new Date().toISOString()
  }

  return toResponse(record)
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
      'JIMENG_BAD_RESPONSE',
      `生成任务 ${id} 不存在`,
      404,
    )
  }
  // 复用原请求重新创建
  return createGeneration(rec.request)
}
