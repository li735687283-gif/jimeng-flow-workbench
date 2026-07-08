export interface FloatingEditorPointerState {
  button: number
  isInsideEditorOwner: boolean
}

export interface FloatingMenuPointerState {
  button: number
  isMenuOpen: boolean
  isInsideMenuRoot: boolean
}

export function shouldCloseFloatingEditorOnPointerDown({
  button,
  isInsideEditorOwner,
}: FloatingEditorPointerState): boolean {
  if (isInsideEditorOwner) return false
  return button === 0
}

export function shouldCloseFloatingMenuOnPointerDown({
  button,
  isMenuOpen,
  isInsideMenuRoot,
}: FloatingMenuPointerState): boolean {
  if (!isMenuOpen || isInsideMenuRoot) return false
  return button === 0
}
