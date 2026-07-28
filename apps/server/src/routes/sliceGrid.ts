// 即梦 Flow 后端 - 宫格切分路由
// POST /api/assets/:assetId/crop-regions   按像素区域裁剪图片素材，每格存为独立素材
// 只做 HTTP 边界：参数校验、状态码映射；裁剪与落盘在 services/sliceGrid。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { CropRegionsRequest } from '@jimeng-flow/shared/grid'
import { cropAssetRegions, SliceGridError } from '../services/sliceGrid'

const sliceGridRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/assets/:assetId/crop-regions
  // body: CropRegionsRequest → CropRegionsResponse
  app.post<{ Params: { assetId: string }; Body: CropRegionsRequest }>(
    '/api/assets/:assetId/crop-regions',
    async (req, reply) => {
      const assetId = req.params.assetId
      if (!assetId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'assetId 不能为空',
        })
      }
      try {
        const result = await cropAssetRegions(assetId, req.body ?? {})
        return reply.code(201).send(result)
      } catch (err) {
        if (err instanceof SliceGridError) {
          return reply.code(err.statusCode).send({
            statusCode: err.statusCode,
            error:
              err.statusCode === 404
                ? 'Not Found'
                : err.statusCode >= 500
                  ? 'Internal Server Error'
                  : 'Bad Request',
            message: err.message,
          })
        }
        const message = err instanceof Error ? err.message : String(err)
        app.log.error({ err, assetId }, '[assets/crop-regions] 裁剪失败')
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message,
        })
      }
    },
  )
}

export default sliceGridRoutes
