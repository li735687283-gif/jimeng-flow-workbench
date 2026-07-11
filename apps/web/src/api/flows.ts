// 即梦 Flow 前端 - Flows API client
// 封装工作流 CRUD 的 fetch 调用。
// Vite proxy 已把 /api 转发到后端 8787，前端直接用相对路径即可。
// 参考 PRD 10.2。

import type {
  Flow,
  FlowSummary,
  CreateFlowRequest,
  UpdateFlowRequest,
  DuplicateFlowRequest,
} from '@jimeng-flow/shared/flow'

type FlowApiErrorPayload = {
  message?: unknown
  code?: unknown
}

export class FlowApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'FlowApiError'
  }
}

async function readFlowApiError(
  res: Response,
  fallback: string,
): Promise<FlowApiError> {
  const payload = (await res.json().catch(() => null)) as FlowApiErrorPayload | null
  const message = typeof payload?.message === 'string' ? payload.message : fallback
  const code = typeof payload?.code === 'string' ? payload.code : undefined
  return new FlowApiError(message, res.status, code)
}

export function isFlowNotFoundError(error: unknown): error is FlowApiError {
  return (
    error instanceof FlowApiError &&
    error.status === 404 &&
    error.code === 'FLOW_NOT_FOUND'
  )
}

/** 列出所有工作流摘要 */
export async function listFlows(): Promise<FlowSummary[]> {
  const res = await fetch('/api/flows', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`获取工作流列表失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as FlowSummary[]
}

/** 读取单个工作流 */
export async function getFlow(id: string): Promise<Flow> {
  const res = await fetch(`/api/flows/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw await readFlowApiError(
      res,
      `读取工作流失败：${res.status} ${res.statusText}`,
    )
  }
  return (await res.json()) as Flow
}

/** 创建新工作流 */
export async function createFlow(body?: CreateFlowRequest): Promise<Flow> {
  const res = await fetch('/api/flows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    throw new Error(`创建工作流失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Flow
}

/** 更新工作流（部分字段） */
export async function updateFlow(
  id: string,
  body: UpdateFlowRequest,
): Promise<Flow> {
  const res = await fetch(`/api/flows/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`保存工作流失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Flow
}

/** 删除工作流 */
export async function deleteFlow(id: string): Promise<void> {
  const res = await fetch(`/api/flows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(`删除工作流失败：${res.status} ${res.statusText}`)
  }
}

/** 重命名工作流 */
export async function renameFlow(id: string, name: string): Promise<Flow> {
  return updateFlow(id, { name })
}

/** 复制工作流 */
export async function duplicateFlow(
  id: string,
  body?: DuplicateFlowRequest,
): Promise<Flow> {
  const res = await fetch(`/api/flows/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    throw new Error(`复制工作流失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Flow
}
