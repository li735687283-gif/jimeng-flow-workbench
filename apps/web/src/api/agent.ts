// 即梦 Flow 前端 - Agent API client
// 封装 Agent 相关的 fetch 调用。Vite proxy 已把 /api 转发到后端 8787。
// 参考 PRD 8.7、10.5、12.2（错误处理）。

import type {
  PromptOptimizeRequest,
  PromptOptimizeResponse,
} from '@jimeng-flow/shared/agentMessage'

export function getAgentApiErrorMessage(
  status: number,
  statusText: string,
  responseText: string,
): string {
  const fallback = `Agent 调用失败：${status} ${statusText}`
  try {
    const parsed = JSON.parse(responseText) as { message?: string; code?: string }
    if (parsed.code === 'PARSE_FAILED') {
      return '模型返回格式异常，本次没有生成新结果。请重试或切换模型。'
    }
    return parsed.message || fallback
  } catch {
    return fallback
  }
}

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
    throw new Error(getAgentApiErrorMessage(res.status, res.statusText, text))
  }
  return (await res.json()) as PromptOptimizeResponse
}
