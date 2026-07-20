// OpenAI Codex CLI 状态路由
// GET  /api/codex/status  检测本机 codex CLI 与登录态是否可用。
// POST /api/codex/login   一键重新登录(logout 清坏态 + 后台拉起浏览器登录)。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { getCodexImageProviderStatus, startCodexLogin } from '../services/codexImage'

const codexRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/codex/status', async () => {
    return getCodexImageProviderStatus()
  })

  app.post('/api/codex/login', async () => {
    return startCodexLogin()
  })
}

export default codexRoutes
