// 即梦 Flow 前端 - FlowsHistoryModal 历史工作流列表弹窗
// 打开时拉取 GET /api/flows 列表，点击某项加载到画布后关闭。
// 底部"新建工作流"按钮调用 flowStore.createFlow。
// 暗色风格，复用 App.css 中的 modal-overlay / modal-content / modal-btn 类。
// 参考 PRD 8.5、10.2。

import { useEffect, useState } from 'react'
import { FolderOpen, X, FilePlus } from 'lucide-react'
import { useFlowStore } from '../state/flowStore'

export interface FlowsHistoryModalProps {
  open: boolean
  onClose: () => void
}

/** 把 ISO 8601 字符串格式化为 yyyy-MM-dd HH:mm */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

export function FlowsHistoryModal({ open, onClose }: FlowsHistoryModalProps) {
  const flowList = useFlowStore((s) => s.flowList)
  const loading = useFlowStore((s) => s.loading)
  const loadFlowList = useFlowStore((s) => s.loadFlowList)
  const loadFlow = useFlowStore((s) => s.loadFlow)
  const createFlow = useFlowStore((s) => s.createFlow)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // 打开时拉取一次最新列表
  useEffect(() => {
    if (!open) return
    setLoadError(null)
    loadFlowList().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : String(err))
    })
  }, [open, loadFlowList])

  if (!open) return null

  const handleOpen = async (id: string) => {
    setLoadingId(id)
    setLoadError(null)
    try {
      await loadFlow(id)
      onClose()
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingId(null)
    }
  }

  const handleNew = async () => {
    setLoadError(null)
    try {
      await createFlow()
      onClose()
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '560px', maxWidth: 'calc(100vw - 32px)' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={16} color="#a0a0a0" />
            <h3 style={{ margin: 0 }}>历史工作流</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9a9a9a',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 错误提示 */}
        {loadError && (
          <div
            style={{
              marginBottom: '12px',
              padding: '8px 10px',
              background: 'rgba(220, 50, 50, 0.12)',
              border: '1px solid rgba(220, 50, 50, 0.5)',
              borderRadius: '6px',
              color: '#ff9a9a',
              fontSize: '12px',
            }}
          >
            {loadError}
          </div>
        )}

        {/* 列表 */}
        {loading && flowList.length === 0 ? (
          <p className="modal-placeholder">加载中...</p>
        ) : flowList.length === 0 ? (
          <p className="modal-placeholder">暂无工作流，点击下方按钮新建</p>
        ) : (
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              marginBottom: '12px',
            }}
          >
            {flowList.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => handleOpen(flow.id)}
                disabled={loadingId === flow.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  cursor: loadingId === flow.id ? 'wait' : 'pointer',
                  color: 'var(--text)',
                  fontSize: '12px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-card-hover)'
                  e.currentTarget.style.borderColor = 'var(--border-light)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>
                    {flow.name}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    {formatTime(flow.updatedAt)} · {flow.nodeCount} 个节点
                  </span>
                </div>
                {loadingId === flow.id && (
                  <span style={{ color: 'var(--text-dim)' }}>加载中...</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="modal-actions" style={{ gap: '8px' }}>
          <button type="button" className="modal-btn" onClick={handleNew}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FilePlus size={14} />
              新建工作流
            </span>
          </button>
          <button type="button" className="modal-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default FlowsHistoryModal
