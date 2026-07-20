// 即梦 Flow 后端 - Agent 路由
// POST /api/agent/chat  对话接口（自然语言回复 + 工具调用）

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type {
  AgentChatRequest,
  AgentChatResponse,
} from '@jimeng-flow/shared/agentMessage'
import { chatWithAgent, AgentError } from '../services/agent'

const agentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body: AgentChatRequest }>(
    '/api/agent/chat',
    async (req, reply) => {
      const body = req.body ?? ({} as AgentChatRequest)
      if (!Array.isArray(body.history) || body.history.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'history 不能为空',
        })
      }

      try {
        const response: AgentChatResponse = await chatWithAgent(body)
        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const code = err instanceof AgentError ? err.code : 'LLM_CALL_FAILED'
        app.log.error({ err, code }, '[agent/chat] 调用失败')
        const status = code === 'INVALID_INPUT' ? 400 : 502
        return reply.code(status).send({
          statusCode: status,
          error: status === 400 ? 'Bad Request' : 'Bad Gateway',
          message,
          code,
        })
      }
    },
  )
}

export default agentRoutes
