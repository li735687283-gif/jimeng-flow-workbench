import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft } from 'lucide-react'
import { CanvasView } from './components/canvas/CanvasView'
import { CanvasBottomToolbar } from './components/canvas/CanvasBottomToolbar'
import { AssetLibraryModal } from './components/AssetLibraryModal'
import { AgentPanel } from './components/AgentPanel'
import { FlowsHistoryModal } from './components/FlowsHistoryModal'
import { HomePage } from './components/HomePage'
import { SettingsModal } from './components/SettingsModal'
import { VideoAdminModal } from './components/VideoAdminModal'
import { useCanvasStore } from './state/canvasStore'
import { useFlowStore } from './state/flowStore'
import { useSettingsStore } from './state/settingsStore'
import { useAutoSave } from './hooks/useAutoSave'
import { listAssets } from './api/assets'
import { listFeaturedVideos } from './api/videos'
import {
  buildAssetInsertPatch,
  buildAssetRestorePatch,
  resolveAssetSourceNodeId,
} from './utils/assetLibrarySelection'
import type { Asset } from '@jimeng-flow/shared/asset'
import type { FlowNodeType } from './types/nodeTypes'
import type { ManagedVideo } from '@jimeng-flow/shared/video'
import agentAvatarUrl from '../../../image/agent-avatar-black.png'
import defaultHeroUrl from './assets/hero.png'
import './App.css'

type AppView = 'home' | 'canvas'

function resolveHomeHeroImage(path: string | undefined): string {
  const trimmed = path?.trim()
  return trimmed || defaultHeroUrl
}

function AppInner() {
  const [view, setView] = useState<AppView>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openModalOpen, setOpenModalOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(true)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)
  const [videoAdminOpen, setVideoAdminOpen] = useState(false)
  const [homeAssets, setHomeAssets] = useState<Asset[]>([])
  const [showcaseAssets, setShowcaseAssets] = useState<Asset[]>([])
  const [featuredVideos, setFeaturedVideos] = useState<ManagedVideo[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  const addNode = useCanvasStore((s) => s.addNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const currentFlowId = useFlowStore((s) => s.currentFlowId)
  const flowList = useFlowStore((s) => s.flowList)
  const flowsLoading = useFlowStore((s) => s.loading)
  const loadFlowList = useFlowStore((s) => s.loadFlowList)
  const loadFlow = useFlowStore((s) => s.loadFlow)
  const createFlow = useFlowStore((s) => s.createFlow)
  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const { fitView, screenToFlowPosition } = useReactFlow()
  const centeredFlowIdRef = useRef<string | null>(null)

  // 仅进入画布后启用自动保存，避免首页默认打开时创建空工作流。
  useAutoSave(view === 'canvas')

  const reloadFeaturedVideos = useCallback(async () => {
    const videos = await listFeaturedVideos()
    setFeaturedVideos(videos)
  }, [])

  useEffect(() => {
    loadSettings().catch((err: unknown) => {
      console.error('[App] 加载设置失败:', err)
    })
  }, [loadSettings])

  useEffect(() => {
    if (view !== 'home') return

    let cancelled = false
    loadFlowList().catch((err: unknown) => {
      console.error('[App] 加载最近项目失败:', err)
    })

    setAssetsLoading(true)
    Promise.allSettled([listAssets(), listFeaturedVideos()])
      .then(([assetsResult, videosResult]) => {
        if (cancelled) return

        if (assetsResult.status === 'fulfilled') {
          setHomeAssets(assetsResult.value)
          setShowcaseAssets(assetsResult.value.filter((asset) => asset.showcase === true))
        } else {
          console.error('[App] 加载首页作品失败:', assetsResult.reason)
          setHomeAssets([])
          setShowcaseAssets([])
        }

        if (videosResult.status === 'fulfilled') {
          setFeaturedVideos(videosResult.value)
        } else {
          console.error('[App] 加载首页精选视频失败:', videosResult.reason)
          setFeaturedVideos([])
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
    if (!currentFlowId) {
      centeredFlowIdRef.current = null
      return
    }
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

  const handleSelectAsset = useCallback(
    (asset: Asset) => {
      const sourceNodeId = resolveAssetSourceNodeId(
        asset,
        nodes.map((node) => node.id),
      )

      if (sourceNodeId) {
        const sourceNode = nodes.find((node) => node.id === sourceNodeId)
        if (!sourceNode) return

        const patch = buildAssetRestorePatch(asset, sourceNode)
        if (patch) updateNodeData(sourceNodeId, patch)

        setSelectedNode(sourceNodeId)
        setAssetLibraryOpen(false)
        void fitView({
          nodes: [{ id: sourceNodeId }],
          padding: 0.45,
          duration: 320,
          maxZoom: 1,
        })
        return
      }

      const nodeId = addNode(asset.type, getCanvasCenterPosition())
      const patch = buildAssetInsertPatch(asset)
      if (nodeId && patch) updateNodeData(nodeId, patch)
      setAssetLibraryOpen(false)
      if (nodeId) {
        void fitView({
          nodes: [{ id: nodeId }],
          padding: 0.45,
          duration: 320,
          maxZoom: 1,
        })
      }
    },
    [
      addNode,
      fitView,
      getCanvasCenterPosition,
      nodes,
      setSelectedNode,
      updateNodeData,
    ],
  )

  return (
    <div className="app-layout mature-layout">
      {view === 'home' ? (
        <HomePage
          recentFlows={flowList}
          showcaseAssets={showcaseAssets}
          workAssets={homeAssets}
          featuredVideos={featuredVideos}
          heroImageUrl={resolveHomeHeroImage(settings?.homeHeroImagePath)}
          logoImageUrl={agentAvatarUrl}
          loadingFlows={flowsLoading}
          loadingAssets={assetsLoading}
          onCreateFlow={handleCreateFlow}
          onOpenFlow={handleOpenFlow}
          onOpenAllFlows={() => setOpenModalOpen(true)}
          onOpenAssetLibrary={() => setAssetLibraryOpen(true)}
          onOpenVideoAdmin={() => setVideoAdminOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnHome={handleShowHome}
        />
      ) : (
        <main className="canvas-stage">
          <CanvasView />

          <div className="canvas-topbar canvas-topbar-left">
            <button type="button" className="ghost-pill" onClick={handleShowHome}>
              <ArrowLeft size={14} />
              <span>返回</span>
            </button>
          </div>

          <CanvasBottomToolbar
            onAddNode={() => handleSelectFromLibrary('text')}
            onOpenAssetLibrary={() => setAssetLibraryOpen(true)}
            onOpenHistory={() => setOpenModalOpen(true)}
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
        onSelectAsset={view === 'canvas' ? handleSelectAsset : undefined}
      />

      <VideoAdminModal
        open={videoAdminOpen}
        onClose={() => setVideoAdminOpen(false)}
        onVideosChanged={() => {
          void reloadFeaturedVideos().catch((err: unknown) => {
            console.error('[App] 刷新首页精选视频失败:', err)
          })
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
