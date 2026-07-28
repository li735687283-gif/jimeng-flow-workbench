export const QUALITY_OPTIONS = ['低画质', '标准画质', '高画质'] as const
export const RESOLUTION_OPTIONS = ['1K', '2K', '4K'] as const
export const RATIO_OPTIONS = [
  '自适应',
  '1:1',
  '1:2',
  '2:1',
  '9:16',
  '16:9',
  '3:4',
  '4:3',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
  '9:21',
] as const
export const COUNT_OPTIONS = [1, 2, 3, 4] as const

export interface PersistedImageEditorPatch {
  prompt?: string
  modelId?: string
  quality?: (typeof QUALITY_OPTIONS)[number]
  resolution?: (typeof RESOLUTION_OPTIONS)[number]
  ratio?: (typeof RATIO_OPTIONS)[number]
  count?: (typeof COUNT_OPTIONS)[number]
}

interface PersistedImageEditorNodeData {
  prompt?: unknown
  model?: unknown
  quality?: unknown
  resolution?: unknown
  ratio?: unknown
  count?: unknown
}

export function getPersistedImageEditorPatch(
  nodeData: PersistedImageEditorNodeData,
): PersistedImageEditorPatch {
  const patch: PersistedImageEditorPatch = {}
  if (typeof nodeData.prompt === 'string') patch.prompt = nodeData.prompt
  if (typeof nodeData.model === 'string' && nodeData.model.trim()) {
    patch.modelId = nodeData.model.trim()
  }
  if (QUALITY_OPTIONS.includes(nodeData.quality as (typeof QUALITY_OPTIONS)[number])) {
    patch.quality = nodeData.quality as (typeof QUALITY_OPTIONS)[number]
  }
  if (RESOLUTION_OPTIONS.includes(nodeData.resolution as (typeof RESOLUTION_OPTIONS)[number])) {
    patch.resolution = nodeData.resolution as (typeof RESOLUTION_OPTIONS)[number]
  }
  if (RATIO_OPTIONS.includes(nodeData.ratio as (typeof RATIO_OPTIONS)[number])) {
    patch.ratio = nodeData.ratio as (typeof RATIO_OPTIONS)[number]
  }
  if (COUNT_OPTIONS.includes(nodeData.count as (typeof COUNT_OPTIONS)[number])) {
    patch.count = nodeData.count as (typeof COUNT_OPTIONS)[number]
  }
  return patch
}

export const PERSISTED_IMAGE_EDITOR_FIELDS = [
  'prompt',
  'modelId',
  'quality',
  'resolution',
  'ratio',
  'count',
] as const

export type PersistedImageEditorField =
  (typeof PERSISTED_IMAGE_EDITOR_FIELDS)[number]

type PersistedImageEditorValues = Partial<
  Record<PersistedImageEditorField, unknown>
>

export function getChangedPersistedImageEditorFields(
  previous: PersistedImageEditorValues,
  current: PersistedImageEditorValues,
): PersistedImageEditorField[] {
  return PERSISTED_IMAGE_EDITOR_FIELDS.filter(
    (field) => !Object.is(previous[field], current[field]),
  )
}
