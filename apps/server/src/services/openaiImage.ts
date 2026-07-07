import type {
  GenerationRequest,
  GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import type { Settings } from '@jimeng-flow/shared/settings'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { getProjectRoot } from '../config'
import { getAsset, getAssetFilePath } from './assets'
import { getSettings } from './settings'

interface OpenAiImageItem {
  url?: string
  b64_json?: string
  task_id?: string
}

interface OpenAiImageResponse {
  data?: OpenAiImageItem[]
}

interface OpenAiImageDeps {
  settings?: Pick<Settings, 'llmBaseUrl' | 'llmApiKey'>
  fetchImpl?: typeof fetch
  timeoutMs?: number
  pollIntervalMs?: number
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return current
}

function collectImageResultsFromValue(
  value: unknown,
  results: GenerationResult[],
): void {
  if (typeof value === 'string' && value.trim()) {
    results.push({ remoteUrl: value.trim() })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageResultsFromValue(item, results))
    return
  }
  if (!isObject(value)) return

  const url = value.url
  if (typeof url === 'string' && url.trim()) {
    results.push({ remoteUrl: url.trim() })
  } else if (Array.isArray(url)) {
    collectImageResultsFromValue(url, results)
  }

  const b64Json = value.b64_json
  if (typeof b64Json === 'string' && b64Json.trim()) {
    results.push({ base64Data: b64Json.trim(), mimeType: 'image/png' })
  }

  const imageUrl = value.image_url
  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    results.push({ remoteUrl: imageUrl.trim() })
  } else if (isObject(imageUrl)) {
    collectImageResultsFromValue(imageUrl, results)
  }
}

