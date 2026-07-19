import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft } from 'lucide-react'
import {
  CanvasView,
  type CanvasViewHandle,
} from './components/canvas/CanvasView'
import { CanvasBottomToolbar } from './components/canvas/CanvasBottomToolbar'
import { AssetLibraryModal } from './components/AssetLibraryModal'
import { AgentPanel } from './components/AgentPanel'
import { FlowsHistoryModal } from './components/FlowsHistoryModal'
import { HomePage } from './components/HomePage'
import { SettingsModal } from './components/SettingsModal'
import { VideoAdminModal } from './components/VideoAdminModal'
import { VideoPlayerModal } from './components/VideoPlayerModal'
import { useCanvasStore } from './state/canvasStore'
import { useFlowStore } from './state/flowStore'
import { useSettingsStore } from './state/settingsStore'
import { useVideoPlayerStore } from './state/videoPlayerStore'
import { useAutoSave } from './hooks/useAutoSave'
import { listAssets } from './api/assets'
import { listFeaturedWorks, listGalleryWorks } from './api/videos'
import { startLastFlowRestore } from './utils/lastFlowRestore'
import { resolveInitialAppView } from './utils/initialAppView'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { FlowNodeType } from './types/nodeTypes'
import type { ManagedWork } from '@jimeng-flow/shared/video'
import agentAvatarUrl from '../../../image/agent-avatar-black.png'
import defaultMokHeroUrl from './assets/mok-hero.png'
import './App.css'

type AppView = 'home' | 'canvas'

const LAST_VIEW_KEY = 'jimeng-flow:lastView'
const LAST_FLOW_ID_KEY = 'jimeng-flow:lastFlowId'

function getLastView(): AppView {
  if (typeof window === 'undefined') return 'home'
  return resolveInitialAppView({
    pathname: window.location.pathname,
    search: window.location.search,
    storedView: window.localStorage.getItem(LAST_VIEW_KEY),
  })
}

function setLastView(view: AppView) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_VIEW_KEY, view)
}

function getLastFlowId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LAST_FLOW_ID_KEY)
}

function setLastFlowId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) {
    window.localStorage.setItem(LAST_FLOW_ID_KEY, id)
  } else {
    window.localStorage.removeItem(LAST_FLOW_ID_KEY)
  }
}

function resolveHomeMokHeroImage(path: string | undefined): string {
  const trimmed = path?.trim()
  return trimmed || defaultMokHeroUrl
}

function resolveHomeMokHeroStyles(settings: {
  homeMokHeroScale?: number
  homeMokHeroOffsetX?: number
  homeMokHeroOffsetY?: number
  homeMokHeroMarginTop?: number
} | null | undefined): { container: CSSProperties; image: CSSProperties } {
  const scale = settings?.homeMokHeroScale ?? 1
  const offsetX = settings?.homeMokHeroOffsetX ?? 0
  const offsetY = settings?.homeMokHeroOffsetY ?? 0
  const marginTop = settings?.homeMokHeroMarginTop ?? 0
  const baseMaxWidth = 460
  return {
    container: {
      marginTop: `${marginTop}px`,
      position: 'relative',
      top: '84px',
    },
    image: {
      maxWidth: `${baseMaxWidth * scale}px`,
      width: `${Math.min(100 * scale, 100)}%`,
      transform: `translate(${offsetX}px, ${offsetY}px)`,
    },
  }
}

