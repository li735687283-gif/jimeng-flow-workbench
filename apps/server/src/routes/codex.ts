// OpenAI Codex CLI 状态路由
// GET /api/codex/status  检测本机 codex CLI 与登录态是否可用。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { getCodexImageProviderStatus } from '../services/codexImage'

const codexRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/codex/status', async () => {
    return getCodexImageProviderStatus()
  })
}

export default codexRoutes
