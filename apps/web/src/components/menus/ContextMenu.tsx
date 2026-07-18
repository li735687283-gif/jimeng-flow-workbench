export interface ContextMenuState {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  nodeId?: string
  assetId?: string
  hasClipboard?: boolean
}

interface ContextMenuProps {
  state: ContextMenuState
  onAddNode: () => void
  onUpload: () => void
  onSaveToAssetLibrary?: () => void
  onCopyNode?: () => void
  onPasteNode?: () => void
  onDeleteNode?: () => void
  onClose: () => void
}

export function ContextMenu({
  state,
  onAddNode,
  onUpload,
  onSaveToAssetLibrary,
  onCopyNode,
  onPasteNode,
  onDeleteNode,
  onClose,
}: ContextMenuProps) {
  const isNodeMenu = Boolean(state.nodeId)

  return (
    <>
      <div
        className="menu-overlay"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div className="context-menu" style={{ left: state.x, top: state.y }}>
        {isNodeMenu ? (
          <>
            <button
              type="button"
              className="menu-item"
              disabled={!onSaveToAssetLibrary}
              title={state.assetId ? '保存当前节点的资产' : '当前节点暂未找到可保存的资产'}
              onClick={() => {
                onSaveToAssetLibrary?.()
                onClose()
              }}
            >
              保存到资产库
            </button>
            <div className="menu-divider" aria-hidden="true" />
            <button
              type="button"
              className="menu-item"
              disabled={!onCopyNode}
              onClick={() => {
                onCopyNode?.()
                onClose()
              }}
            >
              复制
            </button>
            <button
              type="button"
              className="menu-item"
              disabled={!state.hasClipboard || !onPasteNode}
              onClick={() => {
                onPasteNode?.()
                onClose()
              }}
            >
              粘贴
            </button>
            <button
              type="button"
              className="menu-item danger"
              disabled={!onDeleteNode}
              onClick={() => {
                onDeleteNode?.()
                onClose()
              }}
            >
              删除
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )
}