export function extractOpenAiImageResults(value: unknown): GenerationResult[] {
  const results: GenerationResult[] = []
  const response = value as OpenAiImageResponse
  if (Array.isArray(response.data)) {
    response.data.forEach((item) => collectImageResultsFromValue(item, results))
  }

  collectImageResultsFromValue(getPath(value, ['data', 'result', 'images']), results)
  collectImageResultsFromValue(getPath(value, ['result', 'images']), results)
  collectImageResultsFromValue(getPath(value, ['data', 'images']), results)
  collectImageResultsFromValue(getPath(value, ['images']), results)

  const seen = new Set<string>()
  return results.filter((result) => {
    const key = result.remoteUrl ?? result.base64Data
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function isApimartBaseUrl(baseUrl: string): boolean {
  return /(^|\.)apimart\.ai$/i.test(new URL(baseUrl).hostname)
}

function getRatioSize(width: number, height: number): string {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1024
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1024
  const ratio = safeWidth / safeHeight
  const candidates = [
    ['1:1', 1],
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
    ['3:2', 3 / 2],
    ['2:3', 2 / 3],
    ['21:9', 21 / 9],
    ['9:21', 9 / 21],
  ] as const
  return candidates.reduce((best, candidate) => {
    const diff = Math.abs(candidate[1] - ratio)
    const bestDiff = Math.abs(best[1] - ratio)
    return diff < bestDiff ? candidate : best
  }, candidates[0])[0]
}

function getResolution(width: number, height: number): string {
  const longSide = Math.max(width || 0, height || 0)
  if (longSide >= 2048) return '4k'
  if (longSide >= 1400) return '2k'
  return '1k'
}

function isAssetId(value: string): boolean {
  return /^asset_[A-Za-z0-9_-]+$/.test(value)
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]'
}

function extractLocalAssetIdFromUrl(value: string): string | null {
  let pathname = ''
  if (value.startsWith('/')) {
    pathname = value
  } else {
    try {
      const url = new URL(value)
      if (!isLocalHost(url.hostname)) return null
      pathname = url.pathname
    } catch {
      return null
    }
  }

  const match = pathname.match(/^\/api\/assets\/([^/]+)\/(?:file|download)$/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

function imageMimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  return 'image/png'
}

async function resolveInputImageFilePath(value: string): Promise<string> {
  const localAssetId = extractLocalAssetIdFromUrl(value)
  if (localAssetId) {
    const asset = await getAsset(localAssetId)
    if (!asset) {
      throw new Error(`找不到参考图 Asset：${localAssetId}`)
    }
    return getAssetFilePath(asset)
  }
  if (isAssetId(value)) {
    const asset = await getAsset(value)
    if (!asset) {
      throw new Error(`找不到参考图 Asset：${value}`)
    }
    return getAssetFilePath(asset)
  }
  return resolve(getProjectRoot(), value)
}

async function resolveInputImageDataUrl(input: string): Promise<string | null> {
  const value = input.trim()
  if (!value) return null
  if (isDataUrl(value) || isRemoteUrl(value)) return value

  const filePath = await resolveInputImageFilePath(value)
  const buffer = await readFile(filePath)
  return `data:${imageMimeFromPath(filePath)};base64,${buffer.toString('base64')}`
}

async function resolveInputImageDataUrls(
  inputImages: string[] | undefined,
): Promise<string[]> {
  const urls: string[] = []
  for (const input of inputImages ?? []) {
    const url = await resolveInputImageDataUrl(input)
    if (url) urls.push(url)
  }
  return urls
}

interface InputImageFilePart {
  buffer: Buffer
  mimeType: string
  filename: string
}

function imageExtFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/jpeg') return '.jpg'
  if (normalized === 'image/webp') return '.webp'
  if (normalized === 'image/gif') return '.gif'
  if (normalized === 'image/bmp') return '.bmp'
  return '.png'
}

function parseDataUrlImage(
  value: string,
  index: number,
): InputImageFilePart {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) {
    throw new Error('参考图 data URL 格式不正确')
  }
  const mimeType = match[1] || 'image/png'
  const encoded = match[3] || ''
  const buffer = match[2]
    ? Buffer.from(encoded, 'base64')
    : Buffer.from(decodeURIComponent(encoded), 'utf8')
  return {
    buffer,
    mimeType,
    filename: `reference-${index + 1}${imageExtFromMime(mimeType)}`,
  }
}

async function resolveInputImageFilePart(
  input: string,
  index: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<InputImageFilePart | null> {
  const value = input.trim()
  if (!value) return null
  if (isDataUrl(value)) return parseDataUrlImage(value, index)

  if (isRemoteUrl(value)) {
    const res = await fetchImpl(value, { signal })
    if (!res.ok) {
      throw new Error(`下载参考图失败：HTTP ${res.status} ${res.statusText}`)
    }
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType,
      filename: `reference-${index + 1}${imageExtFromMime(mimeType)}`,
    }
  }

  const filePath = await resolveInputImageFilePath(value)
  return {
    buffer: await readFile(filePath),
    mimeType: imageMimeFromPath(filePath),
    filename: `reference-${index + 1}${extname(filePath) || '.png'}`,
  }
}

async function createOpenAiImageEditForm(
  req: GenerationRequest,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<FormData> {
  const form = new FormData()
  form.append('model', req.model)
  form.append('prompt', req.prompt)
  form.append('n', String(Math.max(1, Math.min(req.count ?? 1, 10))))
  form.append(
    'size',
    getOpenAiCompatibleImageSize({
      model: req.model,
      width: req.width,
      height: req.height,
    }),
  )

  for (const [index, input] of (req.inputImages ?? []).entries()) {
    const part = await resolveInputImageFilePart(input, index, fetchImpl, signal)
    if (!part) continue
    const blob = new Blob([new Uint8Array(part.buffer)], {
      type: part.mimeType,
    })
    form.append('image', blob, part.filename)
  }
  return form
}

export function getOpenAiCompatibleImageSize({
  model,
  width,
  height,
}: {
  model: string
  width: number
  height: number
}): string {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1024
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1024
  const ratio = safeWidth / safeHeight
  const modelId = model.toLowerCase()

  if (modelId.includes('dall-e-3')) {
    if (ratio >= 1.2) return '1792x1024'
    if (ratio <= 0.82) return '1024x1792'
    return '1024x1024'
  }

  if (ratio >= 1.2) return '1536x1024'
  if (ratio <= 0.82) return '1024x1536'
  return '1024x1024'
}

export function getOpenAiCompatibleImagePayload(
  req: GenerationRequest,
  baseUrl: string,
): Record<string, unknown> {
  const isApimart = isApimartBaseUrl(baseUrl)
  const count = Math.max(1, Math.min(req.count ?? 1, isApimart ? 4 : 10))

  if (isApimart) {
    return {
      model: req.model,
      prompt: req.prompt,
      n: count,
      size: getRatioSize(req.width, req.height),
      resolution: getResolution(req.width, req.height),
    }
  }

  return {
    model: req.model,
    prompt: req.prompt,
    n: count,
    size: getOpenAiCompatibleImageSize({
      model: req.model,
      width: req.width,
      height: req.height,
    }),
  }
}

export function extractOpenAiImageTaskId(value: unknown): string | null {
  const directTaskId = isObject(value) ? value.task_id : undefined
  if (typeof directTaskId === 'string' && directTaskId.trim()) {
    return directTaskId.trim()
  }

  const data = isObject(value) ? value.data : undefined
  if (isObject(data) && typeof data.task_id === 'string' && data.task_id.trim()) {
    return data.task_id.trim()
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      if (isObject(item) && typeof item.task_id === 'string' && item.task_id.trim()) {
        return item.task_id.trim()
      }
    }
  }

  return null
}

function extractTaskStatus(value: unknown): string {
  const status =
    getPath(value, ['data', 'status']) ??
    getPath(value, ['status']) ??
    (Array.isArray(getPath(value, ['data']))
      ? (getPath(value, ['data']) as unknown[]).find((item) => isObject(item) && item.status)
      : undefined)
  if (isObject(status) && typeof status.status === 'string') {
    return status.status.toLowerCase()
  }
  return typeof status === 'string' ? status.toLowerCase() : ''
}

function extractTaskError(value: unknown): string {
  const candidates = [
    getPath(value, ['data', 'error', 'message']),
    getPath(value, ['data', 'error']),
    getPath(value, ['error', 'message']),
    getPath(value, ['error']),
    getPath(value, ['message']),
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return '第三方图片任务失败'
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

async function pollOpenAiImageTask({
  taskId,
  baseUrl,
  apiKey,
  fetchImpl,
  signal,
  timeoutMs,
  pollIntervalMs,
}: {
  taskId: string
  baseUrl: string
  apiKey: string
  fetchImpl: typeof fetch
  signal: AbortSignal
  timeoutMs: number
  pollIntervalMs: number
}): Promise<GenerationResult[]> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const res = await fetchImpl(
      `${baseUrl}/tasks/${encodeURIComponent(taskId)}?language=en`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
      },
    )
    const json = await readJsonResponse(res)
    if (!res.ok) {
      throw new Error(
        `第三方图片任务查询失败：HTTP ${res.status} ${res.statusText} - ${extractTaskError(json)}`,
      )
    }

    const results = extractOpenAiImageResults(json)
    if (results.length > 0) return results

    const status = extractTaskStatus(json)
    if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(extractTaskError(json))
    }

    await delay(pollIntervalMs)
  }

  throw new Error(`第三方图片任务查询超时（${timeoutMs / 1000}s）`)
}

