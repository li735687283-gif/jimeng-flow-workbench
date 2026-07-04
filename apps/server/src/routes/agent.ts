// 即梦 Flow 后端 - Agent 路由
// POST /api/agent/prompt-optimize  Prompt 优化接口
// 参考 PRD 8.7、10.5、12.2（错误处理）。
// 注意：本文件不注册到 index.ts，由主代理负责集成。
// 错误处理参考 llm.ts（400 入参校验、502 上游失败）。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { PromptOptimizeRequest, PromptOptimizeResponse } from '@jimeng-flow/shared/agentMessage'
import { optimizePrompt, AgentError } from '../services/agent'

const agentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/agent/prompt-optimize
  // body: PromptOptimizeRequest → 返回 PromptOptimizeResponse
  // 参考 PRD 8.7、10.5。
  app.post<{ Body: PromptOptimizeRequest }>(
    '/api/agent/prompt-optimize',
    async (req, reply) => {
      const body = req.body ?? ({} as PromptOptimizeRequest)
      const userIdea =
        typeof body.userIdea === 'string' ? body.userIdea.trim() : ''

      if (!userIdea) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'userIdea 不能为空',
        })
      }

      try {
        const response: PromptOptimizeResponse = await optimizePrompt(body)
        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const code = err instanceof AgentError ? err.code : 'LLM_CALL_FAILED'
        app.log.error({ err, code }, '[agent/prompt-optimize] 调用失败')
        return reply.code(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message,
          code,
        })
      }
    },
  )
}

export default agentRoutes
