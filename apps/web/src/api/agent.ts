// 即梦 Flow 前端 - Agent API client
// 封装 Agent 相关的 fetch 调用。Vite proxy 已把 /api 转发到后端 8787。
// 参考 PRD 8.7、10.5、12.2（错误处理）。

import type {
  PromptOptimizeRequest,
  PromptOptimizeResponse,
} from '@jimeng-flow/shared/agentMessage'

/** POST /api/agent/prompt-optimize - 优化 Prompt */
export async function optimizePrompt(
  req: PromptOptimizeRequest,
): Promise<PromptOptimizeResponse> {
  const res = await fetch('/api/agent/prompt-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = `Agent 调用失败：${res.status} ${res.statusText}`
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // 非 JSON 错误体，保留默认 message
    }
    throw new Error(message)
  }
  return (await res.json()) as PromptOptimizeResponse
}
