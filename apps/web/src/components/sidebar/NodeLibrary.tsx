import { nodeRegistryList } from '../../nodes/registry'
import type { FlowNodeType } from '../../types/nodeTypes'

interface NodeLibraryProps {
  onSelect: (type: FlowNodeType) => void
}

export function NodeLibrary({ onSelect }: NodeLibraryProps) {
  return (
    <aside className="node-library">
      <div className="panel-title">节点库</div>
      <div className="node-list">
        {nodeRegistryList.map((def) => {
          const Icon = def.icon
          return (
            <button
              key={def.type}
              type="button"
              className="node-item"
              onClick={() => onSelect(def.type)}
              title={`添加${def.label}节点`}
            >
              <Icon size={16} strokeWidth={1.6} />
              <span>{def.label}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
