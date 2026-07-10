import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Film,
  Sparkles,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_COUNTS,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  type VideoAspectRatio,
  type VideoMode,
  type VideoNodeData,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import type { VideoModelOption } from '../utils/videoModels'
import type { VideoGenerationHistoryItem } from '../utils/videoGenerationHistory'
import { MentionablePromptEditor, type MentionImage } from './MentionablePromptEditor'
import { ReferenceAssetStrip } from './ReferenceAssetStrip'
import { VideoGenerationHistoryStrip } from './VideoGenerationHistoryStrip'

interface VideoGenerationPanelProps {
  closing?: boolean
  prompt: string
  referenceAssetIds: string[]
  mentionImages?: MentionImage[]
  /** 上游文本节点提示词简介（胶囊展示） */
  upstreamTextBrief?: string
  /** 上游文本全文（悬停 title） */
  upstreamTextFull?: string
  modelOptions: VideoModelOption[]
  selectedModelId: string
  modelMenuOpen: boolean
  qualityMenuOpen: boolean
  countMenuOpen: boolean
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  durationSeconds: number
  count: VideoNodeData['count']
  running: boolean
  sendError?: string
  historyItems?: VideoGenerationHistoryItem[]
  currentAssetId?: string
  videoMode: VideoMode
  onPromptChange: (prompt: string) => void
  onVideoModeChange: (mode: VideoMode) => void
  onModelToggle: () => void
  onSelectModel: (modelId: string) => void
  onQualityToggle: () => void
  onAspectRatioChange: (ratio: VideoAspectRatio) => void
  onResolutionChange: (resolution: VideoResolution) => void
  onDurationChange: (durationSeconds: number) => void
  onCountToggle: () => void
  onCountChange: (count: VideoNodeData['count']) => void
  onRemoveReference?: (assetId: string) => void
  onSelectHistory?: (item: VideoGenerationHistoryItem) => void
  onSend: () => void
}

const VIDEO_REFERENCE_MODES: Array<{ id: VideoMode; label: string }> = [
  { id: 'first_last_frame', label: '首尾帧' },
  { id: 'image_reference', label: '多图参考' },
  { id: 'action_mimic', label: '动作模仿' },
  { id: 'all_reference', label: '全能参考' },
]

