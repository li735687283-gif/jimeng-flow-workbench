import { useCanvasStore } from '../../state/canvasStore'
import { VideoComposer } from '../VideoComposer'
import { AgentPanel } from '../AgentPanel'

export function BottomPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const node = nodes.find((n) => n.id === selectedNodeId)

  // 文本节点交互已迁移到节点下方浮动编辑器（对齐图片节点）。
  let content: React.ReactNode
  if (!node) {
    content = <AgentPanel />
  } else if (node.type === 'video') {
    content = <VideoComposer nodeId={node.id} />
  } else {
    content = <AgentPanel />
  }

  return (
    <footer className="bottom-panel">
      <div className="panel-title">底部面板</div>
      {content}
    </footer>
  )
}
