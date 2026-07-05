export interface FloatingEditorPointerState {
  button: number
  isInsideEditorOwner: boolean
}

export function shouldCloseFloatingEditorOnPointerDown({
  button,
  isInsideEditorOwner,
}: FloatingEditorPointerState): boolean {
  if (isInsideEditorOwner) return false
  return button === 0
}