export async function generateOpenAiCompatibleImage(
  req: GenerationRequest,
  deps: OpenAiImageDeps = {},
): Promise<GenerationResult[]> {
  const settings = deps.settings ?? await getSettings()
  const baseUrl = normalizeBaseUrl(settings.llmBaseUrl ?? '')
  const apiKey = settings.llmApiKey ?? ''
  const fetchImpl = deps.fetchImpl ?? fetch

  if (!baseUrl) {
    throw new Error('第三方图片 API Base URL 未配置，请先在设置中配置 LLM Provider')
  }
  if (!apiKey) {
    throw new Error('第三方图片 API Key 未配置，请先在设置中配置 LLM Provider')
  }

  const controller = new AbortController()
  const timeoutMs = deps.timeoutMs ?? 300_000
  const pollIntervalMs = deps.pollIntervalMs ?? 2_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const hasInputImages = !!req.inputImages && req.inputImages.length > 0
    const isApimart = isApimartBaseUrl(baseUrl)
    let res: Response
    if (hasInputImages && !isApimart) {
      res = await fetchImpl(`${baseUrl}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: await createOpenAiImageEditForm(
          req,
          fetchImpl,
          controller.signal,
        ),
        signal: controller.signal,
      })
    } else {
      const payload = getOpenAiCompatibleImagePayload(req, baseUrl)
      if (isApimart && hasInputImages) {
        payload.image_urls = await resolveInputImageDataUrls(req.inputImages)
      }
      res = await fetchImpl(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const summary = text.length > 500 ? `${text.slice(0, 500)}...` : text
      throw new Error(
        `第三方图片 API 调用失败：HTTP ${res.status} ${res.statusText}${summary ? ` - ${summary}` : ''}`,
      )
    }

    const json = (await res.json()) as unknown
    const results = extractOpenAiImageResults(json)
    if (results.length > 0) return results

    const taskId = extractOpenAiImageTaskId(json)
    if (taskId) {
      return pollOpenAiImageTask({
        taskId,
        baseUrl,
        apiKey,
        fetchImpl,
        signal: controller.signal,
        timeoutMs,
        pollIntervalMs,
      })
    }

    if (results.length === 0) {
      throw new Error('第三方图片 API 没有返回可用图片')
    }
    return results
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`第三方图片 API 调用超时（${timeoutMs / 1000}s）`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
