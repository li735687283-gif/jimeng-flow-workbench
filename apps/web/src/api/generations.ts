// 即梦 Flow 前端 - Generations API client
// 封装与后端 /api/generations 的交互。
// Vite proxy 已把 /api 转发到后端 8787，前端用相对路径即可。
// 参考 PRD 10.3、9.3 生成数据流、12.2 错误处理。

import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'

/** 统一解析后端错误响应，返回可读 message */
async function parseError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string }
    if (parsed.message) return parsed.message
    if (parsed.error) return parsed.error
  } catch {
    // 非 JSON 错误体
  }
  return text.length > 300 ? `${text.slice(0, 300)}...` : text
}

/** POST /api/generations - 创建生成任务 */
export async function createGeneration(
  req: GenerationRequest,
): Promise<GenerationResponse> {
  const res = await fetch('/api/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const msg = await parseError(
      res,
      `生成请求失败：${res.status} ${res.statusText}`,
    )
    throw new Error(msg)
  }
  return (await res.json()) as GenerationResponse
}

/** GET /api/generations/:id - 查询生成任务状态 */
export async function getGeneration(id: string): Promise<GenerationResponse> {
  const res = await fetch(`/api/generations/${encodeURIComponent(id)}`)
  if (!res.ok) {
    const msg = await parseError(
      res,
      `查询生成任务失败：${res.status} ${res.statusText}`,
    )
    throw new Error(msg)
  }
  return (await res.json()) as GenerationResponse
}

/** POST /api/generations/:id/retry - 重试生成任务 */
export async function retryGeneration(
  id: string,
): Promise<GenerationResponse> {
  const res = await fetch(
    `/api/generations/${encodeURIComponent(id)}/retry`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
  )
  if (!res.ok) {
    const msg = await parseError(
      res,
      `重试生成任务失败：${res.status} ${res.statusText}`,
    )
    throw new Error(msg)
  }
  return (await res.json()) as GenerationResponse
}
