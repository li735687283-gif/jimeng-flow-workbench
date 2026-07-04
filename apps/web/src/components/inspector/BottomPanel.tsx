import { useCanvasStore } from '../../state/canvasStore'
import { TextComposer } from '../TextComposer'
import { VideoComposer } from '../VideoComposer'
import { GenerateComposer } from '../GenerateComposer'
import { AgentPanel } from '../AgentPanel'

export function BottomPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const node = nodes.find((n) => n.id === selectedNodeId)

  let content: React.ReactNode
  if (!node) {
    // 未选中节点时显示 Agent 面板
    content = <AgentPanel />
  } else if (node.type === 'text') {
    content = <TextComposer nodeId={node.id} />
  } else if (node.type === 'video') {
    content = <VideoComposer nodeId={node.id} />
  } else if (node.type === 'generate') {
    content = <GenerateComposer nodeId={node.id} />
  } else {
    // image / agentPrompt / note 等节点也显示 Agent 面板
    content = <AgentPanel />
  }

  return (
    <footer className="bottom-panel">
      <div className="panel-title">底部面板</div>
      {content}
    </footer>
  )
}
