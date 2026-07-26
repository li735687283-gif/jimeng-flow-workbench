import type { AgentToolResult } from '@jimeng-flow/shared/agentMessage'

const BACKGROUND_MEDIA_TOOLS = new Set<AgentToolResult['tool']>([
  'generate_image',
  'generate_video',
  'edit_image',
])

/**
 * 媒体任务一旦成功交给画布，就结束当前 Agent 回合。
 * 节点继续通过自己的任务 ID 和订阅更新，不再占用对话输入框。
 */
export function shouldFinishAgentTurnAfterToolResults(
  results: AgentToolResult[],
): boolean {
  return results.some(
    (result) => result.ok && BACKGROUND_MEDIA_TOOLS.has(result.tool),
  )
}
