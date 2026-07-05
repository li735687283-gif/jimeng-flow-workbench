// 即梦 Flow 前端 - LLM API client
// 封装 LLM 相关的 fetch 调用。Vite proxy 已把 /api 转发到后端 8787。
// 参考 PRD 10.6、7.6、8.9、12.2。

import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmModelInfo,
  LlmTranscribeRequest,
  LlmTranscribeResponse,
  TextNodeRunRequest,
} from '@jimeng-flow/shared/textNode'

/** GET /api/llm/models - 拉取可用 LLM 模型列表 */
export async function listLlmModels(): Promise<LlmModelInfo[]> {
  const res = await fetch('/api/llm/models', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`获取模型列表失败：${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as LlmModelInfo[]
  return Array.isArray(data) ? data : []
}

/** POST /api/llm/chat - 通用 LLM 对话 */
export async function chatWithLlm(
  req: LlmChatRequest,
): Promise<LlmChatResponse> {
  const res = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `LLM 调用失败：${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // 非 JSON 错误体，保留默认 message
    }
    throw new Error(message)
  }
  return (await res.json()) as LlmChatResponse
}

/** POST /api/llm/transcriptions - 音频转文字 */
export async function transcribeAudio(
  req: LlmTranscribeRequest,
): Promise<LlmTranscribeResponse> {
  const res = await fetch('/api/llm/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `语音转文字失败：${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // 非 JSON 错误体，保留默认 message
    }
    throw new Error(message)
  }
  return (await res.json()) as LlmTranscribeResponse
}

/** POST /api/text-nodes/:id/run - 关联文本节点的 LLM 调用（响应带 nodeId） */
export async function runTextNode(
  nodeId: string,
  req: TextNodeRunRequest,
): Promise<LlmChatResponse> {
  const res = await fetch(`/api/text-nodes/${encodeURIComponent(nodeId)}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `文本节点 LLM 调用失败：${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // 非 JSON 错误体
    }
    throw new Error(message)
  }
  return (await res.json()) as LlmChatResponse
}
