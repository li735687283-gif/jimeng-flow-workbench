import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { ApiHealthResponse } from '@jimeng-flow/shared'
import settingsRoutes from './routes/settings'
import flowsRoutes from './routes/flows'
import llmRoutes from './routes/llm'
import assetsRoutes from './routes/assets'
import generationsRoutes from './routes/generations'
import agentRoutes from './routes/agent'
import codexRoutes from './routes/codex'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = '0.0.0.0'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

app.get('/api/health', async () => {
  const body: ApiHealthResponse = {
    status: 'ok',
    service: 'jimeng-flow-server',
    timestamp: Date.now(),
  }
  return body
})

const start = async () => {
  try {
    // 先注册 cors，再注册业务路由
    await app.register(cors, { origin: true })
    await app.register(settingsRoutes)
    await app.register(flowsRoutes)
    await app.register(llmRoutes)
    await app.register(assetsRoutes)
    await app.register(generationsRoutes)
    await app.register(agentRoutes)
    await app.register(codexRoutes)
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`即梦 Flow 后端监听 http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
