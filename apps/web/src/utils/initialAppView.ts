export type InitialAppView = 'home' | 'canvas'

interface ResolveInitialAppViewOptions {
  search: string
}

export function resolveInitialAppView({
  search,
}: ResolveInitialAppViewOptions): InitialAppView {
  // 启动默认进入首页；只有显式 ?view=canvas 才直接进入画布
  return new URLSearchParams(search).get('view') === 'canvas'
    ? 'canvas'
    : 'home'
}
