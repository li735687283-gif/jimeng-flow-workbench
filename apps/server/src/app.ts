import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import type { ApiHealthResponse } from '@jimeng-flow/shared'
import settingsRoutes from './routes/settings'
import flowsRoutes from './routes/flows'
import llmRoutes from './routes/llm'
import assetsRoutes from './routes/assets'
import generationsRoutes from './routes/generations'
import agentRoutes from './routes/agent'
import codexRoutes from './routes/codex'
import videosRoutes from './routes/videos'
import {
  installLocalAccessGuard,
  isAllowedLocalRequest,
} from './security/localAccess'

export interface CreateAppOptions {
  logger?: boolean
}

export function createApp(
  options: CreateAppOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  installLocalAccessGuard(app)
  app.register(cors, {
    origin(origin, callback) {
      callback(null, isAllowedLocalRequest({ origin }))
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

  app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024,
      files: 1,
    },
  })
  app.register(settingsRoutes)
  app.register(flowsRoutes)
  app.register(llmRoutes)
  app.register(assetsRoutes)
  app.register(generationsRoutes)
  app.register(agentRoutes)
  app.register(codexRoutes)
  app.register(videosRoutes)

  return app
}