function AppInner() {
  const [view, setView] = useState<AppView>(getLastView)
  const [restoringView, setRestoringView] = useState(() => getLastView() === 'canvas')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)
  const [generationHistoryOpen, setGenerationHistoryOpen] = useState(false)
  const [videoAdminOpen, setVideoAdminOpen] = useState(false)
  const videoPlayer = useVideoPlayerStore((s) => s.player)
  const openVideoPlayer = useVideoPlayerStore((s) => s.openPlayer)
  const [homeAssets, setHomeAssets] = useState<Asset[]>([])
  const [showcaseAssets, setShowcaseAssets] = useState<Asset[]>([])
  const [featuredWorks, setFeaturedWorks] = useState<ManagedWork[]>([])
  const [galleryWorks, setGalleryWorks] = useState<ManagedWork[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  const addNode = useCanvasStore((s) => s.addNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const currentFlowId = useFlowStore((s) => s.currentFlowId)
  const flowList = useFlowStore((s) => s.flowList)
  const flowsLoading = useFlowStore((s) => s.loading)
  const loadFlowList = useFlowStore((s) => s.loadFlowList)
  const loadFlow = useFlowStore((s) => s.loadFlow)
  const createFlow = useFlowStore((s) => s.createFlow)
  const renameFlowAction = useFlowStore((s) => s.renameFlow)
  const deleteFlowAction = useFlowStore((s) => s.deleteFlow)
  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const centeredFlowIdRef = useRef<string | null>(null)
  const restoringFlowIdRef = useRef<string | null>(null)
  const lastSavedFlowIdRef = useRef<string | null>(currentFlowId)
  const canvasViewRef = useRef<CanvasViewHandle>(null)

  // 仅进入画布后启用自动保存，避免首页默认打开时创建空工作流。
  // 恢复上次画布期间先禁用，避免与恢复逻辑冲突。
  useAutoSave(view === 'canvas' && !restoringView)

  const reloadWorks = useCallback(async () => {
    try {
      const [featured, gallery] = await Promise.all([
        listFeaturedWorks(),
        listGalleryWorks(),
      ])
      setFeaturedWorks(featured)
      setGalleryWorks(gallery)
    } catch (err: unknown) {
      console.error('[App] 加载首页作品失败:', err)
    }
  }, [])

  useEffect(() => {
    loadSettings().catch((err: unknown) => {
      console.error('[App] 加载设置失败:', err)
    })
    void reloadWorks()
  }, [loadSettings, reloadWorks])

  useEffect(() => {
    setLastView(view)
    if (view !== 'canvas') setAgentOpen(false)
  }, [view])

  useEffect(() => {
    // 跳过初始挂载时的 null 值，避免在恢复逻辑读取前清空 lastFlowId
    if (lastSavedFlowIdRef.current === currentFlowId) return
    lastSavedFlowIdRef.current = currentFlowId
    setLastFlowId(currentFlowId)
  }, [currentFlowId])

  useEffect(() => {
    if (view !== 'canvas') return
    if (currentFlowId) return

    const lastFlowId = getLastFlowId()
    if (!lastFlowId) return

    const restore = startLastFlowRestore({
      activeFlowId: restoringFlowIdRef,
      flowId: lastFlowId,
      loadFlow,
      getCurrentFlowId: () => useFlowStore.getState().currentFlowId,
      getStoredFlowId: getLastFlowId,
      clearStoredFlowId: () => {
        setLastFlowId(null)
        lastSavedFlowIdRef.current = null
      },
      onSettled: () => setRestoringView(false),
    })
    if (!restore) return

    setRestoringView(true)
    centeredFlowIdRef.current = lastFlowId
    void restore
      .then((result) => {
        if (result.status === 'restored' || result.status === 'stale') return
        if (result.status === 'failed') {
          console.error('[App] 恢复上次画布失败:', result.error)
        }
        centeredFlowIdRef.current = null
        setView('home')
      })
  }, [view, currentFlowId, loadFlow])

  useEffect(() => {
    if (view !== 'home') return

    let cancelled = false
    loadFlowList().catch((err: unknown) => {
      console.error('[App] 加载最近项目失败:', err)
    })

    setAssetsLoading(true)
    Promise.allSettled([listAssets(), listFeaturedWorks(), listGalleryWorks()])
      .then(([assetsResult, featuredResult, galleryResult]) => {
        if (cancelled) return

        if (assetsResult.status === 'fulfilled') {
          setHomeAssets(assetsResult.value)
          setShowcaseAssets(assetsResult.value.filter((asset) => asset.showcase === true))
        } else {
          console.error('[App] 加载首页资产失败:', assetsResult.reason)
          setHomeAssets([])
          setShowcaseAssets([])
        }

        if (featuredResult.status === 'fulfilled') {
          setFeaturedWorks(featuredResult.value)
        } else {
          console.error('[App] 加载首页精选作品失败:', featuredResult.reason)
          setFeaturedWorks([])
        }

        if (galleryResult.status === 'fulfilled') {
          setGalleryWorks(galleryResult.value)
        } else {
          console.error('[App] 加载首页作品展示失败:', galleryResult.reason)
          setGalleryWorks([])
        }
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadFlowList, view])

  useEffect(() => {
    if (view !== 'canvas') return
    if (!currentFlowId) return
    if (centeredFlowIdRef.current === currentFlowId) return

    centeredFlowIdRef.current = currentFlowId
    if (nodes.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      void fitView({
        padding: 0.2,
        duration: 0,
        maxZoom: 1,
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [currentFlowId, fitView, nodes.length, view])

  const getCanvasCenterPosition = useCallback(() => {
    const canvasEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!canvasEl) return { x: 250, y: 200 }

    const rect = canvasEl.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [screenToFlowPosition])

  const handleSelectFromLibrary = useCallback(
    (type: FlowNodeType) => {
      addNode(type, getCanvasCenterPosition())
    },
    [addNode, getCanvasCenterPosition],
  )

  const handleLocateNodes = useCallback(() => {
    void fitView({ padding: 0.2, duration: 320 })
  }, [fitView])

  const handleCreateFlow = useCallback(async () => {
    try {
      await createFlow()
      setView('canvas')
    } catch (err: unknown) {
      console.error('[App] 新建画布失败:', err)
    }
  }, [createFlow])

  const handleOpenFlow = useCallback(
    async (id: string) => {
      try {
        await loadFlow(id)
        setView('canvas')
      } catch (err: unknown) {
        console.error('[App] 打开项目失败:', err)
      }
    },
    [loadFlow],
  )

  const handleShowHome = useCallback(() => {
    setView('home')
  }, [])

  const handlePlayVideo = useCallback(
    (src: string, title?: string) => {
      openVideoPlayer(src, title)
    },
    [openVideoPlayer],
  )

  const handleRenameFlow = useCallback(
    async (id: string, name: string) => {
      try {
        await renameFlowAction(id, name)
      } catch (err: unknown) {
        console.error('[App] 重命名失败:', err)
      }
    },
    [renameFlowAction],
  )

  const handleDeleteFlow = useCallback(
    async (id: string) => {
      try {
        await deleteFlowAction(id)
      } catch (err: unknown) {
        console.error('[App] 删除失败:', err)
      }
    },
    [deleteFlowAction],
  )

  return (
    <div className="app-layout mature-layout">
      {view === 'home' ? (
        <HomePage
          recentFlows={flowList}
          showcaseAssets={showcaseAssets}
          workAssets={homeAssets}
          featuredWorks={featuredWorks}
          galleryWorks={galleryWorks}
          mokHeroImageUrl={resolveHomeMokHeroImage(settings?.homeMokHeroImagePath)}
          mokHeroContainerStyle={resolveHomeMokHeroStyles(settings).container}
          mokHeroImageStyle={resolveHomeMokHeroStyles(settings).image}
          logoImageUrl={agentAvatarUrl}
          loadingFlows={flowsLoading}
          loadingAssets={assetsLoading}
          onCreateFlow={handleCreateFlow}
          onOpenFlow={handleOpenFlow}
          onOpenAllFlows={() => setOpenModalOpen(true)}
          onOpenAssetLibrary={() => setAssetLibraryOpen(true)}
          onOpenVideoAdmin={() => setVideoAdminOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onPlayVideo={handlePlayVideo}
          onRenameFlow={handleRenameFlow}
          onDeleteFlow={handleDeleteFlow}
        />
      ) : (
        <main className="canvas-stage">
          <CanvasView ref={canvasViewRef} />

          {window.mokDesktop?.isDesktop ? (
            <div className="window-drag-strip" aria-hidden="true" />
          ) : null}

          <div className="canvas-topbar canvas-topbar-left">
            <button type="button" className="ghost-pill" onClick={handleShowHome}>
              <ArrowLeft size={14} />
              <span>返回</span>
            </button>
          </div>

          <CanvasBottomToolbar
            onAddNode={handleSelectFromLibrary}
            onUpload={() => canvasViewRef.current?.openUploadAtCenter()}
            onOpenAssetLibrary={() => setAssetLibraryOpen(true)}
            onOpenHistory={() => setGenerationHistoryOpen(true)}
            onLocateNodes={handleLocateNodes}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </main>
      )}

      {view === 'canvas' && agentOpen ? (
        <AgentPanel onClose={() => setAgentOpen(false)} />
      ) : view === 'canvas' ? (
        <button
          type="button"
          className="agent-launcher"
          onClick={() => setAgentOpen(true)}
          title="打开 Agent"
          aria-label="打开 Agent"
        >
          <img
            className="agent-launcher-avatar"
            src={agentAvatarUrl}
            alt=""
            aria-hidden="true"
          />
        </button>
      ) : null}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AssetLibraryModal
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
      />

      <AssetLibraryModal
        open={generationHistoryOpen}
        mode="history"
        projectId={currentFlowId}
        onClose={() => setGenerationHistoryOpen(false)}
      />

      <VideoAdminModal
        open={videoAdminOpen}
        onClose={() => setVideoAdminOpen(false)}
        onWorksChanged={() => {
          void reloadWorks().catch((err: unknown) => {
            console.error('[App] 刷新首页作品失败:', err)
          })
        }}
        onPlayVideo={handlePlayVideo}
      />

      <VideoPlayerModal
        open={!!videoPlayer}
        src={videoPlayer?.src ?? ''}
        title={videoPlayer?.title}
        onClose={() => {
          // 直接关全局 store，避免引用失效导致关不掉
          useVideoPlayerStore.getState().closePlayer()
        }}
      />

      <FlowsHistoryModal
        open={openModalOpen}
        onClose={() => setOpenModalOpen(false)}
        onFlowReady={() => setView('canvas')}
      />
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}

export default App
