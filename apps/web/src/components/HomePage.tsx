import type { MouseEvent } from 'react'
import {
  Film,
  FolderClock,
  Home,
  Images,
  Infinity as InfinityIcon,
  Plus,
  Settings,
} from 'lucide-react'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { FlowSummary } from '@jimeng-flow/shared/flow'
import type { ManagedVideo } from '@jimeng-flow/shared/video'
import { getAssetFileUrl } from '../api/assets'
import { HomeParticleField } from './HomeParticleField'

export interface HomePageProps {
  recentFlows: FlowSummary[]
  showcaseAssets: Asset[]
  workAssets: Asset[]
  featuredVideos?: ManagedVideo[]
  heroImageUrl: string
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
}

function assetLabel(asset: Asset): string {
  return asset.prompt?.trim() || (asset.type === 'video' ? '视频作品' : '图片作品')
}

function FeaturedVideoCard({ video }: { video: ManagedVideo }) {
  const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
    const media = event.currentTarget.querySelector('video')
    void media?.play().catch(() => undefined)
  }

  const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
    const media = event.currentTarget.querySelector('video')
    if (!media) return
    media.pause()
    media.currentTime = 0
  }

  return (
    <article
      className="home-featured-video-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img className="home-featured-video-cover" src={video.coverUrl} alt="" />
      <video
        className="home-featured-video-media"
        src={video.videoUrl}
        muted
        loop
        playsInline
        preload="metadata"
      />
    </article>
  )
}

export function HomePage({
  recentFlows,
  showcaseAssets,
  workAssets,
  featuredVideos = [],
  heroImageUrl,
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
}: HomePageProps) {
  const visibleFlows = recentFlows.slice(0, 3)
  const featuredAssets = showcaseAssets.slice(0, 3)
  const visibleFeaturedVideos = featuredVideos.slice(0, 8)
  const visibleWorkAssets = workAssets.slice(0, 8)
  const projectCoverAssets = workAssets.filter((asset) => asset.type === 'image')
  const getProjectCover = (index: number) =>
    projectCoverAssets.length > 0
      ? projectCoverAssets[index % projectCoverAssets.length]
      : undefined
  const renderProjectCover = (asset: Asset | undefined) =>
    asset ? (
      <img
        className="home-project-cover"
        src={getAssetFileUrl(asset.id)}
        alt=""
        aria-hidden="true"
      />
    ) : (
      <span className="home-project-cover-placeholder" aria-hidden="true" />
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
              <button type="button" onClick={onReturnHome}>
                <Home size={16} />
                <span>首页</span>
              </button>
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
                  <span>视频管理</span>
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
        <section className="home-creative-layer" aria-label="你的创意">
          <div className="home-greeting-avatar">
            {logoImageUrl ? (
              <img src={logoImageUrl} alt="" aria-hidden="true" />
            ) : (
              <InfinityIcon size={34} />
            )}
          </div>
          <h1>晚上好，L-zw~</h1>
          <div
            className="home-creative-card"
            style={{ backgroundImage: `url("${heroImageUrl}")` }}
          >
            <span>说说你的创意</span>
          </div>
        </section>

        <section
          className="home-section home-project-layer"
          aria-labelledby="home-recent-title"
        >
          <div className="home-section-head">
            <div>
              <span className="home-section-kicker">全部</span>
              <h2 id="home-recent-title">历史工程</h2>
            </div>
            <button type="button" className="home-text-button" onClick={onOpenAllFlows}>
              打开全部
            </button>
          </div>

          <div className="home-project-grid">
            <button
              type="button"
              className="home-project-card home-project-card-new"
              onClick={onCreateFlow}
            >
              {renderProjectCover(getProjectCover(0))}
              <span className="home-project-card-scrim" aria-hidden="true" />
              <span className="home-new-icon">
                <Plus size={23} />
              </span>
              <span className="home-project-title">
                <strong>新建画布</strong>
              </span>
            </button>

            {visibleFlows.map((flow, index) => (
              <button
                key={flow.id}
                type="button"
                className="home-project-card"
                onClick={() => onOpenFlow(flow.id)}
              >
                {renderProjectCover(getProjectCover(index + 1))}
                <span className="home-project-card-scrim" aria-hidden="true" />
                <span className="home-project-title">
                  <strong>{flow.name}</strong>
                </span>
              </button>
            ))}
          </div>

          {!loadingFlows && recentFlows.length === 0 && (
            <p className="home-empty-text">暂无最近项目</p>
          )}
        </section>

        {visibleFeaturedVideos.length > 0 ? (
          <section className="home-section home-featured-layer" aria-label="视频展示">
            <div className="home-featured-video-track">
              {visibleFeaturedVideos.map((video) => (
                <FeaturedVideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        ) : featuredAssets.length > 0 ? (
          <section className="home-section home-featured-layer" aria-label="展示内容">
            <div className="home-featured-track">
              {featuredAssets.map((asset, index) => (
                <article
                  key={asset.id}
                  className={`home-featured-card${index === 1 ? ' primary' : ''}`}
                >
                  {asset.type === 'video' ? (
                    <video src={getAssetFileUrl(asset.id)} muted playsInline preload="metadata" />
                  ) : (
                    <img src={getAssetFileUrl(asset.id)} alt={assetLabel(asset)} />
                  )}
                  <div className="home-featured-caption">
                    <span>{assetLabel(asset)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="home-section home-works-layer" aria-labelledby="home-works-title">
          <div className="home-section-head">
            <div>
              <span className="home-section-kicker">Gallery</span>
              <h2 id="home-works-title">作品</h2>
            </div>
          </div>

          {visibleWorkAssets.length > 0 ? (
            <div className="home-works-grid five-up">
              {visibleWorkAssets.map((asset) => (
                <article key={asset.id} className="home-work-card">
                  <div className="home-work-media">
                    {asset.type === 'video' ? (
                      <video src={getAssetFileUrl(asset.id)} muted playsInline preload="metadata" />
                    ) : (
                      <img src={getAssetFileUrl(asset.id)} alt={assetLabel(asset)} />
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            !loadingAssets && <p className="home-empty-text">暂无作品</p>
          )}
        </section>
      </main>
    </div>
  )
}
