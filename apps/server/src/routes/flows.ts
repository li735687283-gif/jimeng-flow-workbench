// 即梦 Flow 后端 - Flows 路由
// GET    /api/flows        列出所有工作流摘要
// GET    /api/flows/:id    读取单个工作流
// POST   /api/flows        创建新工作流（body 可含 name）
// PUT    /api/flows/:id    更新工作流（body 含 name/nodes/edges）
// DELETE /api/flows/:id    删除工作流
// 参考 PRD 10.2、8.5、11.1。
// 注意：本 plugin 仅导出，不在本文件中注册到 app；
// 由 apps/server/src/index.ts 集成阶段 register。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type {
  CreateFlowRequest,
  Flow,
  FlowSummary,
  UpdateFlowRequest,
} from '@jimeng-flow/shared/flow'
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
} from '../services/flows'

const flowsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/flows → FlowSummary[]
  app.get('/api/flows', async (): Promise<FlowSummary[]> => {
    return listFlows()
  })

  // GET /api/flows/:id → Flow
  app.get<{ Params: { id: string } }>(
    '/api/flows/:id',
    async (req, reply): Promise<Flow | unknown> => {
      try {
        return await getFlow(req.params.id)
      } catch (err) {
        if ((err as Error & { code?: string }).code === 'FLOW_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: (err as Error).message,
            code: 'FLOW_NOT_FOUND',
          })
        }
        throw err
      }
    },
  )

  // POST /api/flows → 创建新工作流
  app.post<{ Body: CreateFlowRequest }>(
    '/api/flows',
    async (req, reply): Promise<Flow | unknown> => {
      const body = req.body ?? {}
      if (typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: '请求体必须为对象',
        })
      }
      const name =
        typeof body.name === 'string' ? body.name : undefined
      return createFlow(name)
    },
  )

  // PUT /api/flows/:id → 更新工作流
  app.put<{ Params: { id: string }; Body: UpdateFlowRequest }>(
    '/api/flows/:id',
    async (req, reply): Promise<Flow | unknown> => {
      const body = req.body ?? {}
      if (typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: '请求体必须为对象',
        })
      }

      // 字段白名单 + 类型粗校验
      const safePatch: UpdateFlowRequest = {}
      if (typeof body.name === 'string') {
        safePatch.name = body.name
      }
      if (Array.isArray(body.nodes)) {
        safePatch.nodes = body.nodes
      }
      if (Array.isArray(body.edges)) {
        safePatch.edges = body.edges
      }
      if (Array.isArray(body.deletedNodeIds)) {
        safePatch.deletedNodeIds = body.deletedNodeIds.filter(
          (id): id is string => typeof id === 'string',
        )
      }

      try {
        return await updateFlow(req.params.id, safePatch)
      } catch (err) {
        if ((err as Error & { code?: string }).code === 'FLOW_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: (err as Error).message,
            code: 'FLOW_NOT_FOUND',
          })
        }
        throw err
      }
    },
  )

  // DELETE /api/flows/:id → 删除工作流
  app.delete<{ Params: { id: string } }>(
    '/api/flows/:id',
    async (req): Promise<{ ok: true; id: string }> => {
      await deleteFlow(req.params.id)
      return { ok: true, id: req.params.id }
    },
  )
}

export default flowsRoutes
