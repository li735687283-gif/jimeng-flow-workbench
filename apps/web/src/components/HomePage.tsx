import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import {
  ChevronRight,
  Film,
  FolderClock,
  Images,
  Infinity as InfinityIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { FlowSummary } from '@jimeng-flow/shared/flow'
import type { ManagedWork } from '@jimeng-flow/shared/video'
import { getAssetFileUrl } from '../api/assets'
import { HomeParticleField } from './HomeParticleField'

export interface HomePageProps {
  recentFlows: FlowSummary[]
  showcaseAssets: Asset[]
  workAssets: Asset[]
  featuredWorks?: ManagedWork[]
  galleryWorks?: ManagedWork[]
  heroImageUrl: string
  mokHeroImageUrl: string
  mokHeroContainerStyle?: CSSProperties
  mokHeroImageStyle?: CSSProperties
  logoImageUrl?: string
  loadingFlows?: boolean
  loadingAssets?: boolean
  onCreateFlow: () => void
  onOpenFlow: (id: string) => void
  onOpenAllFlows: () => void
  onOpenAssetLibrary: () => void
  onOpenVideoAdmin?: () => void
  onOpenSettings: () => void
  onReturnHome: () => void
  onPlayVideo?: (src: string, title?: string) => void
  onRenameFlow?: (id: string, name: string) => void
  onDeleteFlow?: (id: string) => void
}

function assetLabel(asset: Asset): string {
  return asset.prompt?.trim() || (asset.type === 'video' ? '视频作品' : '图片作品')
}

function FeaturedWorkCard({ work, onPlay }: { work: ManagedWork; onPlay?: () => void }) {
  const isVideo = work.mediaType === 'video'

  const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
    if (!isVideo) return
    const media = event.currentTarget.querySelector('video')
    void media?.play().catch(() => undefined)
  }

  const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
    if (!isVideo) return
    const media = event.currentTarget.querySelector('video')
    if (!media) return
    media.pause()
    media.currentTime = 0
  }

  const handleClick = () => {
    if (isVideo && onPlay) {
      onPlay()
    }
  }

  return (
    <article
      className={`home-featured-video-card${isVideo ? '' : ' is-image'}${isVideo && onPlay ? ' clickable' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {isVideo ? (
        <>
          <img className="home-featured-video-cover" src={work.coverUrl} alt="" />
          <video
            className="home-featured-video-media"
            src={work.mediaUrl}
            muted
            loop
            playsInline
            preload="metadata"
          />
        </>
      ) : (
        <img
          className="home-featured-video-cover home-featured-video-static"
          src={work.coverUrl}
          alt={work.title}
        />
      )}
    </article>
  )
}

function GalleryWorkCard({
  work,
  onPlay,
}: {
  work: ManagedWork
  onPlay?: () => void
}) {
  const isVideo = work.mediaType === 'video'
  return (
    <article
      className={`home-work-card${isVideo && onPlay ? ' clickable' : ''}`}
      onClick={isVideo && onPlay ? onPlay : undefined}
    >
      <div className="home-work-media">
        {isVideo ? (
          <video src={work.mediaUrl} muted playsInline preload="metadata" />
        ) : (
          <img src={work.mediaUrl} alt={work.title} />
        )}
        {isVideo && (
          <span className="home-work-badge">
            <Film size={10} />
          </span>
        )}
      </div>
    </article>
  )
}

function formatFlowTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()
    if (sameDay) return `今天 ${hm}`
    if (isYesterday) return `昨天 ${hm}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  } catch {
    return ''
  }
}

