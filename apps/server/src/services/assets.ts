// 即梦 Flow 后端 - Asset service
// 负责资产文件的上传保存、读取、列举与元数据持久化。
// 参考 PRD 8.5、10.4、11.2。
//
// 目录约定：
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.<ext>   媒体本体
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.json   元数据
// asset.path 为相对 workspace/ 的路径。

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { Asset, AssetType } from '@jimeng-flow/shared/asset'
import { readSettings, getProjectRoot, resolveOutputDir } from '../config'

// workspace 根目录：<projectRoot>/workspace
const WORKSPACE_DIR = resolve(getProjectRoot(), 'workspace')
// 合法资产 ID 校验，避免路径穿越
const ASSET_ID_PATTERN = /^asset_[A-Za-z0-9_-]+$/

/** 生成 yyyy-mm-dd 字符串（本地时区） */
function todayDateStr(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 生成资产 ID：asset_<timestamp>_<random> */
function generateAssetId(): string {
  const ts = Date.now()
  const rand = randomBytes(4).toString('hex') // 8 位 hex
  return `asset_${ts}_${rand}`
}

/** 根据 mimeType 与文件名兜底推断资产类型 */
function deriveAssetType(mimeType: string, originalName: string): AssetType {
  const mime = (mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  const ext = extname(originalName).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
    return 'image'
  }
  if (['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].includes(ext)) {
    return 'video'
  }
  return 'image'
}

/** 把 Windows 反斜杠路径归一化为正斜杠，便于跨平台存储 */
function toForwardSlash(p: string): string {
  return p.split(sep).join('/')
}

/** 读取 outputs 根目录的绝对路径（基于 settings.outputDir） */
async function getOutputsRoot(): Promise<string> {
  const settings = await readSettings()
  return resolveOutputDir(settings.outputDir)
}

/** saveUploadFile 的入参 */
export interface SaveUploadInput {
  /** 文件二进制内容 */
  fileBuffer: Buffer
  /** 原始文件名，用于推断扩展名 */
  originalName: string
  /** MIME 类型，例如 image/png */
  mimeType: string
  /** 生成提示词（可选） */
  prompt?: string
  /** 来源节点 ID（可选） */
  sourceNodeId?: string
  /** 上游参考资产 ID 列表（可选） */
  inputAssetIds?: string[]
  /** provider（可选） */
  provider?: string
  /** 生成参数快照（可选） */
  params?: Record<string, unknown>
}

/**
 * 保存上传文件到 outputs 目录，生成资产 ID，写入 metadata.json。
 * - 自动按日期创建子目录
 * - 资产文件名：<assetId>.<ext>
 * - metadata 文件名：<assetId>.json
 */
export async function saveUploadFile(input: SaveUploadInput): Promise<Asset> {
  const outputsRoot = await getOutputsRoot()
  const dateSubdir = todayDateStr()
  const fileDir = resolve(outputsRoot, dateSubdir)
  await mkdir(fileDir, { recursive: true })

  const assetId = generateAssetId()
  const ext = extname(input.originalName) || ''
  const fileName = `${assetId}${ext}`
  const absFilePath = resolve(fileDir, fileName)

  await writeFile(absFilePath, input.fileBuffer)

  const relPath = toForwardSlash(relative(WORKSPACE_DIR, absFilePath))
  const type = deriveAssetType(input.mimeType, input.originalName)
  const asset: Asset = {
    id: assetId,
    type,
    path: relPath,
    prompt: input.prompt,
    sourceNodeId: input.sourceNodeId,
    inputAssetIds: input.inputAssetIds ?? [],
    provider: input.provider,
    params: input.params,
    createdAt: new Date().toISOString(),
  }

  const metaPath = resolve(fileDir, `${assetId}.json`)
  await writeFile(metaPath, JSON.stringify(asset, null, 2), 'utf8')
  return asset
}

/** 返回资产文件的绝对路径 */
export function getAssetFilePath(asset: Asset): string {
  return resolve(WORKSPACE_DIR, asset.path)
}

/**
 * 按 ID 查找资产 metadata。
 * - 扫描 outputs 下所有日期子目录，定位 <id>.json
 * - ID 不合法或不存在时返回 null
 */
export async function getAsset(id: string): Promise<Asset | null> {
  if (!ASSET_ID_PATTERN.test(id)) return null
  const outputsRoot = await getOutputsRoot()
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(outputsRoot, { withFileTypes: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw err
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = resolve(outputsRoot, entry.name, `${id}.json`)
    try {
      const content = await readFile(metaPath, 'utf8')
      const parsed = JSON.parse(content) as Asset
      if (parsed && parsed.id === id) return parsed
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }
  return null
}

/**
 * 列出全部资产，按创建时间倒序（最新在前）。
 */
export async function listAssets(): Promise<Asset[]> {
  const outputsRoot = await getOutputsRoot()
  let dateEntries: import('node:fs').Dirent[]
  try {
    dateEntries = await readdir(outputsRoot, { withFileTypes: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw err
  }

  const assets: Asset[] = []
  for (const dateEntry of dateEntries) {
    if (!dateEntry.isDirectory()) continue
    const dateDir = resolve(outputsRoot, dateEntry.name)
    let fileEntries: import('node:fs').Dirent[]
    try {
      fileEntries = await readdir(dateDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const fe of fileEntries) {
      if (!fe.isFile() || !fe.name.endsWith('.json')) continue
      try {
        const content = await readFile(resolve(dateDir, fe.name), 'utf8')
        const parsed = JSON.parse(content) as Asset
        if (parsed && parsed.id) assets.push(parsed)
      } catch {
        // 跳过损坏的 metadata
      }
    }
  }
  assets.sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0))
  return assets
}
