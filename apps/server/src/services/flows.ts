// 即梦 Flow 后端 - Flows service
// 封装工作流 CRUD 业务逻辑：读写 workspace/flows/<id>.json。
// 参考 PRD 8.5（本地文件管理）、10.2（工作流 API）、11.1（Flow 数据模型）。

import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getProjectRoot } from '../config'
import type {
  Flow,
  FlowSummary,
  UpdateFlowRequest,
} from '@jimeng-flow/shared/flow'

// flows 目录：<root>/workspace/flows/
const FLOWS_DIR = resolve(getProjectRoot(), 'workspace/flows')

/** 生成形如 flow_<timestamp>_<random> 的 id */
function generateFlowId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `flow_${ts}_${rand}`
}

/** 当前 ISO 8601 时间字符串 */
function nowIso(): string {
  return new Date().toISOString()
}

/** 单个 flow 文件路径 */
function flowFile(id: string): string {
  return resolve(FLOWS_DIR, `${id}.json`)
}

/** 确保 flows 目录存在 */
async function ensureDir(): Promise<void> {
  await mkdir(FLOWS_DIR, { recursive: true })
}

/**
 * 列出所有工作流摘要。
 * - 扫描 flows 目录下所有 .json 文件
 * - 按 updatedAt 降序排列（最近编辑在前）
 * - 目录不存在时返回空数组
 */
export async function listFlows(): Promise<FlowSummary[]> {
  let files: string[]
  try {
    files = await readdir(FLOWS_DIR)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw err
  }

  const summaries: FlowSummary[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const id = file.slice(0, -'.json'.length)
    try {
      const content = await readFile(flowFile(id), 'utf8')
      const flow = JSON.parse(content) as Flow
      summaries.push({
        id: flow.id,
        name: flow.name,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        nodeCount: Array.isArray(flow.nodes) ? flow.nodes.length : 0,
      })
    } catch {
      // 损坏文件跳过，不影响整体列表
    }
  }

  summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return summaries
}

/**
 * 读取单个工作流。
 * - 文件不存在时抛出 'FLOW_NOT_FOUND' 错误
 */
export async function getFlow(id: string): Promise<Flow> {
  try {
    const content = await readFile(flowFile(id), 'utf8')
    return JSON.parse(content) as Flow
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      const error = new Error(`工作流不存在: ${id}`)
      ;(error as Error & { code: string }).code = 'FLOW_NOT_FOUND'
      throw error
    }
    throw err
  }
}

/**
 * 创建新工作流。
 * @param name 可选名称，默认 "未命名工作流"
 * @returns 新建的 Flow（已写盘）
 */
export async function createFlow(name?: string): Promise<Flow> {
  await ensureDir()
  const now = nowIso()
  const flow: Flow = {
    id: generateFlowId(),
    name: name?.trim() || '未命名工作流',
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  }
  await writeFile(flowFile(flow.id), JSON.stringify(flow, null, 2), 'utf8')
  return flow
}

/**
 * 部分更新工作流。
 * - 合并 name / nodes / edges
 * - 更新 updatedAt
 * @returns 最新 Flow
 */
export async function updateFlow(
  id: string,
  patch: UpdateFlowRequest,
): Promise<Flow> {
  const current = await getFlow(id)
  const next: Flow = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  }
  await writeFile(flowFile(id), JSON.stringify(next, null, 2), 'utf8')
  return next
}

/**
 * 删除工作流文件。
 * - 文件不存在视为已删除（幂等）
 */
export async function deleteFlow(id: string): Promise<void> {
  try {
    await unlink(flowFile(id))
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    throw err
  }
}