export function VideoGenerationPanel({
  closing = false,
  prompt,
  referenceAssetIds,
  mentionImages = [],
  upstreamTextBrief = '',
  upstreamTextFull = '',
  modelOptions,
  selectedModelId,
  modelMenuOpen,
  qualityMenuOpen,
  countMenuOpen,
  aspectRatio,
  resolution,
  durationSeconds,
  count,
  running,
  sendError = '',
  historyItems = [],
  currentAssetId,
  videoMode,
  onPromptChange,
  onVideoModeChange,
  onModelToggle,
  onSelectModel,
  onQualityToggle,
  onAspectRatioChange,
  onResolutionChange,
  onDurationChange,
  onCountToggle,
  onCountChange,
  onRemoveReference,
  onSelectHistory,
  onSend,
}: VideoGenerationPanelProps) {
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ??
    modelOptions[0]
  const minDuration = VIDEO_DURATIONS[0] ?? 4
  const maxDuration = VIDEO_DURATIONS[VIDEO_DURATIONS.length - 1] ?? 15
  const durationProgress =
    maxDuration === minDuration
      ? 100
      : ((durationSeconds - minDuration) / (maxDuration - minDuration)) * 100

  return (
    <div
      className={`image-editor-panel video-generation-panel nodrag nopan${
        closing ? ' closing' : ''
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      {referenceAssetIds.length > 0 ? (
        <div className="video-reference-mode-tabs" aria-label="视频参考模式">
          {VIDEO_REFERENCE_MODES.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={mode.id === videoMode ? 'selected' : ''}
              onClick={() => onVideoModeChange(mode.id)}
              disabled={running}
              title={mode.label}
            >
              {mode.label}
            </button>
          ))}
        </div>
      ) : null}

      <ReferenceAssetStrip
        assetIds={referenceAssetIds}
        onRemove={onRemoveReference}
      />

      {upstreamTextBrief ? (
        <div className="reference-text-strip" aria-label="已引用文本提示词">
          <span className="reference-text-chip" title={upstreamTextFull || upstreamTextBrief}>
            <FileText size={13} strokeWidth={1.8} />
            <span className="reference-text-chip-tag">文本提示词</span>
            <span className="reference-text-chip-label">{upstreamTextBrief}</span>
          </span>
        </div>
      ) : null}

      <MentionablePromptEditor
        value={prompt}
        onChange={onPromptChange}
        placeholder={
          upstreamTextBrief
            ? '已引用上游文本，可直接发送；也可在此补充或覆盖视频提示词'
            : '描述视频画面，输入 @ 可引用上游图片'
        }
        disabled={running}
        mentionImages={mentionImages}
      />

      <div className="image-editor-bottom">
        <div className="image-editor-menu-anchor">
          <button
            type="button"
            className="image-editor-model-button"
            onClick={onModelToggle}
            disabled={running}
          >
            <Sparkles size={19} strokeWidth={1.8} />
            <span>{selectedModel?.label ?? '选择视频模型'}</span>
            <ChevronDown size={16} strokeWidth={1.8} />
          </button>
          {modelMenuOpen ? (
            <div className="image-model-menu">
              {modelOptions.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  className={`image-model-option${
                    model.id === selectedModel?.id ? ' selected' : ''
                  }`}
                  onClick={() => onSelectModel(model.id)}
                >
                  <span className="image-model-icon">
                    <Film size={17} strokeWidth={1.8} />
                  </span>
                  <span className="image-model-copy">
                    <strong>{model.label}</strong>
                  </span>
                  {model.id === selectedModel?.id ? (
                    <Check size={15} strokeWidth={1.8} />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="image-editor-menu-anchor">
          <button
            type="button"
            className="image-editor-pill"
            onClick={onQualityToggle}
            disabled={running}
          >
            <span>{`${aspectRatio} · ${resolution} · ${durationSeconds}s`}</span>
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>
          {qualityMenuOpen ? (
            <div className="image-quality-menu video-quality-menu">
              <div className="image-quality-section">
                <span>比例</span>
                <div className="image-ratio-grid video-ratio-grid">
                  {VIDEO_ASPECT_RATIOS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={item === aspectRatio ? 'selected' : ''}
                      onClick={() => onAspectRatioChange(item)}
                    >
                      <span className="image-ratio-icon" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="image-quality-section">
                <span>分辨率</span>
                <div className="image-quality-row">
                  {VIDEO_RESOLUTIONS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={item === resolution ? 'selected' : ''}
                      onClick={() => onResolutionChange(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="image-quality-section">
                <div className="video-duration-head">
                  <span>时长</span>
                  <strong>{durationSeconds}s</strong>
                </div>
                <div
                  className="video-duration-slider"
                  style={
                    {
                      '--video-duration-progress': `${durationProgress}%`,
                    } as CSSProperties
                  }
                >
                  <input
                    type="range"
                    min={minDuration}
                    max={maxDuration}
                    step={1}
                    value={durationSeconds}
                    disabled={running}
                    aria-label="视频时长"
                    onChange={(event) =>
                      onDurationChange(Number(event.currentTarget.value))
                    }
                  />
                  <div className="video-duration-ticks" aria-hidden="true">
                    {VIDEO_DURATIONS.map((item) => (
                      <i key={item} />
                    ))}
                  </div>
                  <div className="video-duration-labels" aria-hidden="true">
                    {VIDEO_DURATIONS.map((item) => (
                      <span
                        key={item}
                        className={item === durationSeconds ? 'selected' : ''}
                      >
                        {item}s
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="image-editor-menu-anchor image-editor-menu-anchor-end">
          <button
            type="button"
            className="image-editor-pill image-editor-count-button"
            onClick={onCountToggle}
            disabled={running}
          >
            <span>{count}条</span>
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>
          {countMenuOpen ? (
            <div className="image-count-menu">
              {VIDEO_COUNTS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={item === count ? 'selected' : ''}
                  onClick={() => onCountChange(item)}
                >
                  {item}条
                  {item === count ? <Check size={15} strokeWidth={1.8} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="image-editor-send"
          onClick={onSend}
          disabled={running}
          aria-label="发送生成视频"
          title={running ? '正在生成' : '发送生成视频'}
        >
          <ArrowUp size={20} strokeWidth={2} />
        </button>
      </div>

      {sendError ? (
        <div className="image-editor-status error">{sendError}</div>
      ) : null}
      {onSelectHistory ? (
        <VideoGenerationHistoryStrip
          items={historyItems}
          currentAssetId={currentAssetId}
          onSelect={onSelectHistory}
        />
      ) : null}
    </div>
  )
}

export default VideoGenerationPanel
