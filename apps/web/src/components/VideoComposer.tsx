import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Film, Sparkles, Volume2 } from 'lucide-react'
import { useCanvasStore } from '../state/canvasStore'
import {
  VIDEO_MODELS,
  VIDEO_MODES,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_DURATIONS,
  VIDEO_COUNTS,
  mergeVideoDefaults,
  type VideoNodeData,
  type VideoGenerationRequest,
  type VideoMode,
  type VideoAspectRatio,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'

interface VideoComposerProps {
  nodeId: string
}

const selectStyle: CSSProperties = {
  background: 'var(--bg-base)',
  color: 'var(--text-h)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  minWidth: 72,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inactiveBtn: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg-base)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  minWidth: 30,
}

function activeBtn(base: CSSProperties): CSSProperties {
  return {
    ...base,
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

export function VideoComposer({ nodeId }: VideoComposerProps) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [notice, setNotice] = useState<string | null>(null)

  if (!node) {
    return (
      <div className="bottom-panel-content">
        <span className="bottom-placeholder">未选中视频节点</span>
      </div>
    )
  }

  const d = mergeVideoDefaults(node.data as Partial<VideoNodeData>)
  const set = (partial: Partial<VideoNodeData>) =>
    updateNodeData(nodeId, partial)

  const is4kDisabled = d.model === 'seedance-2.0-mini'
  const modeLabel =
    VIDEO_MODES.find((m) => m.id === d.mode)?.label ?? d.mode

  const handleSubmit = () => {
    const req: VideoGenerationRequest = {
      flowId: 'local',
      nodeId,
      mediaType: 'video',
      mode: d.mode,
      prompt: d.prompt,
      inputImages: d.inputImageAssetIds,
      model: d.model,
      aspectRatio: d.aspectRatio,
      resolution: d.resolution,
      quality: d.quality,
      durationSeconds: d.durationSeconds,
      count: d.count,
      generateAudio: d.generateAudio,
    }
    // M0：不真正调用后端，仅打印请求结构并复位状态
    console.log('[VideoComposer] submit (M0 stub)', req)
    updateNodeData(nodeId, { status: 'idle' })
    setNotice('视频生成功能将在后续版本接入（请求结构已打印到控制台）')
    window.setTimeout(() => setNotice(null), 3500)
  }

  return (
    <div
      style={{
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* 标题行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-h)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Film size={14} strokeWidth={1.6} />
          视频 Composer
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          {d.model} · {modeLabel}
        </span>
      </div>

      {/* 控件行 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <Field label="模型">
          <select
            style={selectStyle}
            value={d.model}
            onChange={(e) => set({ model: e.target.value })}
          >
            {VIDEO_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="模式">
          <select
            style={selectStyle}
            value={d.mode}
            onChange={(e) => set({ mode: e.target.value as VideoMode })}
          >
            {VIDEO_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="比例">
          <select
            style={selectStyle}
            value={d.aspectRatio}
            onChange={(e) =>
              set({ aspectRatio: e.target.value as VideoAspectRatio })
            }
          >
            {VIDEO_ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="分辨率">
          <select
            style={selectStyle}
            value={d.resolution}
            onChange={(e) =>
              set({ resolution: e.target.value as VideoResolution })
            }
          >
            {VIDEO_RESOLUTIONS.map((r) => (
              <option
                key={r}
                value={r}
                disabled={r === '4K' && is4kDisabled}
              >
                {r}
                {r === '4K' && is4kDisabled ? '（不可用）' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="秒数">
          <select
            style={selectStyle}
            value={d.durationSeconds}
            onChange={(e) =>
              set({ durationSeconds: Number(e.target.value) })
            }
          >
            {VIDEO_DURATIONS.map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </Field>

        <Field label="数量">
          <div style={{ display: 'flex', gap: 4 }}>
            {VIDEO_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                style={d.count === c ? activeBtn(inactiveBtn) : inactiveBtn}
                onClick={() => set({ count: c })}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="音频">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: 11,
              padding: '4px 0',
            }}
          >
            <input
              type="checkbox"
              checked={d.generateAudio}
              onChange={(e) => set({ generateAudio: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <Volume2 size={12} strokeWidth={1.6} />
            {d.generateAudio ? '开' : '关'}
          </label>
        </Field>
      </div>

      {/* Prompt + 提交 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 48 }}>
        <textarea
          value={d.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          placeholder="描述生成画面内容，支持 @ 引用素材…"
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--bg-base)',
            color: 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            alignSelf: 'stretch',
            padding: '0 18px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
        >
          <Sparkles size={13} strokeWidth={1.8} />
          生成
        </button>
      </div>

      {notice && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {notice}
        </div>
      )}
    </div>
  )
}

export default VideoComposer
