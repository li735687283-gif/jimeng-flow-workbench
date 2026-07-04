export interface ContextMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
}

interface ContextMenuProps {
  state: ContextMenuState
  onAddNode: () => void
  onUpload: () => void
  onClose: () => void
}

export function ContextMenu({
  state,
  onAddNode,
  onUpload,
  onClose,
}: ContextMenuProps) {
  return (
    <>
      <div className="menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="context-menu"
        style={{ left: state.x, top: state.y }}
      >
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            onUpload()
            onClose()
          }}
        >
          上传
        </button>
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            onAddNode()
            onClose()
          }}
        >
          添加节点
        </button>
      </div>
    </>
  )
}
