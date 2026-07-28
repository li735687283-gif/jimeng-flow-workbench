// 即梦 Flow 前端 - 宫格切分流程
// 调服务端 crop-regions 接口把宫格图裁成独立素材，
// 再仿 createAdditionalImageNodes 在源节点右侧纵向铺开结果节点。

import { addEdge } from '@xyflow/react'
import type { CropRegion } from '@jimeng-flow/shared/grid'
import { cropAssetRegions } from '../api/assets'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import type { BaseNodeData } from '../types/nodeTypes'

const GRID_CROP_NODE_GAP = 120
const GRID_CROP_NODE_STACK_GAP = 40

function getSourceAssetId(data: BaseNodeData): string {
  if (typeof data.assetId === 'string' && data.assetId.trim()) {
    return data.assetId.trim()
  }
  const outputs = data.outputAssetIds
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === 'string' && item.trim()) return item.trim()
    }
  }
  return ''
}

/**
 * 宫格切分：把源节点的图片按 regions 裁成 N 张素材，
 * 在源节点右侧依次创建 N 个图片节点（type:'cut' 连线），
 * 返回新建节点 id；失败时把错误写到源节点并抛出。
 */
export async function runGridCrop(
  sourceNodeId: string,
  regions: CropRegion[],
): Promise<string[]> {
  if (regions.length === 0) return []
  const store = useCanvasStore.getState()
  const source = store.nodes.find((node) => node.id === sourceNodeId)
  if (!source) return []
  const sourceData = source.data as BaseNodeData
  const assetId = getSourceAssetId(sourceData)
  if (!assetId) return []

  try {
    const assets = await cropAssetRegions(assetId, regions)
    const sourceWidth =
      source.measured?.width ?? source.width ?? 200
    const sourceHeight =
      source.measured?.height ?? source.height ?? 150
    const baseX = source.position.x + sourceWidth + GRID_CROP_NODE_GAP
    const baseY = source.position.y
    const sourceTitle = sourceData.title ?? '图片'

    const nodeIds: string[] = []
    assets.forEach((asset, index) => {
      const nodeId = useCanvasStore
        .getState()
        .addNode('image', {
          x: baseX,
          y: baseY + index * (sourceHeight + GRID_CROP_NODE_STACK_GAP),
        })
      if (!nodeId) return
      useCanvasStore.getState().updateNodeData(nodeId, {
        assetId: asset.id,
        title: `${sourceTitle} 第${index + 1}格`,
        status: 'success',
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      nodeIds.push(nodeId)
    })

    useCanvasStore.setState((state) => ({
      edges: nodeIds.reduce(
        (edges, nodeId) =>
          addEdge(
            {
              source: sourceNodeId,
              target: nodeId,
              sourceHandle: null,
              targetHandle: null,
              type: 'cut',
            },
            edges,
          ),
        state.edges,
      ),
    }))

    await useFlowStore.getState().saveCurrent()
    return nodeIds
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    useCanvasStore.getState().updateNodeData(sourceNodeId, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    void useFlowStore.getState().saveCurrent().catch(() => undefined)
    throw error instanceof Error ? error : new Error(message)
  }
}
