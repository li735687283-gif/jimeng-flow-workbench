/**
 * 「松手在画布空白」判定：从手柄拖线松手时，只有落在空白处才弹新建节点菜单。
 * 画框组（groupFrame）是铺底的背景层：松手落在框上按画布空白处理，
 * 否则组内节点永远无法拖线新建；普通节点与手柄仍视为「落在节点上」
 * （走连接路径，不弹菜单）。
 */
export function isBlankCanvasTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.react-flow__handle')) return false
  const nodeElement = target.closest('.react-flow__node')
  if (nodeElement && !nodeElement.querySelector('.group-frame')) return false
  return !!target.closest('.react-flow')
}
