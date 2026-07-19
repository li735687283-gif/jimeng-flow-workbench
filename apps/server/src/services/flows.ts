// 即梦 Flow 后端 - Flows service
// 封装工作流 CRUD 业务逻辑：读写 workspace/flows/<id>.json。
// 参考 PRD 8.5（本地文件管理）、10.2（工作流 API）、11.1（Flow 数据模型）。

import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getWorkspaceDir } from '../config'
import type {
  Flow,
  FlowNode,
  FlowSummary,
  UpdateFlowRequest,
} from '@jimeng-flow/shared/flow'

// flows 目录：<root>/workspace/flows/
const FLOWS_DIR = resolve(getWorkspaceDir(), 'flows')
// 合法 flow ID 校验，避免路径穿越
const FLOW_ID_PATTERN = /^flow_[a-z0-9_]+$/

/** 生成形如 flow_<timestamp>_<random> 的 id */
function generateFlowId(): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(4).toString('hex')
  return `flow_${ts}_${rand}`
}

/** 当前 ISO 8601 时间字符串 */
function nowIso(): string {
  return new Date().toISOString()
}

function hasStringValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasStringArrayValue(value: unknown): boolean {
  return Array.isArray(value) && value.some(hasStringValue)
}

function hasGeneratedAsset(node: FlowNode | undefined): boolean {
  return (
    hasStringValue(node?.data.assetId) || hasStringArrayValue(node?.data.assetIds)
  )
}

function extractCoverAssetId(flow: Flow): string | null {
  if (!Array.isArray(flow.nodes)) return null

  const isAssetId = (v: unknown): v is string =>
    typeof v === 'string' && v.startsWith('asset_')

  for (const node of flow.nodes) {
    const data = node.data as Record<string, unknown>
    if (isAssetId(data.assetId)) return data.assetId
    if (Array.isArray(data.outputAssetIds)) {
      const found = data.outputAssetIds.find(isAssetId)
      if (found) return found
    }
    if (Array.isArray(data.assetIds)) {
      const found = data.assetIds.find(isAssetId)
      if (found) return found
    }
  }

  for (const node of flow.nodes) {
    const data = node.data as Record<string, unknown>
    const refs = data.references
    if (Array.isArray(refs)) {
      for (const ref of refs) {
        if (ref && typeof ref === 'object' && isAssetId((ref as Record<string, unknown>).assetId)) {
          return (ref as Record<string, unknown>).assetId as string
        }
      }
    }
    if (Array.isArray(data.inputImageAssetIds)) {
      const found = data.inputImageAssetIds.find(isAssetId)
      if (found) return found
    }
  }

  return null
}

function shouldKeepOmittedCurrentNode(
  node: FlowNode,
  deletedNodeIds: ReadonlySet<string>,
): boolean {
  if (deletedNodeIds.has(node.id)) return false
  return hasGeneratedAsset(node)
}

function getUpdatedAtMs(node: FlowNode | undefined): number | null {
  const value = node?.data.updatedAt
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function shouldKeepCurrentGeneratedData(
  current: FlowNode | undefined,
  incoming: FlowNode,
): current is FlowNode {
  if (!current || !hasGeneratedAsset(current)) return false
  if (!hasGeneratedAsset(incoming)) return true

  const currentUpdatedAt = getUpdatedAtMs(current)
  const incomingUpdatedAt = getUpdatedAtMs(incoming)
  return (
    currentUpdatedAt !== null &&
    incomingUpdatedAt !== null &&
    currentUpdatedAt > incomingUpdatedAt
  )
}

function mergeGeneratedImageData(
  incomingData: FlowNode['data'],
  currentData: FlowNode['data'],
): FlowNode['data'] {
  return {
    ...incomingData,
    status: currentData.status,
    error: currentData.error,
    assetId: currentData.assetId,
    outputAssetIds: currentData.outputAssetIds,
    generationId: currentData.generationId,
    prompt: currentData.prompt,
    model: currentData.model,
    width: currentData.width,
    height: currentData.height,
    count: currentData.count,
    quality: currentData.quality,
    ratio: currentData.ratio,
    resolution: currentData.resolution,
    inputImageAssetIds: currentData.inputImageAssetIds,
    generationRuns: currentData.generationRuns,
    updatedAt: currentData.updatedAt,
  }
}

function mergeGeneratedVideoData(
  incomingData: FlowNode['data'],
  currentData: FlowNode['data'],
): FlowNode['data'] {
  return {
    ...incomingData,
    status: currentData.status,
    error: currentData.error,
    assetIds: currentData.assetIds,
    generationId: currentData.generationId,
    generationRuns: currentData.generationRuns,
    prompt: currentData.prompt,
    model: currentData.model,
    inputImageAssetIds: currentData.inputImageAssetIds,
    references: currentData.references,
    mode: currentData.mode,
    aspectRatio: currentData.aspectRatio,
    resolution: currentData.resolution,
    quality: currentData.quality,
    durationSeconds: currentData.durationSeconds,
    count: currentData.count,
    generateAudio: currentData.generateAudio,
    updatedAt: currentData.updatedAt,
  }
}

function mergeGeneratedNodeData(
  incoming: FlowNode,
  current: FlowNode,
): FlowNode['data'] {
  if (incoming.type === 'video' || current.type === 'video') {
    return mergeGeneratedVideoData(incoming.data, current.data)
  }
  return mergeGeneratedImageData(incoming.data, current.data)
}

export function mergeNodesForFlowUpdate(
  currentNodes: FlowNode[],
  incomingNodes: FlowNode[],
  deletedNodeIds: ReadonlySet<string> = new Set(),
): FlowNode[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]))
  const incomingIds = new Set(incomingNodes.map((node) => node.id))

  const merged = incomingNodes.map((incoming) => {
    const current = currentById.get(incoming.id)
    if (!shouldKeepCurrentGeneratedData(current, incoming)) {
      return incoming
    }

    return {
      ...incoming,
      data: mergeGeneratedNodeData(incoming, current),
    }
  })

  for (const current of currentNodes) {
    if (
      !incomingIds.has(current.id) &&
      shouldKeepOmittedCurrentNode(current, deletedNodeIds)
    ) {
      merged.push(current)
    }
  }

  return merged
}

