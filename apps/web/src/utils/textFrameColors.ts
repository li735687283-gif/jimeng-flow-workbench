export const TEXT_FRAME_COLOR_PRESETS = [
  {
    id: 'default',
    color: 'var(--text-frame-obsidian)',
    legacyColor: '#242424',
    label: '夜雾墨',
  },
  {
    id: 'slate',
    color: 'var(--text-frame-ocean)',
    legacyColor: '#202020',
    label: '深海雾蓝',
  },
  {
    id: 'indigo',
    color: 'var(--text-frame-indigo)',
    legacyColor: '#1c1c1c',
    label: '暮光靛',
  },
  {
    id: 'forest',
    color: 'var(--text-frame-moss)',
    legacyColor: '#262626',
    label: '苔玉灰',
  },
  {
    id: 'wine',
    color: 'var(--text-frame-rose)',
    legacyColor: '#303030',
    label: '烟熏玫瑰',
  },
  {
    id: 'amber',
    color: 'var(--text-frame-bronze)',
    legacyColor: '#383838',
    label: '古铜茶',
  },
  {
    id: 'graphite',
    color: 'var(--text-frame-mauve)',
    legacyColor: '#141414',
    label: '月影灰紫',
  },
] as const

export type TextFrameColorId = (typeof TEXT_FRAME_COLOR_PRESETS)[number]['id']

export function resolveTextFrameColor(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return TEXT_FRAME_COLOR_PRESETS[0].color

  const normalizedLower = normalized.toLowerCase()
  const preset = TEXT_FRAME_COLOR_PRESETS.find(
    (item) =>
      item.color.toLowerCase() === normalizedLower ||
      item.legacyColor.toLowerCase() === normalizedLower,
  )
  return preset?.color ?? normalized
}
