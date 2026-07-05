export type FloatingMenuDirection = 'up' | 'down'

type FloatingMenuDirectionInput = {
  triggerTop: number
  triggerBottom: number
  viewportHeight: number
  menuHeight: number
  gap?: number
  margin?: number
}

export function chooseFloatingMenuDirection({
  triggerTop,
  triggerBottom,
  viewportHeight,
  menuHeight,
  gap = 8,
  margin = 12,
}: FloatingMenuDirectionInput): FloatingMenuDirection {
  const spaceBelow = viewportHeight - margin - triggerBottom - gap
  const spaceAbove = triggerTop - margin - gap

  if (spaceBelow >= menuHeight) return 'down'
  if (spaceAbove >= menuHeight) return 'up'
  return spaceAbove > spaceBelow ? 'up' : 'down'
}
