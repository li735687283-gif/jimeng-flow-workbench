import { useCanvasStore } from '../../state/canvasStore'
import { nodeRegistry } from '../../nodes/registry'
import type { FlowNodeType, BaseNodeData } from '../../types/nodeTypes'

export function Inspector() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <aside className="inspector">
        <div className="panel-title">参数</div>
        <div className="inspector-empty">点击节点查看参数</div>
      </aside>
    )
  }

  const def = nodeRegistry[node.type as FlowNodeType]
  const Icon = def?.icon
  const data = node.data as BaseNodeData

  return (
    <aside className="inspector">
      <div className="panel-title">参数</div>
      <div className="inspector-content">
        <div className="inspector-section">
          <div className="inspector-section-title">
            {Icon && <Icon size={14} strokeWidth={1.6} />}
            <span>基本信息</span>
          </div>
          <div className="inspector-row">
            <span className="label">ID</span>
            <code className="value-mono">{node.id.slice(0, 12)}</code>
          </div>
          <div className="inspector-row">
            <span className="label">类型</span>
            <span className="value">{def?.label ?? node.type}</span>
          </div>
          <div className="inspector-row">
            <span className="label">标题</span>
            <span className="value">{data.title}</span>
          </div>
          <div className="inspector-row">
            <span className="label">状态</span>
            <span className={`value status-badge status-${data.status}`}>
              {data.status}
            </span>
          </div>
        </div>
        <div className="inspector-placeholder">
          参数面板由对应节点任务实现
        </div>
      </div>
    </aside>
  )
}