/** 校验 flow ID 格式，防止路径穿越 */
function validateFlowId(id: string): void {
  if (!FLOW_ID_PATTERN.test(id)) {
    const error = new Error(`无效的工作流 ID: ${id}`)
    ;(error as Error & { code: string }).code = 'FLOW_NOT_FOUND'
    throw error
  }
}

/** 单个 flow 文件路径（仅在 ID 校验通过后使用） */
function flowFile(id: string): string {
  const abs = resolve(FLOWS_DIR, `${id}.json`)
  // 双重防御：确保最终路径仍在 FLOWS_DIR 内
  if (!abs.startsWith(FLOWS_DIR + sep)) {
    const error = new Error(`工作流不存在: ${id}`)
    ;(error as Error & { code: string }).code = 'FLOW_NOT_FOUND'
    throw error
  }
  return abs
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
    // 跳过不符合 ID 格式的文件名
    if (!FLOW_ID_PATTERN.test(id)) continue
    try {
      const content = await readFile(flowFile(id), 'utf8')
      const flow = JSON.parse(content) as Flow
      summaries.push({
        id: flow.id,
        name: flow.name,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        nodeCount: Array.isArray(flow.nodes) ? flow.nodes.length : 0,
        coverAssetId: extractCoverAssetId(flow),
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
  validateFlowId(id)
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
    // JSON 解析失败时转换为友好错误
    if (err instanceof SyntaxError) {
      const error = new Error(`工作流文件损坏: ${id}`)
      ;(error as Error & { code: string }).code = 'FLOW_NOT_FOUND'
      throw error
    }
    throw err
  }
}

/**
 * 创建新工作流。
 * @param name 可选名称，默认 "无限画布"
 * @returns 新建的 Flow（已写盘）
 */
export async function createFlow(name?: string): Promise<Flow> {
  await ensureDir()
  const now = nowIso()
  const flow: Flow = {
    id: generateFlowId(),
    name: name?.trim() || '无限画布',
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
  validateFlowId(id)
  const current = await getFlow(id)
  const deletedNodeIds = new Set(
    Array.isArray(patch.deletedNodeIds) ? patch.deletedNodeIds : [],
  )
  const patchWithMergedNodes: UpdateFlowRequest = {
    ...patch,
    nodes: Array.isArray(patch.nodes)
      ? mergeNodesForFlowUpdate(current.nodes, patch.nodes, deletedNodeIds)
      : patch.nodes,
    deletedNodeIds: undefined,
  }
  const next: Flow = {
    ...current,
    ...patchWithMergedNodes,
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
  validateFlowId(id)
  try {
    await unlink(flowFile(id))
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    throw err
  }
}

/**
 * 复制工作流：复制全部节点/连线，生成新 id。
 * @param id 原工作流 id
 * @param nameOverride 可选名称覆盖，默认 "原名 副本"
 */
export async function duplicateFlow(id: string, nameOverride?: string): Promise<Flow> {
  const current = await getFlow(id)
  const newId = generateFlowId()
  const now = nowIso()

  let nodeCounter = 0
  let edgeCounter = 0
  const newNodeId = () => `node_${Date.now().toString(36)}_${nodeCounter++}_${randomBytes(2).toString('hex')}`
  const newEdgeId = () => `edge_${Date.now().toString(36)}_${edgeCounter++}_${randomBytes(2).toString('hex')}`

  const idMap = new Map<string, string>()
  for (const node of current.nodes) {
    idMap.set(node.id, newNodeId())
  }
  for (const edge of current.edges) {
    idMap.set(edge.id, newEdgeId())
  }

  const remappedNodes = current.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id) ?? node.id,
  }))
  const remappedEdges = current.edges.map((edge) => ({
    ...edge,
    id: idMap.get(edge.id) ?? edge.id,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
  }))

  const copy: Flow = {
    ...current,
    id: newId,
    name: nameOverride?.trim() || `${current.name} 副本`,
    nodes: remappedNodes,
    edges: remappedEdges,
    createdAt: now,
    updatedAt: now,
  }

  await mkdir(FLOWS_DIR, { recursive: true })
  await writeFile(flowFile(newId), JSON.stringify(copy, null, 2), 'utf8')
  return copy
}
