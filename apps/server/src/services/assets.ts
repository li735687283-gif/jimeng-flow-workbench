// 即梦 Flow 后端 - Asset service
// 负责资产文件的上传保存、读取、列举与元数据持久化。
// 参考 PRD 8.5、10.4、11.2。
//
// 目录约定：
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.<ext>   媒体本体
//   <root>/workspace/outputs/yyyy-mm-dd/<assetId>.json   元数据
// asset.path 为相对 workspace/ 的路径。

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { Asset, AssetCategory, AssetType } from '@jimeng-flow/shared/asset'
import { readSettings, getWorkspaceDir, resolveOutputDir } from '../config'

// workspace 根目录：<projectRoot>/workspace
const WORKSPACE_DIR = getWorkspaceDir()
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

const SUPPORTED_ASSET_TYPES: Record<
  string,
  { mimeType: string; type: AssetType }
> = {
  '.png': { mimeType: 'image/png', type: 'image' },
  '.jpg': { mimeType: 'image/jpeg', type: 'image' },
  '.jpeg': { mimeType: 'image/jpeg', type: 'image' },
  '.gif': { mimeType: 'image/gif', type: 'image' },
  '.webp': { mimeType: 'image/webp', type: 'image' },
  '.bmp': { mimeType: 'image/bmp', type: 'image' },
  '.svg': { mimeType: 'image/svg+xml', type: 'image' },
  '.mp4': { mimeType: 'video/mp4', type: 'video' },
  '.mov': { mimeType: 'video/quicktime', type: 'video' },
  '.webm': { mimeType: 'video/webm', type: 'video' },
  '.avi': { mimeType: 'video/x-msvideo', type: 'video' },
  '.mkv': { mimeType: 'video/x-matroska', type: 'video' },
  '.m4v': { mimeType: 'video/x-m4v', type: 'video' },
}

export function getAssetUploadValidationError(
  mimeType: string,
  originalName: string,
): string | null {
  const ext = extname(originalName).toLowerCase()
  if (!ext) {
    return '文件名必须包含受支持的图片或视频扩展名'
  }
  const supported = SUPPORTED_ASSET_TYPES[ext]
  if (!supported) {
    return `不支持的文件类型 ${ext}；请上传 PNG、JPEG、GIF、WebP、BMP、SVG、MP4、MOV、WebM、AVI、MKV 或 M4V`
  }
  const normalizedMime = mimeType.trim().toLowerCase()
  if (!normalizedMime) {
    return `缺少文件 MIME 类型；扩展名 ${ext} 需要 ${supported.mimeType}`
  }
  if (normalizedMime !== supported.mimeType) {
    return `MIME 类型 ${mimeType} 与扩展名 ${ext} 不匹配；期望 ${supported.mimeType}`
  }
  return null
}

/** 仅在 MIME 与受支持扩展名严格匹配时返回资产类型。 */
export function deriveAssetType(
  mimeType: string,
  originalName: string,
): AssetType | null {
  if (getAssetUploadValidationError(mimeType, originalName)) return null
  return SUPPORTED_ASSET_TYPES[extname(originalName).toLowerCase()]?.type ?? null
}

/** 根据提示词和参数对资产做稳定的自动分类。 */
export function inferAssetCategory(
  asset: Pick<Asset, 'prompt' | 'type' | 'params'>,
): AssetCategory {
  const parameterText = asset.params && typeof asset.params === 'object'
    ? Object.values(asset.params)
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
    : ''
  const text = `${asset.prompt ?? ''} ${parameterText}`.toLocaleLowerCase()
  if (/(角色|人物|人像|肖像|少年|少女|男孩|女孩|男人|女人|character|portrait|person|human|man|woman)/i.test(text)) {
    return '角色'
  }
  if (/(道具|物品|武器|装备|家具|车辆|汽车|prop|object|item|weapon|tool|furniture|vehicle)/i.test(text)) {
    return '道具'
  }
  return '场景'
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
  const type = deriveAssetType(input.mimeType, input.originalName)
  if (!type) {
    throw new Error(
      getAssetUploadValidationError(input.mimeType, input.originalName) ??
        '不支持的素材文件',
    )
  }
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

/** 返回资产文件的绝对路径（含路径穿越校验） */
export function getAssetFilePath(asset: Asset): string {
  const abs = resolve(WORKSPACE_DIR, asset.path)
  // 防止 metadata 被篡改后逃逸 workspace 目录
  if (!abs.startsWith(WORKSPACE_DIR + sep)) {
    throw new Error('资产路径不合法')
  }
  return abs
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
      // JSON 解析失败（SyntaxError）也视为不存在
      if (err instanceof SyntaxError) continue
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }
  return null
}

/**
 * 将一个已经存在的输出资产登记到资产库。
 * 资产文件不复制，资产库和 outputs 使用同一份 metadata/文件。
 */
export async function saveAssetToLibrary(id: string): Promise<Asset | null> {
  const asset = await getAsset(id)
  if (!asset) return null

  const nextAsset: Asset = {
    ...asset,
    savedToLibrary: true,
    category: asset.category ?? inferAssetCategory(asset),
  }
  const absPath = getAssetFilePath(asset)
  const metadataPath = resolve(dirname(absPath), `${asset.id}.json`)
  await writeFile(metadataPath, JSON.stringify(nextAsset, null, 2), 'utf8')
  return nextAsset
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

/** 只返回通过节点右键保存到资产库的资产。 */
export async function listLibraryAssets(): Promise<Asset[]> {
  const assets = await listAssets()
  return assets
    .filter((asset) => asset.savedToLibrary === true)
    .map((asset) => ({
      ...asset,
      category: asset.category ?? inferAssetCategory(asset),
    }))
}
