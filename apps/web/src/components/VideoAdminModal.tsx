import { useCallback, useEffect, useMemo, useState } from 'react'
import { Film, Pencil, Save, Search, Upload, X } from 'lucide-react'
import type { ManagedVideo, VideoListResponse } from '@jimeng-flow/shared/video'
import { uploadAsset } from '../api/assets'
import {
  createVideo,
  listVideos,
  updateVideo,
} from '../api/videos'

type BooleanFilter = 'all' | 'true' | 'false'

interface VideoFormState {
  title: string
  description: string
  sortOrder: string
  isFeatured: boolean
  isPinned: boolean
  isPublished: boolean
}

export interface VideoAdminModalProps {
  open: boolean
  onClose: () => void
  initialVideos?: ManagedVideo[]
  onVideosChanged?: () => void
}

const EMPTY_FORM: VideoFormState = {
  title: '',
  description: '',
  sortOrder: '0',
  isFeatured: true,
  isPinned: false,
  isPublished: true,
}

function toBooleanFilter(value: BooleanFilter): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function sortOrderValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildInitialResponse(videos: ManagedVideo[] | undefined): VideoListResponse {
  const items = videos ?? []
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 8,
  }
}

export function VideoAdminModal({
  open,
  onClose,
  initialVideos,
  onVideosChanged,
}: VideoAdminModalProps) {
  const [response, setResponse] = useState<VideoListResponse>(() =>
    buildInitialResponse(initialVideos),
  )
  const [query, setQuery] = useState('')
  const [featuredFilter, setFeaturedFilter] = useState<BooleanFilter>('all')
  const [pinnedFilter, setPinnedFilter] = useState<BooleanFilter>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<VideoFormState>(EMPTY_FORM)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const pageSize = 8

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(response.total / response.pageSize)),
    [response.pageSize, response.total],
  )

  const refresh = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      setError(null)
      try {
        const next = await listVideos({
          page: nextPage,
          pageSize,
          q: query,
          isFeatured: toBooleanFilter(featuredFilter),
          isPinned: toBooleanFilter(pinnedFilter),
        })
        setResponse(next)
        setPage(next.page)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [featuredFilter, pinnedFilter, query],
  )

  useEffect(() => {
    if (!open) return
    if (initialVideos) {
      setResponse(buildInitialResponse(initialVideos))
      return
    }
    void refresh(1)
  }, [initialVideos, open, refresh])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setVideoFile(null)
    setCoverFile(null)
  }

  const handleEdit = (video: ManagedVideo) => {
    setEditingId(video.id)
    setForm({
      title: video.title,
      description: video.description,
      sortOrder: String(video.sortOrder),
      isFeatured: video.isFeatured,
      isPinned: video.isPinned,
      isPublished: video.isPublished,
    })
    setVideoFile(null)
    setCoverFile(null)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const uploadedVideo = videoFile ? await uploadAsset(videoFile) : null
      const uploadedCover = coverFile ? await uploadAsset(coverFile) : null

      if (editingId) {
        await updateVideo(editingId, {
          title: form.title,
          description: form.description,
          videoAssetId: uploadedVideo?.id,
          coverAssetId: uploadedCover?.id,
          isFeatured: form.isFeatured,
          isPinned: form.isPinned,
          isPublished: form.isPublished,
          sortOrder: sortOrderValue(form.sortOrder),
        })
      } else {
        if (!uploadedVideo || !uploadedCover) {
          throw new Error('新建视频需要同时上传视频文件和封面图')
        }
        await createVideo({
          title: form.title,
          description: form.description,
          videoAssetId: uploadedVideo.id,
          coverAssetId: uploadedCover.id,
          isFeatured: form.isFeatured,
          isPinned: form.isPinned,
          isPublished: form.isPublished,
          sortOrder: sortOrderValue(form.sortOrder),
        })
      }

      resetForm()
      onVideosChanged?.()
      if (!initialVideos) await refresh(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay video-admin-overlay" onClick={onClose}>
      <div
        className="modal-content video-admin-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="video-admin-header">
          <div>
            <span className="video-admin-kicker">Featured Video</span>
            <h3>
              <Film size={17} />
              视频管理
            </h3>
          </div>
          <button type="button" className="video-admin-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        {error && <p className="video-admin-error">{error}</p>}

        <div className="video-admin-layout">
          <section className="video-admin-form" aria-label="视频编辑">
            <label>
              <span>标题</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="视频标题"
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
              <label className="video-admin-file-slot">
                <Upload size={15} />
                <span>上传视频</span>
                <small>{videoFile?.name ?? 'MP4 / WebM / MOV'}</small>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) =>
                    setVideoFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
              <label className="video-admin-file-slot">
                <Upload size={15} />
                <span>上传封面</span>
                <small>{coverFile?.name ?? 'PNG / JPG / WebP'}</small>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setCoverFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
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
                新建
              </button>
              <button
                type="button"
                className="modal-btn video-admin-primary"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                <Save size={14} />
                {editingId ? '保存修改' : '保存视频'}
              </button>
            </div>
          </section>

          <section className="video-admin-list" aria-label="视频列表">
            <div className="video-admin-toolbar">
              <label className="video-admin-search">
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索视频"
                />
              </label>
              <select
                value={featuredFilter}
                onChange={(event) => {
                  setFeaturedFilter(event.target.value as BooleanFilter)
                  setPage(1)
                }}
              >
                <option value="all">全部精选</option>
                <option value="true">仅精选</option>
                <option value="false">非精选</option>
              </select>
              <select
                value={pinnedFilter}
                onChange={(event) => {
                  setPinnedFilter(event.target.value as BooleanFilter)
                  setPage(1)
                }}
              >
                <option value="all">全部置顶</option>
                <option value="true">仅置顶</option>
                <option value="false">非置顶</option>
              </select>
              <button type="button" className="modal-btn" onClick={() => void refresh(1)}>
                查询
              </button>
            </div>

            {loading && response.items.length === 0 ? (
              <p className="modal-placeholder">加载中...</p>
            ) : response.items.length === 0 ? (
              <p className="modal-placeholder">暂无视频</p>
            ) : (
              <div className="video-admin-table-wrap">
                <table className="video-admin-table">
                  <thead>
                    <tr>
                      <th>封面</th>
                      <th>标题</th>
                      <th>状态</th>
                      <th>权重</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.items.map((video) => (
                      <tr key={video.id}>
                        <td>
                          <div className="video-admin-thumb">
                            <img src={video.coverUrl} alt="" />
                            <video src={video.videoUrl} muted playsInline preload="metadata" />
                          </div>
                        </td>
                        <td>
                          <strong>{video.title}</strong>
                          <span>{video.description || '无简介'}</span>
                        </td>
                        <td>
                          <div className="video-admin-tags">
                            {video.isFeatured && <span>精选</span>}
                            {video.isPinned && <span>置顶</span>}
                            <span>{video.isPublished ? '上架' : '下架'}</span>
                          </div>
                        </td>
                        <td>{video.sortOrder}</td>
                        <td>
                          <button type="button" onClick={() => handleEdit(video)}>
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
                    const next = Math.max(1, page - 1)
                    setPage(next)
                    void refresh(next)
                  }}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="modal-btn"
                  disabled={page >= pageCount}
                  onClick={() => {
                    const next = Math.min(pageCount, page + 1)
                    setPage(next)
                    void refresh(next)
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
