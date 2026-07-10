/**
 * 根据当前 edges 回填所有文本节点的 inputImageAssetIds。
 * 用于：打开旧工作流、或连线时未写回 data 的兼容修复。
 */
import type { Edge, Node } from '@xyflow/react'
import { extractImageNodeAssetId } from './textNodeImageInputs'

export function syncAllTextNodeImageRefs(nodes: Node[], edges: Edge[]): Node[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const refsByTextId = new Map<string, string[]>()

  for (const edge of edges) {
    const target = nodeById.get(edge.target)
    const source = nodeById.get(edge.source)
    if (!target || target.type !== 'text') continue
    if (!source || source.type !== 'image') continue
    const assetId = extractImageNodeAssetId(
      source.data as {
        assetId?: unknown
        outputAssetIds?: unknown
        assetIds?: unknown
      },
    )
    if (!assetId) continue
    const list = refsByTextId.get(target.id) ?? []
    if (!list.includes(assetId)) list.push(assetId)
    refsByTextId.set(target.id, list)
  }

  if (refsByTextId.size === 0) {
    // 仍可能需要清空已断开的引用
    let changed = false
    const next = nodes.map((node) => {
      if (node.type !== 'text') return node
      const data = node.data as { inputImageAssetIds?: unknown }
      if (!Array.isArray(data.inputImageAssetIds) || data.inputImageAssetIds.length === 0) {
        return node
      }
      changed = true
      return {
        ...node,
        data: {
          ...node.data,
          inputImageAssetIds: [],
        },
      }
    })
    return changed ? next : nodes
  }

  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== 'text') return node
    const nextIds = refsByTextId.get(node.id) ?? []
    const data = node.data as { inputImageAssetIds?: unknown }
    const prev = Array.isArray(data.inputImageAssetIds)
      ? data.inputImageAssetIds.filter(
          (item): item is string => typeof item === 'string' && !!item.trim(),
        )
      : []
    const same =
      prev.length === nextIds.length && prev.every((id, i) => id === nextIds[i])
    if (same) return node
    changed = true
    return {
      ...node,
      data: {
        ...node.data,
        inputImageAssetIds: nextIds,
      },
    }
  })
  return changed ? next : nodes
}
