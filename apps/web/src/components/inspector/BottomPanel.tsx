import { useCanvasStore } from '../../state/canvasStore'
import { TextComposer } from '../TextComposer'
import { VideoComposer } from '../VideoComposer'
import { AgentPanel } from '../AgentPanel'

export function BottomPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const node = nodes.find((n) => n.id === selectedNodeId)

  let content: React.ReactNode
  if (!node) {
    content = <AgentPanel />
  } else if (node.type === 'text') {
    content = <TextComposer nodeId={node.id} />
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
