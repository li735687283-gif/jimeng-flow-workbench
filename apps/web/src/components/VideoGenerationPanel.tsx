import {
  ArrowUp,
  Check,
  ChevronDown,
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
  type VideoNodeData,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import type { VideoModelOption } from '../utils/videoModels'
import { ReferenceAssetStrip } from './ReferenceAssetStrip'

interface VideoGenerationPanelProps {
  closing?: boolean
  prompt: string
  referenceAssetIds: string[]
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
  submitLabel: string
  sendError?: string
  onPromptChange: (prompt: string) => void
  onModelToggle: () => void
  onSelectModel: (modelId: string) => void
  onQualityToggle: () => void
  onAspectRatioChange: (ratio: VideoAspectRatio) => void
  onResolutionChange: (resolution: VideoResolution) => void
  onDurationChange: (durationSeconds: number) => void
  onCountToggle: () => void
  onCountChange: (count: VideoNodeData['count']) => void
  onRemoveReference?: (assetId: string) => void
  onSend: () => void
}

export function VideoGenerationPanel({
  closing = false,
  prompt,
  referenceAssetIds,
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
  submitLabel,
  sendError = '',
  onPromptChange,
  onModelToggle,
  onSelectModel,
  onQualityToggle,
  onAspectRatioChange,
  onResolutionChange,
  onDurationChange,
  onCountToggle,
  onCountChange,
  onRemoveReference,
  onSend,
}: VideoGenerationPanelProps) {
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ??
    modelOptions[0]
  const minDuration = VIDEO_DURATIONS[0] ?? 1
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
      <ReferenceAssetStrip
        assetIds={referenceAssetIds}
        onRemove={onRemoveReference}
      />

      <textarea
        className="image-editor-prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="描述视频画面，连接图片后可按图生视频、首尾帧或多图参考生成"
        disabled={running}
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
      {running ? (
        <div className="image-editor-status">{submitLabel}</div>
      ) : null}
    </div>
  )
}

export default VideoGenerationPanel
