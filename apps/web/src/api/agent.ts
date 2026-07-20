// 即梦 Flow 前端 - Agent API client
// 对话式协议：POST /api/agent/chat，模型自由回复并返回工具调用，
// 工具由前端按执行模式（手动确认 / 全自动）执行后再把结果带回对话。

import type {
  AgentChatRequest,
  AgentChatResponse,
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

/** POST /api/agent/chat - 一轮 Agent 对话，返回回复与待执行的工具调用 */
export async function sendAgentChat(
  req: AgentChatRequest,
): Promise<AgentChatResponse> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(getAgentApiErrorMessage(res.status, res.statusText, text))
  }
  return (await res.json()) as AgentChatResponse
}
