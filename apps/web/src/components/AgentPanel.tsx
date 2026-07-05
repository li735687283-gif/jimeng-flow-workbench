import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  ArrowUp,
  AtSign,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
  Film,
} from 'lucide-react'
import type { PromptOptimizeRequest, AgentMessage } from '@jimeng-flow/shared/agentMessage'
import {
  IMAGE_COUNTS,
  IMAGE_MODELS,
  IMAGE_SIZES,
  type GenerationRequest,
  type GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import {
  VIDEO_MODELS,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_DURATIONS,
  VIDEO_COUNTS,
  type VideoGenerationRequest,
  type VideoAspectRatio,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import { optimizePrompt } from '../api/agent'
import { createGeneration } from '../api/generations'
import { listLlmModels, transcribeAudio } from '../api/llm'
import { useAgentStore } from '../state/agentStore'
import { useCanvasStore } from '../state/canvasStore'
import { useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import type { BaseNodeData } from '../types/nodeTypes'

type SpeechRecognitionResultLike = {
  readonly length: number
  item(index: number): { transcript: string }
  [index: number]: { transcript: string }
}

type SpeechRecognitionEventLike = {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    item(index: number): SpeechRecognitionResultLike
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const FALLBACK_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'claude-3.5-sonnet',
  'deepseek-chat',
  'doubao-seed-1.6',
]

const MIN_PANEL_WIDTH = 360

interface AgentPanelProps {
  onClose?: () => void
}

interface AgentSkill {
  id: string
  label: string
  description: string
  instruction: string
}

interface PendingImageRequest {
  id: string
  prompt: string
  contextNodeIds: string[]
}

interface ImageGenerationParams {
  model: string
  sizeId: string
  count: number
}

interface PendingVideoRequest {
  id: string
  prompt: string
  contextNodeIds: string[]
  sourceImageNodeIds?: string[]
}

interface VideoGenerationParams {
  model: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  durationSeconds: number
  count: number
  quality: 'standard' | 'high'
}

const AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'image-retouch',
    label: '图片修改',
    description: '围绕引用图片做局部修改、风格统一和图生图。',
    instruction: '优先保留引用图片主体，按用户要求做可执行的图像修改。',
  },
  {
    id: 'prompt-polish',
    label: '提示词增强',
    description: '把粗略想法整理成更稳定的生成提示词。',
    instruction: '把用户需求改写成结构清晰、可直接用于生成的提示词。',
  },
  {
    id: 'shot-design',
    label: '镜头设计',
    description: '补充景别、构图、光线、运动和叙事节奏。',
    instruction: '从镜头语言、构图和光线角度增强输出。',
  },
]

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取录音失败'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.readAsDataURL(blob)
  })
}

function nodeTitle(node: { id: string; type?: string; data: unknown }): string {
  const data = node.data as { title?: string } | undefined
  return data?.title ?? `${node.type ?? 'node'} ${node.id.slice(0, 4)}`
}

function getMentionQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)@([\u4e00-\u9fa5\w-]*)$/)
  return match ? match[1] : null
}

