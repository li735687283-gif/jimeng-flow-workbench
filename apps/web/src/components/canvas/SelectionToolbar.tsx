import { useMemo, useRef, useState, useEffect } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import {
  LayoutGrid,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Group,
  Ungroup,
  FileArchive,
  Loader2,
  Palette,
  Check,
} from 'lucide-react'
import { useCanvasStore } from '../../state/canvasStore'
import {
  getCompleteGroupId,
  getGroupColor,
  getGroupMembers,
  getNodesBounds,
  isGroupFrame,
  GROUP_COLOR_PRESETS,
} from '../../utils/nodeGroup'
import {
  collectGroupAssets,
  buildZipEntries,
  downloadAssetsAsZip,
} from '../../utils/batchDownload'

interface SelectionToolbarProps {
  selectedNodeIds: string[]
}

const TOOLBAR_OFFSET = 12

export function SelectionToolbar({
  selectedNodeIds,
}: SelectionToolbarProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const arrangeGrid = useCanvasStore((s) => s.arrangeGrid)
  const arrangeHorizontal = useCanvasStore((s) => s.arrangeHorizontal)
  const arrangeVertical = useCanvasStore((s) => s.arrangeVertical)
  const groupNodes = useCanvasStore((s) => s.groupNodes)
  const ungroupNodes = useCanvasStore((s) => s.ungroupNodes)
  const { flowToScreenPosition } = useReactFlow()
  const [downloading, setDownloading] = useState(false)
  // 订阅视口变换，平移/缩放画布时工具栏跟随选区移动
  const transform = useStore((s) => s.transform)

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.includes(n.id)),
    [nodes, selectedNodeIds],
  )
  const hasFrameSelected = useMemo(
    () => selectedNodes.some(isGroupFrame),
    [selectedNodes],
  )
  const position = useMemo(() => {
    // 选中画框（哪怕只有它自己）时也要显示工具栏：解组/换色/排列成员都从这里进
    if ((selectedNodeIds.length < 2 && !hasFrameSelected) || selectedNodes.length === 0) return null
    const bounds = getNodesBounds(selectedNodes)
    if (!bounds) return null
    return flowToScreenPosition({
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.minY,
    })
  }, [selectedNodeIds, selectedNodes, hasFrameSelected, flowToScreenPosition, transform])

  const completeGroupId = useMemo(
    () => getCompleteGroupId(nodes, selectedNodeIds),
    [nodes, selectedNodeIds],
  )
  // 选区里直接包含的 frame，或选区恰好覆盖的完整组对应的 frame
  const activeFrame = useMemo(() => {
    const direct = nodes.find((n) => selectedNodeIds.includes(n.id) && isGroupFrame(n))
    if (direct) return direct
    if (completeGroupId) return nodes.find((n) => n.id === completeGroupId) ?? null
    return null
  }, [nodes, selectedNodeIds, completeGroupId])
  const normalSelectedIds = useMemo(
    () => selectedNodes.filter((n) => !isGroupFrame(n)).map((n) => n.id),
    [selectedNodes],
  )
  // 排列目标：优先当前选中的普通节点；只选中画框时排列它的成员
  const arrangeTargetIds = useMemo(() => {
    if (normalSelectedIds.length >= 2) return normalSelectedIds
    if (activeFrame) return getGroupMembers(nodes, activeFrame.id).map((n) => n.id)
    return normalSelectedIds
  }, [normalSelectedIds, activeFrame, nodes])
  const canArrange = arrangeTargetIds.length >= 2
  const canGroup = normalSelectedIds.length >= 2
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colorMenuOpen) return
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setColorMenuOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [colorMenuOpen])
  // 打包下载只在组场景出现：下载组内全部成员的图片和视频，与当前选区无关
  const downloadGroups = useMemo(
    () => (activeFrame ? collectGroupAssets(nodes, activeFrame.id) : []),
    [nodes, activeFrame],
  )
  const downloadableCount = useMemo(
    () => downloadGroups.reduce((sum, group) => sum + group.items.length, 0),
    [downloadGroups],
  )

  if (!position) return null

  const handleDownload = async () => {
    if (downloading || downloadableCount === 0) return
    setDownloading(true)
    try {
      await downloadAssetsAsZip(buildZipEntries(downloadGroups))
    } catch (error) {
      console.error('[SelectionToolbar] 打包下载组内素材失败', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <style>{`
        .selection-toolbar {
          position: fixed;
          z-index: 100;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 2px;
          padding: 4px;
          background: var(--menu-surface-bg);
          border: 1px solid var(--menu-surface-border);
          border-radius: var(--menu-surface-radius);
          box-shadow: var(--menu-surface-shadow);
          backdrop-filter: var(--menu-surface-blur);
          transform: translate(-50%, -100%);
        }
        .selection-toolbar-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          padding: 0;
          background: transparent;
          color: var(--menu-item-text);
          border: none;
          border-radius: var(--menu-item-radius);
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .selection-toolbar-button:hover:not(:disabled) {
          background: var(--menu-item-hover-bg);
          color: #fff;
        }
        .selection-toolbar-button:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .selection-toolbar-button .spin {
          animation: selection-toolbar-spin 0.9s linear infinite;
        }
        .selection-toolbar-swatch {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 3px;
          margin-left: 3px;
          border: 1px solid rgba(255, 255, 255, 0.35);
        }
        .selection-toolbar-swatch.large {
          width: 14px;
          height: 14px;
          margin-left: 0;
        }
        .selection-toolbar-color-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: row;
          gap: 2px;
          padding: 4px;
          background: var(--menu-surface-bg);
          border: 1px solid var(--menu-surface-border);
          border-radius: var(--menu-surface-radius);
          box-shadow: var(--menu-surface-shadow);
        }
        @keyframes selection-toolbar-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        ref={containerRef}
        className="selection-toolbar"
        style={{ left: position.x, top: position.y - TOOLBAR_OFFSET }}
      >
        <button
          type="button"
          className="selection-toolbar-button"
          title="宫格排列"
          disabled={!canArrange}
          onClick={() => arrangeGrid(arrangeTargetIds)}
        >
          <LayoutGrid size={15} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="selection-toolbar-button"
          title="水平排列"
          disabled={!canArrange}
          onClick={() => arrangeHorizontal(arrangeTargetIds)}
        >
          <AlignHorizontalDistributeCenter size={15} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="selection-toolbar-button"
          title="垂直排列"
          disabled={!canArrange}
          onClick={() => arrangeVertical(arrangeTargetIds)}
        >
          <AlignVerticalDistributeCenter size={15} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="selection-toolbar-button"
          title={activeFrame ? '解组' : '打组'}
          disabled={!activeFrame && !canGroup}
          onClick={() =>
            activeFrame
              ? ungroupNodes(selectedNodeIds)
              : groupNodes(normalSelectedIds)
          }
        >
          {activeFrame ? (
            <Ungroup size={15} strokeWidth={1.6} />
          ) : (
            <Group size={15} strokeWidth={1.6} />
          )}
        </button>
        {activeFrame ? (
          <button
            type="button"
            className="selection-toolbar-button"
            title="组颜色"
            aria-haspopup="menu"
            aria-expanded={colorMenuOpen}
            onClick={() => setColorMenuOpen((open) => !open)}
          >
            <Palette size={15} strokeWidth={1.6} />
            <span
              className="selection-toolbar-swatch"
              style={{ background: getGroupColor(activeFrame) }}
              aria-hidden="true"
            />
          </button>
        ) : null}
        {colorMenuOpen && activeFrame ? (
          <div className="selection-toolbar-color-menu" role="menu" aria-label="选择组颜色">
            {GROUP_COLOR_PRESETS.map((preset) => {
              const activePreset = preset.color === getGroupColor(activeFrame)
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activePreset}
                  className="selection-toolbar-button"
                  title={preset.label}
                  onClick={() => {
                    updateNodeData(activeFrame.id, { color: preset.color })
                    setColorMenuOpen(false)
                  }}
                >
                  <span
                    className="selection-toolbar-swatch large"
                    style={{ background: preset.color }}
                    aria-hidden="true"
                  />
                  {activePreset ? <Check size={12} strokeWidth={2} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        {activeFrame ? (
          <button
            type="button"
            className="selection-toolbar-button"
            title={
              downloadableCount > 0
                ? `打包下载组内素材（${downloadableCount} 个）`
                : '组内没有可下载的素材'
            }
            disabled={downloading || downloadableCount === 0}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 size={15} strokeWidth={1.6} className="spin" />
            ) : (
              <FileArchive size={15} strokeWidth={1.6} />
            )}
          </button>
        ) : null}
      </div>
    </>
  )
}
