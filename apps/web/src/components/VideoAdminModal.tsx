import { useCallback, useEffect, useMemo, useState } from 'react'
import { Film, Image as ImageIcon, Pencil, Plus, Save, Star, Upload, X, Trash2, Check } from 'lucide-react'
import type { ManagedWork, WorkListResponse, WorkMediaType } from '@jimeng-flow/shared/video'
import { uploadAsset } from '../api/assets'
import {
  createWork,
  listWorks,
  updateWork,
} from '../api/videos'
import {
  buildWorkAdminEditForm,
  buildWorkAdminListQuery,
  clampWorkAdminPage,
  type WorkAdminFormState,
  type WorkAdminTab,
} from '../utils/videoAdminState'

export interface VideoAdminModalProps {
  open: boolean
  onClose: () => void
  onWorksChanged?: () => void
  onPlayVideo?: (src: string, title?: string) => void
}

const EMPTY_FORM: WorkAdminFormState = {
  mediaType: 'video',
  title: '',
  description: '',
  sortOrder: '0',
  isFeatured: true,
  isPinned: false,
  isPublished: true,
}

function sortOrderValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function VideoAdminModal({
  open,
  onClose,
  onWorksChanged,
  onPlayVideo,
}: VideoAdminModalProps) {
  const [response, setResponse] = useState<WorkListResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 8,
  })
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<WorkAdminTab>('all')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingWork, setEditingWork] = useState<ManagedWork | null>(null)
  const [form, setForm] = useState<WorkAdminFormState>(EMPTY_FORM)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const pageSize = 8

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(response.total / response.pageSize)),
    [response.pageSize, response.total],
  )

  const refresh = useCallback(
    async (nextPage = 1, tab: WorkAdminTab = activeTab) => {
      setLoading(true)
      setError(null)
      try {
        const next = await listWorks(buildWorkAdminListQuery(tab, nextPage, pageSize))
        setResponse(next)
        setPage(next.page)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [activeTab],
  )

  useEffect(() => {
    if (!open) return
    void refresh(1, activeTab)
  }, [activeTab, open, refresh])

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreviewUrl)
      }
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [mediaPreviewUrl, coverPreviewUrl])

  const resetForm = () => {
    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl)
    }
    setEditingWork(null)
    setForm(EMPTY_FORM)
    setMediaFile(null)
    setCoverFile(null)
    setMediaPreviewUrl(null)
    setCoverPreviewUrl(null)
  }

  const handleAddNew = () => {
    resetForm()
    setForm({ ...EMPTY_FORM })
  }

  const handleEdit = (work: ManagedWork) => {
    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl)
    }
    setEditingWork(work)
    setForm(buildWorkAdminEditForm(work))
    setMediaFile(null)
    setCoverFile(null)
    setMediaPreviewUrl(work.mediaUrl)
    setCoverPreviewUrl(work.coverUrl === work.mediaUrl ? null : work.coverUrl)
  }

  const handleMediaTypeChange = (type: WorkMediaType) => {
    if (editingWork) return
    setForm((prev) => ({ ...prev, mediaType: type }))
    if (type === 'image') {
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreviewUrl)
      }
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
      setMediaFile(null)
      setCoverFile(null)
      setMediaPreviewUrl(null)
      setCoverPreviewUrl(null)
    }
  }

  const handleMediaFileChange = (file: File | null) => {
    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
    setMediaFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setMediaPreviewUrl(url)
      if (form.mediaType === 'image') {
        setCoverPreviewUrl(url)
        setCoverFile(null)
      }
    } else if (editingWork) {
      setMediaPreviewUrl(editingWork.mediaUrl)
      if (editingWork.mediaType === 'image') {
        setCoverPreviewUrl(null)
      } else {
        setCoverPreviewUrl(editingWork.coverUrl)
      }
    } else {
      setMediaPreviewUrl(null)
      if (form.mediaType === 'image') {
        setCoverPreviewUrl(null)
      }
    }
  }

  const handleCoverFileChange = (file: File | null) => {
    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl)
    }
    setCoverFile(file)
    if (file) {
      setCoverPreviewUrl(URL.createObjectURL(file))
    } else if (editingWork) {
      setCoverPreviewUrl(editingWork.coverUrl !== editingWork.mediaUrl ? editingWork.coverUrl : null)
    } else {
      setCoverPreviewUrl(null)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const uploadedMedia = mediaFile ? await uploadAsset(mediaFile) : null
      const uploadedCover = coverFile ? await uploadAsset(coverFile) : null

      if (editingWork) {
        await updateWork(editingWork.id, {
          title: form.title,
          description: form.description,
          mediaAssetId: uploadedMedia?.id,
          coverAssetId: uploadedCover?.id,
          isFeatured: form.isFeatured,
          isPinned: form.isPinned,
          isPublished: form.isPublished,
          sortOrder: sortOrderValue(form.sortOrder),
        })
      } else {
        if (!uploadedMedia) {
          throw new Error(form.mediaType === 'video' ? '请上传视频文件' : '请上传图片文件')
        }
        const isVideo = form.mediaType === 'video'
        if (isVideo && !uploadedCover) {
          throw new Error('视频作品需要上传封面图')
        }
        await createWork({
          mediaType: form.mediaType,
          title: form.title,
          description: form.description,
          mediaAssetId: uploadedMedia.id,
          coverAssetId: isVideo ? uploadedCover!.id : uploadedMedia.id,
          isFeatured: form.isFeatured,
          isPinned: form.isPinned,
          isPublished: form.isPublished,
          sortOrder: sortOrderValue(form.sortOrder),
        })
      }

      resetForm()
      onWorksChanged?.()
      await refresh(page, activeTab)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTabChange = (tab: WorkAdminTab) => {
    setActiveTab(tab)
    setPage(1)
  }

  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null)

  const handleToggleFeatured = async (work: ManagedWork) => {
    setTogglingFeatured(work.id)
    setError(null)
    try {
      await updateWork(work.id, {
        isFeatured: !work.isFeatured,
      })
      onWorksChanged?.()
      await refresh(page, activeTab)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTogglingFeatured(null)
    }
  }

  if (!open) return null

  const isImageType = form.mediaType === 'image'

  return (
    <div className="modal-overlay video-admin-overlay" onClick={onClose}>
      <div
        className="modal-content video-admin-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="video-admin-header">
          <div>
            <span className="video-admin-kicker">Works</span>
            <h3>
              <Film size={17} />
              作品管理
            </h3>
          </div>
          <button type="button" className="video-admin-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        {error && <p className="video-admin-error">{error}</p>}

        <div className="video-admin-layout">
          <section className="video-admin-form" aria-label="作品编辑">
            <div className="video-admin-form-head">
              {editingWork ? (
                <div className="video-admin-editing-badge">
                  <Pencil size={12} />
                  <span>正在编辑：{editingWork.title}</span>
                </div>
              ) : (
                <div className="video-admin-type-toggle">
                  <button
                    type="button"
                    className={form.mediaType === 'video' ? 'active' : ''}
                    onClick={() => handleMediaTypeChange('video')}
                  >
                    <Film size={13} />
                    视频作品
                  </button>
                  <button
                    type="button"
                    className={form.mediaType === 'image' ? 'active' : ''}
                    onClick={() => handleMediaTypeChange('image')}
                  >
                    <ImageIcon size={13} />
                    图片作品
                  </button>
                </div>
              )}
              <button type="button" className="video-admin-add-btn" onClick={handleAddNew}>
                <Plus size={14} />
                新增作品
              </button>
            </div>

            <label>
              <span>标题</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="作品标题"
              />
            </label>
            <label>
              <span>简介</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="简短描述"
              />
            </label>
            <label>
              <span>排序权重</span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value })
                }
              />
            </label>

            <div className="video-admin-upload-row">
              <label className={`video-admin-file-slot ${mediaPreviewUrl ? 'has-preview' : ''}`}>
                {mediaPreviewUrl ? (
                  <div className="video-admin-preview-wrap">
                    {isImageType ? (
                      <img src={mediaPreviewUrl} alt="作品预览" />
                    ) : (
                      <video src={mediaPreviewUrl} muted playsInline preload="metadata" />
                    )}
                    <div className="video-admin-preview-info">
                      <span className="video-admin-preview-label">
                        {isImageType ? '图片' : '视频'}
                      </span>
                      <span className="video-admin-preview-name">
                        {mediaFile?.name ?? (editingWork ? '已有文件' : '')}
                      </span>
                    </div>
                    {!editingWork && (
                      <button
                        type="button"
                        className="video-admin-preview-clear"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleMediaFileChange(null)
                        }}
                        aria-label="清除文件"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload size={15} />
                    <span>上传{isImageType ? '图片' : '视频'}</span>
                    <small>{isImageType ? 'PNG / JPG / WebP' : 'MP4 / WebM / MOV'}</small>
                  </>
                )}
                <input
                  type="file"
                  accept={isImageType ? 'image/*' : 'video/*'}
                  onChange={(event) =>
                    handleMediaFileChange(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
              {!isImageType && (
                <label className={`video-admin-file-slot ${coverPreviewUrl ? 'has-preview' : ''}`}>
                  {coverPreviewUrl ? (
                    <div className="video-admin-preview-wrap">
                      <img src={coverPreviewUrl} alt="封面预览" />
                      <div className="video-admin-preview-info">
                        <span className="video-admin-preview-label">封面</span>
                        <span className="video-admin-preview-name">
                          {coverFile?.name ?? (editingWork ? '已有封面' : '')}
                        </span>
                      </div>
                      {!editingWork && (
                        <button
                          type="button"
                          className="video-admin-preview-clear"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleCoverFileChange(null)
                          }}
                          aria-label="清除封面"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>上传封面</span>
                      <small>PNG / JPG / WebP</small>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleCoverFileChange(event.currentTarget.files?.[0] ?? null)
                    }
                  />
                </label>
              )}
              {isImageType && (
                <div className="video-admin-file-slot video-admin-auto-cover">
                  <ImageIcon size={15} />
                  <span>自动封面</span>
                  <small>图片作品使用自身作为封面</small>
                </div>
              )}
            </div>

            <div className="video-admin-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) =>
                    setForm({ ...form, isFeatured: event.target.checked })
                  }
                />
                <span>精选</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) =>
                    setForm({ ...form, isPinned: event.target.checked })
                  }
                />
                <span>置顶</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) =>
                    setForm({ ...form, isPublished: event.target.checked })
                  }
                />
                <span>上架</span>
              </label>
            </div>

            <div className="video-admin-actions">
              <button type="button" className="modal-btn" onClick={resetForm}>
                {editingWork ? '取消编辑' : '重置'}
              </button>
              <button
                type="button"
                className="modal-btn video-admin-primary"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                <Save size={14} />
                {editingWork ? '保存修改' : '保存作品'}
              </button>
            </div>
          </section>

          <section className="video-admin-list" aria-label="作品列表">
            <div className="video-admin-tabs">
              <button
                type="button"
                className={activeTab === 'all' ? 'active' : ''}
                onClick={() => handleTabChange('all')}
              >
                全部
              </button>
              <button
                type="button"
                className={activeTab === 'featured' ? 'active featured-tab' : ''}
                onClick={() => handleTabChange('featured')}
              >
                <Star size={12} fill={activeTab === 'featured' ? 'currentColor' : 'none'} />
                精选作品
              </button>
              <button
                type="button"
                className={activeTab === 'video' ? 'active' : ''}
                onClick={() => handleTabChange('video')}
              >
                <Film size={12} />
                视频
              </button>
              <button
                type="button"
                className={activeTab === 'image' ? 'active' : ''}
                onClick={() => handleTabChange('image')}
              >
                <ImageIcon size={12} />
                图片
              </button>
            </div>

            {loading && response.items.length === 0 ? (
              <p className="modal-placeholder">加载中...</p>
            ) : response.items.length === 0 ? (
              <p className="modal-placeholder">暂无作品</p>
            ) : (
              <div className="video-admin-table-wrap">
                <table className="video-admin-table">
                  <thead>
                    <tr>
                      <th>封面</th>
                      <th>标题</th>
                      <th>类型</th>
                      <th>状态</th>
                      <th>权重</th>
                      <th>精选</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.items.map((work) => (
                      <tr
                        key={work.id}
                        className={editingWork?.id === work.id ? 'video-admin-row-editing' : ''}
                      >
                        <td>
                          <div
                            className={`video-admin-thumb${work.mediaType === 'video' && onPlayVideo ? ' clickable' : ''}`}
                            onClick={
                              work.mediaType === 'video' && onPlayVideo
                                ? () => onPlayVideo(work.mediaUrl, work.title)
                                : undefined
                            }
                          >
                            <img src={work.coverUrl} alt="" />
                            {work.mediaType === 'video' && (
                              <video src={work.mediaUrl} muted playsInline preload="metadata" />
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>{work.title}</strong>
                          <span>{work.description || '无简介'}</span>
                        </td>
                        <td>
                          <span className="video-admin-type-badge">
                            {work.mediaType === 'video' ? (
                              <><Film size={10} /> 视频</>
                            ) : (
                              <><ImageIcon size={10} /> 图片</>
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="video-admin-tags">
                            {work.isFeatured && <span className="tag-featured">精选</span>}
                            {work.isPinned && <span>置顶</span>}
                            <span>{work.isPublished ? '上架' : '下架'}</span>
                          </div>
                        </td>
                        <td>{work.sortOrder}</td>
                        <td>
                          <button
                            type="button"
                            className={`video-admin-feature-btn${work.isFeatured ? ' is-featured' : ''}`}
                            onClick={() => void handleToggleFeatured(work)}
                            disabled={togglingFeatured === work.id}
                            title={work.isFeatured ? '取消精选' : '设为精选'}
                          >
                            {togglingFeatured === work.id ? (
                              <span className="video-admin-btn-loading">•</span>
                            ) : work.isFeatured ? (
                              <Check size={14} />
                            ) : (
                              <Star size={14} />
                            )}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={editingWork?.id === work.id ? 'video-admin-btn-active' : ''}
                            onClick={() => handleEdit(work)}
                          >
                            <Pencil size={13} />
                            编辑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="video-admin-pagination">
              <span>
                第 {response.page} / {pageCount} 页，共 {response.total} 条
              </span>
              <div>
                <button
                  type="button"
                  className="modal-btn"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = clampWorkAdminPage(page - 1, pageCount)
                    setPage(next)
                    void refresh(next, activeTab)
                  }}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="modal-btn"
                  disabled={page >= pageCount}
                  onClick={() => {
                    const next = clampWorkAdminPage(page + 1, pageCount)
                    setPage(next)
                    void refresh(next, activeTab)
                  }}
                >
                  下一页
                </button>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  )
}

export default VideoAdminModal