export function AgentPanel({ onClose = () => undefined }: AgentPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const addNode = useCanvasStore((s) => s.addNode)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const messages = useAgentStore((s) => s.messages)
  const loading = useAgentStore((s) => s.loading)
  const error = useAgentStore((s) => s.error)
  const appendAssistant = useAgentStore((s) => s.appendAssistant)
  const setLoading = useAgentStore((s) => s.setLoading)
  const setError = useAgentStore((s) => s.setError)
  const settings = useSettingsStore((s) => s.settings)
  const isJimengConfigured = useSettingsStore((s) => s.isJimengConfigured)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const { screenToFlowPosition } = useReactFlow()

  const [draft, setDraft] = useState('')
  const [panelWidth, setPanelWidth] = useState(420)
  const [modelOpen, setModelOpen] = useState(false)
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS)
  const [mentionedNodeIds, setMentionedNodeIds] = useState<string[]>([])
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([])
  const [pickingCanvasImage, setPickingCanvasImage] = useState(false)
  const [pendingImageRequest, setPendingImageRequest] =
    useState<PendingImageRequest | null>(null)
  const [imageGenerationParams, setImageGenerationParams] =
    useState<ImageGenerationParams>({
      model: settings?.defaultModel || IMAGE_MODELS[2].id,
      sizeId: settings?.defaultSize || IMAGE_SIZES[0].id,
      count: 1,
    })
  const [imageGenerationStatus, setImageGenerationStatus] = useState('')
  const [pendingVideoRequest, setPendingVideoRequest] =
    useState<PendingVideoRequest | null>(null)
  const [videoGenerationParams, setVideoGenerationParams] =
    useState<VideoGenerationParams>({
      model: VIDEO_MODELS[0].id,
      aspectRatio: '16:9',
      resolution: '720P',
      durationSeconds: 5,
      count: 1,
      quality: 'standard',
    })
  const [videoGenerationStatus, setVideoGenerationStatus] = useState('')
  const [skillStep, setSkillStep] = useState<'idle' | 'loading' | 'image' | 'video' | 'done'>('idle')
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(new Set())
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)

  const currentModel = settings?.llmModel || FALLBACK_MODELS[0]
  const preferredModels = useMemo(() => {
    const configured = settings?.llmModels ?? []
    if (configured.length === 0) return []
    return uniqueModels([...configured, currentModel])
  }, [currentModel, settings?.llmModels])
  const mentionQuery = getMentionQuery(draft)
  const maxPanelWidth =
    typeof window === 'undefined'
      ? 560
      : Math.max(MIN_PANEL_WIDTH, Math.floor(window.innerWidth / 3))

  useEffect(() => {
    let cancelled = false
    const immediateModels = uniqueModels([
      ...preferredModels,
      currentModel,
      ...FALLBACK_MODELS,
    ])
    setModels(immediateModels)

    listLlmModels()
      .then((items) => {
        if (cancelled) return
        const names = items
          .map((item) => item.id || item.label)
          .filter((name): name is string => !!name)
        setModels(
          uniqueModels([
            ...preferredModels,
            currentModel,
            ...names,
            ...FALLBACK_MODELS,
          ]),
        )
      })
      .catch(() => {
        if (!cancelled) setModels(immediateModels)
      })

    return () => {
      cancelled = true
    }
  }, [currentModel, preferredModels])

  useEffect(() => {
    setPanelWidth((value) => clamp(value, MIN_PANEL_WIDTH, maxPanelWidth))
  }, [maxPanelWidth])

  useEffect(() => {
    setImageGenerationParams((params) => ({
      ...params,
      model: settings?.defaultModel || params.model,
      sizeId: settings?.defaultSize || params.sizeId,
    }))
  }, [settings?.defaultModel, settings?.defaultSize])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      discardRecordingRef.current = true
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const mentionOptions = useMemo(() => {
    const query = (mentionQuery ?? '').toLowerCase()
    return nodes
      .filter((node) => {
        const title = nodeTitle(node).toLowerCase()
        return !query || title.includes(query) || node.id.toLowerCase().includes(query)
      })
      .slice(0, 8)
  }, [mentionQuery, nodes])

  const activeSkills = useMemo(() => {
    return activeSkillIds
      .map((id) => AGENT_SKILLS.find((skill) => skill.id === id))
      .filter((skill): skill is AgentSkill => !!skill)
  }, [activeSkillIds])

  const selectedMentionNodes = useMemo(() => {
    return mentionedNodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is (typeof nodes)[number] => !!node)
  }, [mentionedNodeIds, nodes])

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const move = (moveEvent: PointerEvent) => {
      const nextWidth = window.innerWidth - moveEvent.clientX
      setPanelWidth(clamp(nextWidth, MIN_PANEL_WIDTH, maxPanelWidth))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const chooseMention = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const title = nodeTitle(node)
    setMentionedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]))
    setDraft((value) => value.replace(/(?:^|\s)@[\u4e00-\u9fa5\w-]*$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : ''
      return `${prefix}@${title} `
    }))
  }

  const removeMention = (nodeId: string) => {
    setMentionedNodeIds((ids) => ids.filter((id) => id !== nodeId))
  }

  const toggleSkill = (skillId: string) => {
    setActiveSkillIds((ids) =>
      ids.includes(skillId)
        ? ids.filter((id) => id !== skillId)
        : [...ids, skillId],
    )
  }

  const removeSkill = (skillId: string) => {
    setActiveSkillIds((ids) => ids.filter((id) => id !== skillId))
  }

  const attachCanvasImage = useCallback((nodeId: string) => {
    const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
    if (!node || node.type !== 'image') return

    setMentionedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]))
    setDraft((value) =>
      value.trim() ? value : '请根据引用图片进行修改：',
    )
    setVoiceStatus(`已引用 ${nodeTitle(node)}`)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('agent-pick-image-active', pickingCanvasImage)

    if (!pickingCanvasImage) {
      return () => {
        document.body.classList.remove('agent-pick-image-active')
      }
    }

    const handlePick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const wrapper = target?.closest(
        '[data-flow-node-type="image"]',
      ) as HTMLElement | null
      if (!wrapper) return

      event.preventDefault()
      event.stopPropagation()
      const nodeId = wrapper.dataset.flowNodeId
      if (nodeId) attachCanvasImage(nodeId)
      setPickingCanvasImage(false)
      setActionMenuOpen(false)
      setSkillPickerOpen(false)
    }

    const handleCancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickingCanvasImage(false)
    }

    document.addEventListener('click', handlePick, true)
    window.addEventListener('keydown', handleCancel)

    return () => {
      document.body.classList.remove('agent-pick-image-active')
      document.removeEventListener('click', handlePick, true)
      window.removeEventListener('keydown', handleCancel)
    }
  }, [attachCanvasImage, pickingCanvasImage])

  const currentContextNodeIds = () =>
    mentionedNodeIds.length > 0
      ? mentionedNodeIds
      : selectedNodeId
        ? [selectedNodeId]
        : []

  const applySkillsToUserIdea = (userIdea: string) => {
    if (activeSkills.length === 0) return userIdea
    const skillText = activeSkills
      .map((skill) => `技能「${skill.label}」：${skill.instruction}`)
      .join('\n')
    return `${skillText}\n\n用户需求：${userIdea}`
  }

  const appendUserMessage = (userIdea: string, contextNodeIds: string[]) => {
    useAgentStore.setState((state) => ({
      messages: [
        ...state.messages,
        {
          id: `agent_msg_${Date.now()}_${state.messages.length}`,
          role: 'user' as const,
          content: userIdea,
          contextNodeIds,
          selectedNodeId: selectedNodeId ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ],
      lastRequest: {
        userIdea,
        contextNodeIds,
        selectedNodeId: selectedNodeId ?? undefined,
      },
    }))
  }

  const getCanvasDropPosition = () => {
    const canvasEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!canvasEl) return { x: 260, y: 220 }
    const rect = canvasEl.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.48,
    })
  }

  const createImageNodesForResults = (
    generateNodeId: string,
    results: GenerationResult[],
  ) => {
    const current = useCanvasStore
      .getState()
      .nodes.find((node) => node.id === generateNodeId)
    const baseX = (current?.position?.x ?? 0) + 300
    const baseY = current?.position?.y ?? 0
    const assetIds: string[] = []

    results.forEach((result, index) => {
      if (!result.assetId) return
      assetIds.push(result.assetId)
      const imageNodeId = addNode('image', {
        x: baseX + index * 260,
        y: baseY,
      })
      if (!imageNodeId) return
      updateNodeData(imageNodeId, {
        assetId: result.assetId,
      } as unknown as Partial<BaseNodeData>)
      onConnect({
        source: generateNodeId,
        target: imageNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
    })

    return assetIds
  }

  const startAgentImageGeneration = async () => {
    if (!pendingImageRequest) return
    if (!isJimengConfigured) {
      setImageGenerationStatus('未配置 dreamina CLI，请先在设置中配置后再生成')
      return
    }

    const size =
      IMAGE_SIZES.find((item) => item.id === imageGenerationParams.sizeId) ??
      IMAGE_SIZES[0]
    const contextNodes = pendingImageRequest.contextNodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is (typeof nodes)[number] => !!node)
    const imageContextNodes = contextNodes.filter((node) => node.type === 'image')
    const inputImageAssetIds = imageContextNodes
      .map((node) => (node.data as { assetId?: string }).assetId)
      .filter((assetId): assetId is string => !!assetId)
    const skillHint =
      activeSkills.length > 0
        ? `\n\n技能要求：${activeSkills
            .map((skill) => `${skill.label}：${skill.instruction}`)
            .join('；')}`
        : ''
    const prompt = `${pendingImageRequest.prompt}${skillHint}`

    const generateNodeId = addNode('generate', getCanvasDropPosition())
    if (!generateNodeId) return

    imageContextNodes.forEach((node) => {
      onConnect({
        source: node.id,
        target: generateNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
    })

    const request: GenerationRequest = {
      flowId: 'local',
      nodeId: generateNodeId,
      mediaType: 'image',
      prompt,
      inputImages: inputImageAssetIds,
      model: imageGenerationParams.model,
      width: size.width,
      height: size.height,
      count: imageGenerationParams.count,
      seed: null,
    }

    const generateStore = useGenerateStore.getState()
    generateStore.setLastRequest(generateNodeId, request)
    generateStore.setStatus(generateNodeId, 'queued')
    generateStore.setError(generateNodeId, undefined)
    updateNodeData(generateNodeId, {
      prompt,
      model: imageGenerationParams.model,
      width: size.width,
      height: size.height,
      count: imageGenerationParams.count,
      seed: null,
      inputImageAssetIds,
      status: 'queued',
      error: undefined,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)

    setImageGenerationStatus('已在画布创建生成节点，正在生成...')

    try {
      const response = await createGeneration(request)
      generateStore.setGenerationId(generateNodeId, response.id)
      const results = response.results ?? []
      const savedAssetIds = createImageNodesForResults(generateNodeId, results)
      const outputAssetIds =
        savedAssetIds.length > 0
          ? savedAssetIds
          : results
              .map((result) => result.assetId)
              .filter((assetId): assetId is string => !!assetId)

      generateStore.setStatus(generateNodeId, response.status)
      if (response.error) generateStore.setError(generateNodeId, response.error)
      updateNodeData(generateNodeId, {
        status: response.status,
        error: response.error,
        outputAssetIds,
        generationId: response.id,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setPendingImageRequest(null)
      setImageGenerationStatus('已生成并写入画布')

      // 如果 intent 是 image_then_video，图片生成完成后自动触发视频生成
      const lastIntent = useAgentStore.getState().lastResponse?.intent
      if (lastIntent === 'image_then_video') {
        setTimeout(() => {
          setPendingVideoRequest({
            id: `video_auto_${Date.now()}`,
            prompt: pendingImageRequest.prompt,
            contextNodeIds: pendingImageRequest.contextNodeIds,
            sourceImageNodeIds: outputAssetIds,
          })
          setVideoGenerationStatus('')
          setSkillStep('video')
        }, 400)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      generateStore.setError(generateNodeId, message)
      updateNodeData(generateNodeId, {
        status: 'error',
        error: message,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setImageGenerationStatus(message)
    }
  }

  const startAgentVideoGeneration = async () => {
    if (!pendingVideoRequest) return
    if (!isJimengConfigured) {
      setVideoGenerationStatus('未配置 dreamina CLI，请先在设置中配置后再生成')
      return
    }

    const contextNodes = pendingVideoRequest.contextNodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is (typeof nodes)[number] => !!node)
    const imageContextNodes = contextNodes.filter((node) => node.type === 'image')
    const inputImageAssetIds = imageContextNodes
      .map((node) => (node.data as { assetId?: string }).assetId)
      .filter((assetId): assetId is string => !!assetId)
    // 如果有自动关联的图片结果，也加入参考
    if (pendingVideoRequest.sourceImageNodeIds) {
      pendingVideoRequest.sourceImageNodeIds.forEach((id) => {
        const n = nodes.find((node) => node.id === id)
        if (n && n.type === 'image') {
          const assetId = (n.data as { assetId?: string }).assetId
          if (assetId && !inputImageAssetIds.includes(assetId)) {
            inputImageAssetIds.push(assetId)
          }
        }
      })
    }

    const skillHint =
      activeSkills.length > 0
        ? `\n\n技能要求：${activeSkills
            .map((skill) => `${skill.label}：${skill.instruction}`)
            .join('；')}`
        : ''
    const prompt = `${pendingVideoRequest.prompt}${skillHint}`

    const videoNodeId = addNode('video', getCanvasDropPosition())
    if (!videoNodeId) return

    imageContextNodes.forEach((node) => {
      onConnect({
        source: node.id,
        target: videoNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
    })

    const request: VideoGenerationRequest = {
      flowId: 'local',
      nodeId: videoNodeId,
      mediaType: 'video',
      mode: inputImageAssetIds.length > 0 ? 'image_to_video' : 'text_to_video',
      prompt,
      inputImages: inputImageAssetIds,
      model: videoGenerationParams.model,
      aspectRatio: videoGenerationParams.aspectRatio,
      resolution: videoGenerationParams.resolution,
      quality: videoGenerationParams.quality,
      durationSeconds: videoGenerationParams.durationSeconds,
      count: videoGenerationParams.count,
      generateAudio: true,
    }

    const generateStore = useGenerateStore.getState()
    generateStore.setLastRequest(videoNodeId, request)
    generateStore.setStatus(videoNodeId, 'queued')
    generateStore.setError(videoNodeId, undefined)
    updateNodeData(videoNodeId, {
      prompt,
      model: videoGenerationParams.model,
      aspectRatio: videoGenerationParams.aspectRatio,
      resolution: videoGenerationParams.resolution,
      quality: videoGenerationParams.quality,
      durationSeconds: videoGenerationParams.durationSeconds,
      count: videoGenerationParams.count,
      mode: request.mode,
      inputImageAssetIds,
      status: 'queued',
      error: undefined,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)

    setVideoGenerationStatus('已在画布创建视频节点，正在生成...')

    try {
      const response = await createGeneration(request)
      generateStore.setGenerationId(videoNodeId, response.id)
      const results = response.results ?? []
      const assetIds = results
        .map((result) => result.assetId)
        .filter((assetId): assetId is string => !!assetId)

      generateStore.setStatus(videoNodeId, response.status)
      if (response.error) generateStore.setError(videoNodeId, response.error)
      updateNodeData(videoNodeId, {
        status: response.status,
        error: response.error,
        assetIds,
        generationId: response.id,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setPendingVideoRequest(null)
      setVideoGenerationStatus('已生成并写入画布')
      setSkillStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      generateStore.setError(videoNodeId, message)
      updateNodeData(videoNodeId, {
        status: 'error',
        error: message,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setVideoGenerationStatus(message)
    }
  }

  const appendVoiceText = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setDraft((value) => `${value}${value.trim() ? ' ' : ''}${trimmed}`)
  }

  const startRecorderVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceStatus('当前浏览器不支持语音输入')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      discardRecordingRef.current = false

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setListening(false)
        setVoiceStatus('录音失败，请重试')
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.onstop = () => {
        const discardRecording = discardRecordingRef.current
        discardRecordingRef.current = false
        const chunks = audioChunksRef.current
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        setListening(false)

        if (discardRecording) {
          audioChunksRef.current = []
          return
        }

        if (chunks.length === 0) {
          setVoiceStatus('没有录到声音')
          return
        }

        setVoiceStatus('正在转文字...')
        void (async () => {
          try {
            const mimeType = recorder.mimeType || 'audio/webm'
            const audioBlob = new Blob(chunks, { type: mimeType })
            const audioBase64 = await blobToBase64(audioBlob)
            const result = await transcribeAudio({
              audioBase64,
              mimeType,
              filename: 'voice.webm',
            })
            appendVoiceText(result.text)
            setVoiceStatus('')
          } catch (err) {
            setVoiceStatus(err instanceof Error ? err.message : '语音转文字失败')
          } finally {
            audioChunksRef.current = []
          }
        })()
      }

      setVoiceStatus('正在听...')
      setListening(true)
      recorder.start()
    } catch (err) {
      setListening(false)
      setVoiceStatus(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? '麦克风权限未授权'
          : '无法启动麦克风',
      )
    }
  }

  const toggleVoice = async () => {
    if (listening) {
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      setListening(false)
      return
    }

    const SpeechRecognitionCtor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      await startRecorderVoice()
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results.item(i)
        text += result.item(0).transcript
      }
      appendVoiceText(text)
    }
    recognition.onerror = () => {
      setVoiceStatus('语音识别失败，请重试')
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      setVoiceStatus((status) => (status === '正在听...' ? '' : status))
    }
    recognitionRef.current = recognition
    setVoiceStatus('正在听...')
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      setVoiceStatus('语音输入启动失败')
    }
  }

  const retryLastRequest = async (modelOverride?: string) => {
    const lastReq = useAgentStore.getState().lastRequest
    if (!lastReq) return

    const model = modelOverride || currentModel

    setLoading(true)
    setError(undefined)
    setSkillStep('loading')

    try {
      const request: PromptOptimizeRequest = {
        userIdea: applySkillsToUserIdea(lastReq.userIdea),
        contextNodeIds: lastReq.contextNodeIds,
        selectedNodeId: lastReq.selectedNodeId,
        model,
      }

      const response = await optimizePrompt(request)
      appendAssistant(response)

      const intent = response.intent
      if (intent === 'image' || intent === 'image_then_video') {
        setSkillStep('image')
        setPendingImageRequest({
          id: `image_intent_${Date.now()}`,
          prompt: response.optimizedPrompt || lastReq.userIdea,
          contextNodeIds: lastReq.contextNodeIds,
        })
        setImageGenerationStatus('')
        if (intent === 'image_then_video') {
          setTimeout(() => setSkillStep('video'), 600)
        } else {
          setTimeout(() => setSkillStep('done'), 600)
        }
      } else if (intent === 'video') {
        setSkillStep('video')
        setPendingVideoRequest({
          id: `video_intent_${Date.now()}`,
          prompt: response.optimizedPrompt || lastReq.userIdea,
          contextNodeIds: lastReq.contextNodeIds,
        })
        setVideoGenerationStatus('')
        setTimeout(() => setSkillStep('done'), 600)
      } else {
        setSkillStep('done')
      }
    } catch (err) {
      setSkillStep('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const submit = async () => {
    const userIdea = draft.trim()
    if (!userIdea || loading) return

    const contextNodeIds = currentContextNodeIds()

    appendUserMessage(userIdea, contextNodeIds)
    setDraft('')
    setMentionedNodeIds([])
    setVoiceStatus('')
    setSkillStep('idle')

    // 自动执行关键词检测（仅在有 pending 请求时生效）
    const normalizedIdea = userIdea.toLowerCase().replace(/[。.，,!！?？\s]/g, '')
    const confirmKeywords = ['确认', '可以', '好', '继续', '生成', '开始', 'ok', 'yes', '是']
    const cancelKeywords = ['不', '算了', '取消', '不要', 'no', '否', '停止']
    const isConfirm = confirmKeywords.some((k) => normalizedIdea === k.toLowerCase())
    const isCancel = cancelKeywords.some((k) => normalizedIdea === k.toLowerCase())

    if (pendingImageRequest || pendingVideoRequest) {
      if (isConfirm) {
        if (pendingImageRequest) {
          void startAgentImageGeneration()
          return
        }
        if (pendingVideoRequest) {
          void startAgentVideoGeneration()
          return
        }
      }
      if (isCancel) {
        setPendingImageRequest(null)
        setPendingVideoRequest(null)
        setSkillStep('idle')
        const cancelMsg: AgentMessage = {
          id: `agent_cancel_${Date.now()}`,
          role: 'assistant',
          content: '已取消当前操作。',
          contextNodeIds: [],
          createdAt: new Date().toISOString(),
        }
        useAgentStore.setState((state) => ({
          messages: [...state.messages, cancelMsg],
        }))
        return
      }
    }

    // 先走 LLM 优化，由 LLM 判断意图
    const request: PromptOptimizeRequest = {
      userIdea: applySkillsToUserIdea(userIdea),
      contextNodeIds,
      selectedNodeId: selectedNodeId ?? undefined,
      model: currentModel,
    }

    setLoading(true)
    setError(undefined)
    setSkillStep('loading')

    try {
      const response = await optimizePrompt(request)
      appendAssistant(response)

      // 根据后端返回的 intent 决定加载哪种技能
      const intent = response.intent
      if (intent === 'image' || intent === 'image_then_video') {
        setSkillStep('image')
        setPendingImageRequest({
          id: `image_intent_${Date.now()}`,
          prompt: response.optimizedPrompt || userIdea,
          contextNodeIds,
        })
        setImageGenerationStatus('')
        // 如果是 image_then_video，在图片生成完成后会自动触发视频
        if (intent === 'image_then_video') {
          // 延迟显示技能切换状态
          setTimeout(() => setSkillStep('video'), 600)
        } else {
          setTimeout(() => setSkillStep('done'), 600)
        }
      } else if (intent === 'video') {
        setSkillStep('video')
        setPendingVideoRequest({
          id: `video_intent_${Date.now()}`,
          prompt: response.optimizedPrompt || userIdea,
          contextNodeIds,
        })
        setVideoGenerationStatus('')
        setTimeout(() => setSkillStep('done'), 600)
      } else {
        // text 纯文本对话，不需要生成
        setSkillStep('done')
      }
    } catch (err) {
      setSkillStep('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const changeModel = (model: string) => {
    setModelOpen(false)
    void saveSettings({ llmModel: model }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <aside className="agent-chat-panel" style={{ width: panelWidth }}>
      <div
        className="agent-resize-handle"
        onPointerDown={startResize}
        title="拖动调整 Agent 宽度"
      />

      <header className="agent-chat-header">
        <div className="agent-title">
          <Bot size={15} />
          <span>AI创作搭档</span>
        </div>
        <div className="agent-header-actions">
          <button type="button" className="agent-header-btn" title="新对话">
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="agent-header-btn"
            title="关闭 Agent"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="agent-chat-scroll">
        <div className="agent-bubble assistant">
          <div className="agent-pill">你可以干什么</div>
          <p>
            我是你的创作搭档，专注帮你把想法变成画布上能看见的内容。可以从剧本、故事、企划案、文案切入，也可以围绕图片、视频和节点继续扩展。
          </p>
          <strong>脚本与故事</strong>
          <p>从零写剧本、拆分镜脚本、诊断已有剧本问题并给出改法。</p>
          <strong>视觉设计</strong>
          <p>生成图片提示词、统一画面风格、设计角色卡、场景卡和镜头语言。</p>
          <strong>视频与音乐</strong>
          <p>生成视频片段、写歌词、生成配音或 BGM 方向。</p>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={`agent-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
          >
            <p>{message.content}</p>
            {message.role === 'assistant' && message.thinking && (
              <div>
                <button
                  type="button"
                  className={`agent-thinking-header ${expandedThinkingIds.has(message.id) ? 'expanded' : ''}`}
                  onClick={() => {
                    setExpandedThinkingIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(message.id)) {
                        next.delete(message.id)
                      } else {
                        next.add(message.id)
                      }
                      return next
                    })
                  }}
                >
                  <ChevronRight size={12} />
                  思考过程
                </button>
                {expandedThinkingIds.has(message.id) && (
                  <div className="agent-thinking-content">{message.thinking}</div>
                )}
              </div>
            )}
            {message.optimizedPrompt && (
              <div className="agent-result-card">
                <span>优化后的 Prompt</span>
                <p>{message.optimizedPrompt}</p>
              </div>
            )}
            {message.role === 'assistant' && (
              <div className="agent-message-actions">
                {(message.intent === 'image' || message.intent === 'image_then_video') && (
                  <>
                    <button
                      type="button"
                      className="agent-msg-action-btn"
                      onClick={() => {
                        setPendingVideoRequest({
                          id: `video_continue_${Date.now()}`,
                          prompt: message.optimizedPrompt || message.content,
                          contextNodeIds: message.contextNodeIds,
                        })
                      }}
                    >
                      <Film size={12} /> 继续生成视频
                    </button>
                    <button
                      type="button"
                      className="agent-msg-action-btn"
                      onClick={() => {
                        setPendingImageRequest({
                          id: `image_more_${Date.now()}`,
                          prompt: message.optimizedPrompt || message.content,
                          contextNodeIds: message.contextNodeIds,
                        })
                      }}
                    >
                      <Sparkles size={12} /> 生成更多图片
                    </button>
                  </>
                )}
                {message.intent === 'video' && (
                  <button
                    type="button"
                    className="agent-msg-action-btn"
                    onClick={() => {
                      setPendingVideoRequest({
                        id: `video_more_${Date.now()}`,
                        prompt: message.optimizedPrompt || message.content,
                        contextNodeIds: message.contextNodeIds,
                      })
                    }}
                  >
                    <Film size={12} /> 生成更多视频
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="agent-bubble assistant compact">
            <Loader2 size={14} className="animate-spin" />
            正在思考...
          </div>
        )}

        {/* 技能加载状态 */}
        {skillStep !== 'idle' && skillStep !== 'done' && (
          <div className="agent-skill-status">
            <span className="agent-skill-status-dot done" />
            <span className="agent-skill-status-label">加载技能</span>
            <span className="agent-skill-status-state">完成</span>
          </div>
        )}
        {skillStep === 'image' && (
          <div className="agent-skill-status">
            <span className="agent-skill-status-dot running" />
            <span className="agent-skill-status-label">生成图片</span>
            <span className="agent-skill-status-state">执行中...</span>
          </div>
        )}
        {skillStep === 'video' && (
          <div className="agent-skill-status">
            <span className="agent-skill-status-dot running" />
            <span className="agent-skill-status-label">生成视频</span>
            <span className="agent-skill-status-state">执行中...</span>
          </div>
        )}

        {error && (
          <div className="agent-error">
            {error}
            <div className="agent-error-actions">
              <button
                type="button"
                className="agent-msg-action-btn"
                onClick={() => void retryLastRequest()}
              >
                <RefreshCw size={12} /> 重试
              </button>
              <button
                type="button"
                className="agent-msg-action-btn"
                onClick={() => {
                  const currentIndex = models.findIndex((m) => m === currentModel)
                  const nextModel = models[(currentIndex + 1) % models.length] ?? currentModel
                  void saveSettings({ llmModel: nextModel }).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : String(err))
                  })
                  void retryLastRequest(nextModel)
                }}
              >
                <Wand2 size={12} /> 换个模型
              </button>
            </div>
          </div>
        )}

        {pendingImageRequest && (
          <div className="agent-bubble assistant agent-image-request">
            <div className="agent-card-title">
              <Sparkles size={14} />
              <span>生成图片前确认一下参数</span>
            </div>
            <p className="agent-card-desc">
              我会把这个需求变成画布上的即梦生成节点，并按下面参数开始生成。
            </p>

            <div className="agent-image-fields">
              <label>
                <span>模型</span>
                <select
                  value={imageGenerationParams.model}
                  onChange={(event) =>
                    setImageGenerationParams((params) => ({
                      ...params,
                      model: event.target.value,
                    }))
                  }
                >
                  {IMAGE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>比例 / 尺寸</span>
                <select
                  value={imageGenerationParams.sizeId}
                  onChange={(event) =>
                    setImageGenerationParams((params) => ({
                      ...params,
                      sizeId: event.target.value,
                    }))
                  }
                >
                  {IMAGE_SIZES.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="agent-count-field">
                <span>数量</span>
                <div>
                  {IMAGE_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={
                        imageGenerationParams.count === count ? 'active' : ''
                      }
                      onClick={() =>
                        setImageGenerationParams((params) => ({
                          ...params,
                          count,
                        }))
                      }
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {pendingImageRequest.contextNodeIds.length > 0 && (
              <div className="agent-card-context">
                已引用 {pendingImageRequest.contextNodeIds.length} 个画布节点
              </div>
            )}

            {imageGenerationStatus && (
              <div className="agent-card-status">{imageGenerationStatus}</div>
            )}

            <div className="agent-card-actions">
              <button
                type="button"
                className="agent-card-secondary"
                onClick={() => setPendingImageRequest(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="agent-card-primary"
                onClick={() => void startAgentImageGeneration()}
                disabled={!isJimengConfigured}
                title={!isJimengConfigured ? '未配置 dreamina CLI' : '生成到画布'}
              >
                生成到画布
              </button>
            </div>
          </div>
        )}

        {pendingVideoRequest && (
          <div className="agent-bubble assistant agent-video-request">
            <div className="agent-card-title">
              <Film size={14} />
              <span>视频生成确认</span>
            </div>
            <p className="agent-video-desc">
              {pendingVideoRequest.prompt}
            </p>

            <div className="agent-video-params">
              <span className="agent-video-param-tag">
                <strong>模型</strong> {VIDEO_MODELS.find((m) => m.id === videoGenerationParams.model)?.label ?? videoGenerationParams.model}
              </span>
              <span className="agent-video-param-tag">
                <strong>比例</strong> {videoGenerationParams.aspectRatio}
              </span>
              <span className="agent-video-param-tag">
                <strong>分辨率</strong> {videoGenerationParams.resolution}
              </span>
              <span className="agent-video-param-tag">
                <strong>时长</strong> {videoGenerationParams.durationSeconds}s
              </span>
            </div>

            <div className="agent-video-fields" style={{ marginTop: 10 }}>
              <label>
                <span>模型</span>
                <select
                  value={videoGenerationParams.model}
                  onChange={(event) =>
                    setVideoGenerationParams((params) => ({
                      ...params,
                      model: event.target.value,
                    }))
                  }
                >
                  {VIDEO_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>比例</span>
                <select
                  value={videoGenerationParams.aspectRatio}
                  onChange={(event) =>
                    setVideoGenerationParams((params) => ({
                      ...params,
                      aspectRatio: event.target.value as VideoAspectRatio,
                    }))
                  }
                >
                  {VIDEO_ASPECT_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>分辨率</span>
                <select
                  value={videoGenerationParams.resolution}
                  onChange={(event) =>
                    setVideoGenerationParams((params) => ({
                      ...params,
                      resolution: event.target.value as VideoResolution,
                    }))
                  }
                >
                  {VIDEO_RESOLUTIONS.map((res) => (
                    <option key={res} value={res}>
                      {res}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>时长</span>
                <select
                  value={videoGenerationParams.durationSeconds}
                  onChange={(event) =>
                    setVideoGenerationParams((params) => ({
                      ...params,
                      durationSeconds: Number(event.target.value),
                    }))
                  }
                >
                  {VIDEO_DURATIONS.map((dur) => (
                    <option key={dur} value={dur}>
                      {dur}s
                    </option>
                  ))}
                </select>
              </label>

              <div className="agent-video-count-field">
                <span>数量</span>
                <div>
                  {VIDEO_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={
                        videoGenerationParams.count === count ? 'active' : ''
                      }
                      onClick={() =>
                        setVideoGenerationParams((params) => ({
                          ...params,
                          count,
                        }))
                      }
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {pendingVideoRequest.contextNodeIds.length > 0 && (
              <div className="agent-card-context">
                已引用 {pendingVideoRequest.contextNodeIds.length} 个画布节点
              </div>
            )}

            {videoGenerationStatus && (
              <div className="agent-card-status">{videoGenerationStatus}</div>
            )}

            <div className="agent-card-actions">
              <button
                type="button"
                className="agent-card-secondary"
                onClick={() => setPendingVideoRequest(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="agent-card-primary"
                onClick={() => void startAgentVideoGeneration()}
                disabled={!isJimengConfigured}
                title={!isJimengConfigured ? '未配置 dreamina CLI' : '生成到画布'}
              >
                生成到画布
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="agent-composer">
        {activeSkills.length > 0 && (
          <div className="agent-skill-chips">
            {activeSkills.map((skill) => (
              <button
                type="button"
                key={skill.id}
                className="agent-skill-chip"
                onClick={() => removeSkill(skill.id)}
                title="移除技能"
              >
                <Wand2 size={11} />
                {skill.label}
                <X size={11} />
              </button>
            ))}
          </div>
        )}

        {selectedMentionNodes.length > 0 && (
          <div className="mention-chips">
            {selectedMentionNodes.map((node) => (
              <button
                type="button"
                key={node.id}
                className="mention-chip"
                onClick={() => removeMention(node.id)}
                title="移除引用"
              >
                @{nodeTitle(node)}
                <X size={11} />
              </button>
            ))}
          </div>
        )}

        {mentionQuery !== null && mentionOptions.length > 0 && (
          <div className="mention-popover">
            <div className="mention-popover-title">引用画布节点</div>
            {mentionOptions.map((node) => (
              <button
                key={node.id}
                type="button"
                className="mention-option"
                onClick={() => chooseMention(node.id)}
              >
                <AtSign size={13} />
                <span>{nodeTitle(node)}</span>
                <small>{node.type}</small>
              </button>
            ))}
          </div>
        )}

        <textarea
          className="agent-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="描述操作使用 @ 引用..."
          disabled={loading}
        />

        <div className="agent-composer-actions">
          <div className="agent-action-picker">
            <button
              type="button"
              className={`agent-round-btn ${actionMenuOpen || pickingCanvasImage ? 'active' : ''}`}
              title="添加能力"
              onClick={() => {
                setActionMenuOpen((open) => !open)
                setSkillPickerOpen(false)
              }}
            >
              <Plus size={15} />
            </button>

            {actionMenuOpen && (
              <div className="agent-action-menu">
                <button
                  type="button"
                  className="agent-action-option"
                  onClick={() => {
                    setPickingCanvasImage(true)
                    setActionMenuOpen(false)
                    setVoiceStatus('点击画布上的图片节点进行引用')
                  }}
                >
                  <ImageIcon size={14} />
                  <span>
                    引用画布图片
                    <small>点选图片节点</small>
                  </span>
                </button>

                <button
                  type="button"
                  className="agent-action-option"
                  onClick={() => setSkillPickerOpen((open) => !open)}
                >
                  <Wand2 size={14} />
                  <span>
                    添加技能
                    <small>让 Agent 带着能力工作</small>
                  </span>
                </button>

                {skillPickerOpen && (
                  <div className="agent-skill-menu">
                    {AGENT_SKILLS.map((skill) => (
                      <button
                        type="button"
                        key={skill.id}
                        className={
                          activeSkillIds.includes(skill.id) ? 'selected' : ''
                        }
                        onClick={() => toggleSkill(skill.id)}
                      >
                        <Sparkles size={12} />
                        <span>
                          {skill.label}
                          <small>{skill.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="agent-model-picker">
            <button
              type="button"
              className="agent-model-btn"
              onClick={() => setModelOpen((open) => !open)}
            >
              {currentModel}
              <ChevronDown size={13} />
            </button>
            {modelOpen && (
              <div className="agent-model-menu">
                {models.map((model) => (
                  <button
                    type="button"
                    key={model}
                    className="agent-model-option"
                    onClick={() => changeModel(model)}
                  >
                    <span>{model}</span>
                    {model === currentModel && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="voice-status">{voiceStatus}</span>
          <button
            type="button"
            className={`agent-round-btn ${listening ? 'active' : ''}`}
            onClick={() => void toggleVoice()}
            title={listening ? '停止语音输入' : '语音输入'}
          >
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button
            type="button"
            className="agent-send-btn"
            onClick={() => void submit()}
            disabled={!draft.trim() || loading}
            title="发送"
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </footer>
    </aside>
  )
}

export default AgentPanel
