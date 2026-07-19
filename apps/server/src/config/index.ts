// 即梦 Flow 后端 - Settings 配置层
// 负责读取、写入 workspace/config/settings.json，并自动创建目录、合并默认值。
// 参考 PRD 8.5、8.6、11.3、12.1。

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Settings } from '@jimeng-flow/shared'
import { DEFAULT_SETTINGS, normalizeModelConfigs } from '@jimeng-flow/shared'

const configuredProjectRoot = process.env.MOK_PROJECT_ROOT?.trim()
// 项目根目录仅用于 CLI cwd；持久化数据使用独立的 workspace 根目录。
const PROJECT_ROOT = configuredProjectRoot
  ? resolve(configuredProjectRoot)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

export function resolveWorkspaceDirectory(
  projectRoot: string,
  configuredWorkspaceDir?: string,
): string {
  return resolve(configuredWorkspaceDir?.trim() || resolve(projectRoot, 'workspace'))
}

const WORKSPACE_DIR = resolveWorkspaceDirectory(
  PROJECT_ROOT,
  process.env.MOK_WORKSPACE_DIR,
)
const CONFIG_DIR = resolve(WORKSPACE_DIR, 'config')
const CONFIG_FILE = resolve(CONFIG_DIR, 'settings.json')

/** 返回项目根目录的绝对路径，供其他模块复用 */
export function getProjectRoot(): string {
  return PROJECT_ROOT
}

/** 返回配置、工作流和生成素材共用的稳定数据目录。 */
export function getWorkspaceDir(): string {
  return WORKSPACE_DIR
}

export function resolveWorkspaceDataPathFrom(
  workspaceDir: string,
  value: string,
): string {
  if (isAbsolute(value)) return value

  const segments = value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.')
  if (segments[0] === 'workspace') segments.shift()
  return resolve(workspaceDir, ...segments)
}

export function resolveWorkspaceDataPath(value: string): string {
  return resolveWorkspaceDataPathFrom(WORKSPACE_DIR, value)
}

export function resolveRuntimePath(value: string): string {
  if (isAbsolute(value)) return value
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '')
  return normalized === 'workspace' || normalized.startsWith('workspace/')
    ? resolveWorkspaceDataPath(normalized)
    : resolve(PROJECT_ROOT, value)
}

/** 返回输出目录的绝对路径（基于 settings.outputDir） */
export function resolveOutputDir(outputDir: string): string {
  return resolveWorkspaceDataPath(outputDir)
}

/**
 * 浅合并一层：磁盘文件中的字段覆盖默认值。
 * - 若磁盘文件不存在或解析失败，返回默认值副本。
 * - 若字段类型不匹配，使用默认值兜底（避免脏数据破坏运行）。
 */
function mergeWithDefaults(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const obj = raw as Record<string, unknown>
  const unknownFields: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    if (!(key in DEFAULT_SETTINGS)) {
      unknownFields[key] = obj[key]
    }
  }
  const result: Settings = { ...DEFAULT_SETTINGS, ...unknownFields }

  ;(Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).forEach((key) => {
    const value = obj[key as string]
    if (value === undefined || value === null) return
    const defaultValue = DEFAULT_SETTINGS[key]
    if (key === 'modelConfigs') {
      ;(result[key] as unknown) = normalizeModelConfigs(value)
      return
    }
    // 数值类型校验
    if (typeof defaultValue === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        ;(result[key] as unknown) = value
      }
      return
    }
    // 布尔类型校验
    if (typeof defaultValue === 'boolean') {
      if (typeof value === 'boolean') {
        ;(result[key] as unknown) = value
      }
      return
    }
    // 字符串数组类型校验
    if (Array.isArray(defaultValue)) {
      if (Array.isArray(value)) {
        const items = value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
        ;(result[key] as unknown) = Array.from(new Set(items))
      }
      return
    }
    // 字符串类型校验
    if (typeof value === 'string') {
      ;(result[key] as unknown) = value
    }
  })

  return result
}

/** 读取 settings；文件不存在或损坏时返回默认值 */
export async function readSettings(): Promise<Settings> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf8')
    const parsed = JSON.parse(content) as unknown
    return mergeWithDefaults(parsed)
  } catch (err) {
    // 文件不存在或解析失败 → 返回默认值
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || err instanceof SyntaxError) {
      return { ...DEFAULT_SETTINGS }
    }
    throw err
  }
}

/** 写入 settings；自动创建目录 */
export async function writeSettings(settings: Settings): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  const content = JSON.stringify(settings, null, 2)
  await writeFile(CONFIG_FILE, content, 'utf8')
}
