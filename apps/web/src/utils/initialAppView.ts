export type InitialAppView = 'home' | 'canvas'

interface ResolveInitialAppViewOptions {
  pathname: string
  search: string
  storedView: string | null
}

export function resolveInitialAppView({
  pathname,
  search,
  storedView,
}: ResolveInitialAppViewOptions): InitialAppView {
  const requestedView = new URLSearchParams(search).get('view')
  if (requestedView === 'canvas' || pathname === '/canvas') {
    return 'canvas'
  }

  return storedView === 'canvas' ? 'canvas' : 'home'
}
