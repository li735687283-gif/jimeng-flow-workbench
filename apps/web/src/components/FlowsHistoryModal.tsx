import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Check, FolderKanban, Loader2, Pencil, Trash2, X } from 'lucide-react'
import type { FlowSummary } from '@jimeng-flow/shared/flow'
import { getAssetFileUrl } from '../api/assets'
import { useFlowStore } from '../state/flowStore'

export interface FlowsHistoryModalProps {
  open: boolean
  onClose: () => void
  onFlowReady?: () => void
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return iso
  }
}

export function FlowsHistoryModal({
  open,
  onClose,
  onFlowReady,
}: FlowsHistoryModalProps) {
  const flowList = useFlowStore((state) => state.flowList)
  const loading = useFlowStore((state) => state.loading)
  const loadFlowList = useFlowStore((state) => state.loadFlowList)
  const loadFlow = useFlowStore((state) => state.loadFlow)
  const renameFlow = useFlowStore((state) => state.renameFlow)
  const deleteFlow = useFlowStore((state) => state.deleteFlow)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  useEffect(() => {
    if (!open) return
    setLoadError(null)
    void loadFlowList().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : String(error))
    })
  }, [loadFlowList, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (renamingId) {
        setRenamingId(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open, renamingId])

  if (!open) return null

  const handleOpen = async (id: string) => {
    if (actionId || renamingId) return
    setLoadingId(id)
    setLoadError(null)
    try {
      await loadFlow(id)
      onClose()
      onFlowReady?.()
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingId(null)
    }
  }

  const handleRename = (
    event: MouseEvent<HTMLButtonElement>,
    flow: FlowSummary,
  ) => {
    event.stopPropagation()
    setRenameDraft(flow.name)
    setRenamingId(flow.id)
    setLoadError(null)
  }

  const handleRenameSubmit = async (
    event: FormEvent<HTMLFormElement>,
    flow: FlowSummary,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const nextName = renameDraft.trim()
    if (!nextName || nextName === flow.name) {
      setRenamingId(null)
      return
    }

    setActionId(flow.id)
    setLoadError(null)
    try {
      await renameFlow(flow.id, nextName)
      setRenamingId(null)
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (
    event: MouseEvent<HTMLButtonElement>,
    flow: FlowSummary,
  ) => {
    event.stopPropagation()
    if (!window.confirm(`确定删除“${flow.name}”吗？此操作不可撤销。`)) return

    setActionId(flow.id)
    setLoadError(null)
    try {
      await deleteFlow(flow.id)
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="modal-overlay project-manager-overlay" onClick={onClose}>
      <section
        className="project-manager-modal"
        aria-labelledby="project-manager-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="project-manager-header">
          <div className="project-manager-heading">
            <span className="project-manager-heading-icon" aria-hidden="true">
              <FolderKanban size={19} strokeWidth={1.8} />
            </span>
            <div>
              <h2 id="project-manager-title">全部项目</h2>
              <p>{flowList.length} 个项目</p>
            </div>
          </div>
          <button
            type="button"
            className="project-manager-close"
            onClick={onClose}
            aria-label="关闭全部项目"
            title="关闭"
          >
            <X size={20} />
          </button>
        </header>

        {loadError ? (
          <div className="project-manager-error" role="alert">
            {loadError}
          </div>
        ) : null}

        <div className="project-manager-content">
          {loading && flowList.length === 0 ? (
            <div className="project-manager-empty">
              <Loader2 className="animate-spin" size={22} />
              <span>正在加载项目…</span>
            </div>
          ) : flowList.length === 0 ? (
            <div className="project-manager-empty">
              <FolderKanban size={28} strokeWidth={1.5} />
              <span>暂无项目</span>
            </div>
          ) : (
            <div className="project-manager-grid">
              {flowList.map((flow) => {
                const opening = loadingId === flow.id
                const mutating = actionId === flow.id
                return (
                  <article className="project-manager-card" key={flow.id}>
                    <button
                      type="button"
                      className="project-manager-card-open"
                      onClick={() => void handleOpen(flow.id)}
                      disabled={opening || mutating}
                      aria-label={`打开项目：${flow.name}`}
                    >
                      {flow.coverAssetId ? (
                        <img
                          src={getAssetFileUrl(flow.coverAssetId)}
                          alt=""
                          className="project-manager-thumbnail"
                        />
                      ) : (
                        <span className="project-manager-thumbnail-empty" aria-hidden="true">
                          <FolderKanban size={30} strokeWidth={1.3} />
                        </span>
                      )}
                      <span className="project-manager-thumbnail-shade" aria-hidden="true" />
                      {opening ? (
                        <span className="project-manager-opening">
                          <Loader2 className="animate-spin" size={20} />
                          正在打开
                        </span>
                      ) : null}
                    </button>

                    <div className="project-manager-card-footer">
                      {renamingId === flow.id ? (
                        <form
                          className="project-manager-rename-form"
                          onSubmit={(event) => void handleRenameSubmit(event, flow)}
                        >
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            aria-label={`项目名称：${flow.name}`}
                            maxLength={80}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={actionId === flow.id || !renameDraft.trim()}
                            aria-label="保存名字"
                            title="保存"
                          >
                            {actionId === flow.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Check size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            disabled={actionId === flow.id}
                            aria-label="取消改名"
                            title="取消"
                          >
                            <X size={15} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="project-manager-card-copy">
                            <strong title={flow.name}>{flow.name}</strong>
                            <span>{formatTime(flow.updatedAt)} · {flow.nodeCount} 个节点</span>
                          </div>
                          <div className="project-manager-card-actions">
                            <button
                              type="button"
                              onClick={(event) => handleRename(event, flow)}
                              disabled={!!actionId || opening}
                              title="改名字"
                            >
                              <Pencil size={15} />
                              <span>改名字</span>
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={(event) => void handleDelete(event, flow)}
                              disabled={!!actionId || opening}
                              title="删除"
                            >
                              <Trash2 size={15} />
                              <span>删除</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default FlowsHistoryModal
