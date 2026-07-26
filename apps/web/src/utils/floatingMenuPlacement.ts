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

type FloatingMenuPlacementInput = {
  triggerLeft: number
  triggerRight: number
  triggerTop: number
  triggerBottom: number
  viewportWidth: number
  viewportHeight: number
  menuWidth: number
  menuHeight: number
  align?: 'start' | 'end'
  gap?: number
  margin?: number
}

export type FloatingMenuPlacement = {
  direction: FloatingMenuDirection
  top: number
  left: number
  maxHeight: number
}

export function getFloatingMenuPlacement({
  triggerLeft,
  triggerRight,
  triggerTop,
  triggerBottom,
  viewportWidth,
  viewportHeight,
  menuWidth,
  menuHeight,
  align = 'start',
  gap = 8,
  margin = 12,
}: FloatingMenuPlacementInput): FloatingMenuPlacement {
  const direction = chooseFloatingMenuDirection({
    triggerTop,
    triggerBottom,
    viewportHeight,
    menuHeight,
    gap,
    margin,
  })
  const availableHeight =
    direction === 'up'
      ? Math.max(0, triggerTop - margin - gap)
      : Math.max(0, viewportHeight - margin - triggerBottom - gap)
  const visibleHeight = Math.min(menuHeight, availableHeight)
  const unclampedLeft = align === 'end' ? triggerRight - menuWidth : triggerLeft
  const maxLeft = Math.max(margin, viewportWidth - margin - menuWidth)

  return {
    direction,
    top:
      direction === 'up'
        ? Math.max(margin, triggerTop - gap - visibleHeight)
        : Math.min(
            viewportHeight - margin - visibleHeight,
            triggerBottom + gap,
          ),
    left: Math.min(Math.max(margin, unclampedLeft), maxLeft),
    maxHeight: availableHeight,
  }
}