interface FlowCardMenuProps {
  flowId: string
  flowName: string
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

function FlowCardMenu({ flowId, flowName, onRename, onDelete }: FlowCardMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick as unknown as EventListener)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick as unknown as EventListener)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  const handleRename = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    const newName = window.prompt('重命名工作流', flowName)
    if (newName && newName.trim() && newName.trim() !== flowName) {
      onRename(flowId, newName.trim())
    }
  }

  const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    if (window.confirm(`确定要删除"${flowName}"吗？此操作不可撤销。`)) {
      onDelete(flowId)
    }
  }

  return (
    <div className="home-project-menu" ref={menuRef}>
      <button
        type="button"
        className="home-project-menu-btn"
        onClick={handleToggle}
        aria-label="更多操作"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="home-project-menu-dropdown" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={handleRename}>
            <Pencil size={15} />
            <span>重命名</span>
          </button>
          <button type="button" className="danger" onClick={handleDelete}>
            <Trash2 size={15} />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  )
}

interface FlowProjectCardProps {
  flow: FlowSummary
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

function FlowProjectCard({ flow, onOpen, onRename, onDelete }: FlowProjectCardProps) {
  const handleClick = () => onOpen(flow.id)

  return (
    <div
      role="button"
      tabIndex={0}
      className={`home-project-card${!flow.coverAssetId ? ' no-cover' : ''}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {flow.coverAssetId ? (
        <img
          className="home-project-cover"
          src={getAssetFileUrl(flow.coverAssetId)}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span className="home-project-cover-empty" aria-hidden="true" />
      )}
      <span className="home-project-card-scrim" aria-hidden="true" />
      <FlowCardMenu
        flowId={flow.id}
        flowName={flow.name}
        onRename={onRename}
        onDelete={onDelete}
      />
      <span className="home-project-title">
        <strong>{flow.name}</strong>
        <small>{formatFlowTime(flow.updatedAt)}</small>
      </span>
    </div>
  )
}

export function HomePage({
  recentFlows,
  showcaseAssets,
  workAssets,
  featuredWorks = [],
  galleryWorks = [],
  heroImageUrl,
  mokHeroImageUrl,
  mokHeroContainerStyle,
  mokHeroImageStyle,
  logoImageUrl,
  loadingFlows = false,
  loadingAssets = false,
  onCreateFlow,
  onOpenFlow,
  onOpenAllFlows,
  onOpenAssetLibrary,
  onOpenVideoAdmin,
  onOpenSettings,
  onReturnHome,
  onPlayVideo,
  onRenameFlow,
  onDeleteFlow,
}: HomePageProps) {
  const visibleFlows = recentFlows.slice(0, 3)
  const featuredAssets = showcaseAssets.slice(0, 3)
  const visibleFeaturedWorks = featuredWorks.slice(0, 3)
  const visibleGalleryWorks = galleryWorks.length > 0 ? galleryWorks.slice(0, 10) : workAssets.slice(0, 10)
  const useManagedGallery = galleryWorks.length > 0

  const handleRename = useCallback(
    (id: string, name: string) => {
      onRenameFlow?.(id, name)
    },
    [onRenameFlow],
  )
  const handleDelete = useCallback(
    (id: string) => {
      onDeleteFlow?.(id)
    },
    [onDeleteFlow],
  )

  return (
    <div className="home-page">
      <HomeParticleField />
      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-logo-menu">
            <button type="button" className="home-logo-button home-logo-circle">
              <span className="home-logo-ripple" aria-hidden="true" />
              {logoImageUrl ? (
                <img className="home-logo-image" src={logoImageUrl} alt="首页 Logo" />
              ) : (
                <InfinityIcon size={25} strokeWidth={2.5} />
              )}
            </button>
            <div className="home-menu-popover">
              <button type="button" onClick={onOpenAllFlows}>
                <FolderClock size={16} />
                <span>历史项目</span>
              </button>
              <button type="button" onClick={onOpenAssetLibrary}>
                <Images size={16} />
                <span>资源库</span>
              </button>
              {onOpenVideoAdmin && (
                <button type="button" onClick={onOpenVideoAdmin}>
                  <Film size={16} />
                  <span>作品管理</span>
                </button>
              )}
              <button type="button" onClick={onOpenSettings}>
                <Settings size={16} />
                <span>设置</span>
              </button>
            </div>
          </div>
          <span className="home-brand-name">MO.K</span>
        </div>
      </header>

      <main className="home-content">
        <section className="home-mok-hero" aria-label="MO.K" style={mokHeroContainerStyle}>
          <img
            className="home-mok-cat"
            src={mokHeroImageUrl}
            alt="MO.K"
            style={mokHeroImageStyle}
          />
        </section>

        <section
          className="home-section home-project-layer"
          aria-labelledby="home-recent-title"
        >
          <div className="home-section-head home-section-head-right">
            <button type="button" className="home-link-button" onClick={onOpenAllFlows}>
              全部项目
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="home-project-grid">
            <button
              type="button"
              className="home-project-card home-project-card-new"
              onClick={onCreateFlow}
            >
              <span className="home-new-icon">
                <Plus size={23} />
              </span>
              <span className="home-project-title">
                <strong>新建画布</strong>
              </span>
            </button>

            {visibleFlows.map((flow) => (
              <FlowProjectCard
                key={flow.id}
                flow={flow}
                onOpen={onOpenFlow}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {!loadingFlows && recentFlows.length === 0 && (
            <p className="home-empty-text">暂无最近项目</p>
          )}
        </section>

        {visibleFeaturedWorks.length > 0 ? (
          <section className="home-section home-featured-layer" aria-label="精选作品">
            <div className="home-featured-video-track">
              {visibleFeaturedWorks.map((work) => (
                <FeaturedWorkCard
                  key={work.id}
                  work={work}
                  onPlay={
                    work.mediaType === 'video' && onPlayVideo
                      ? () => onPlayVideo(work.mediaUrl, work.title)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ) : featuredAssets.length > 0 ? (
          <section className="home-section home-featured-layer" aria-label="展示内容">
            <div className="home-featured-track">
              {featuredAssets.map((asset, index) => {
                const isVideoAsset = asset.type === 'video'
                const canPlay = isVideoAsset && !!onPlayVideo
                return (
                  <article
                    key={asset.id}
                    className={`home-featured-card${index === 1 ? ' primary' : ''}${canPlay ? ' clickable' : ''}`}
                    onClick={
                      canPlay
                        ? () => onPlayVideo!(getAssetFileUrl(asset.id), assetLabel(asset))
                        : undefined
                    }
                  >
                    {isVideoAsset ? (
                      <video src={getAssetFileUrl(asset.id)} muted playsInline preload="metadata" />
                    ) : (
                      <img src={getAssetFileUrl(asset.id)} alt={assetLabel(asset)} />
                    )}
                    <div className="home-featured-caption">
                      <span>{assetLabel(asset)}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="home-section home-works-layer" aria-labelledby="home-works-title">
          {useManagedGallery ? (
            visibleGalleryWorks.length > 0 ? (
              <div className="home-works-grid five-up">
                {visibleGalleryWorks.map((work) => (
                  <GalleryWorkCard
                    key={work.id}
                    work={work}
                    onPlay={
                      work.mediaType === 'video' && onPlayVideo
                        ? () => onPlayVideo(work.mediaUrl, work.title)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="home-empty-text">暂无作品，请在作品管理中添加</p>
            )
          ) : visibleGalleryWorks.length > 0 ? (
            <div className="home-works-grid five-up">
              {visibleGalleryWorks.map((asset) => {
                const isVideoAsset = asset.type === 'video'
                const canPlay = isVideoAsset && !!onPlayVideo
                return (
                  <article
                    key={asset.id}
                    className={`home-work-card${canPlay ? ' clickable' : ''}`}
                    onClick={
                      canPlay
                        ? () => onPlayVideo!(getAssetFileUrl(asset.id), assetLabel(asset))
                        : undefined
                    }
                  >
                    <div className="home-work-media">
                      {isVideoAsset ? (
                        <video src={getAssetFileUrl(asset.id)} muted playsInline preload="metadata" />
                      ) : (
                        <img src={getAssetFileUrl(asset.id)} alt={assetLabel(asset)} />
                      )}
                      {isVideoAsset && (
                        <span className="home-work-badge">
                          <Film size={10} />
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            !loadingAssets && <p className="home-empty-text">暂无作品</p>
          )}
        </section>
      </main>
    </div>
  )
}
