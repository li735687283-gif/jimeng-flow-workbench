import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { resolve } from 'node:path'

export const LOCAL_SERVER_ORIGIN = 'http://127.0.0.1:8787'
export const LOCAL_CANVAS_URL = `${LOCAL_SERVER_ORIGIN}/canvas`
export const LOCAL_HEALTH_URL = `${LOCAL_SERVER_ORIGIN}/api/health`
const LOCAL_SERVER_SERVICE = 'jimeng-flow-server'

export type LocalServerState = 'ready' | 'occupied' | 'unavailable'

type SpawnServer = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess

export interface LocalServerHandle {
  owned: boolean
  process: ChildProcess | null
}

export async function probeLocalServer(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1_000,
): Promise<LocalServerState> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(LOCAL_HEALTH_URL, {
      signal: controller.signal,
    })
    const body = await response.json() as {
      service?: unknown
      status?: unknown
    }
    return response.ok &&
      body.status === 'ok' &&
      body.service === LOCAL_SERVER_SERVICE
      ? 'ready'
      : 'occupied'
  } catch {
    return 'unavailable'
  } finally {
    clearTimeout(timeout)
  }
}

export async function probeCanvasPage(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1_000,
): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(LOCAL_CANVAS_URL, {
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function createServerEnvironment(options: {
  baseEnv?: NodeJS.ProcessEnv
  projectRoot: string
  webRoot?: string
  workspaceDir: string
}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...options.baseEnv,
    ELECTRON_RUN_AS_NODE: '1',
    MOK_PROJECT_ROOT: resolve(options.projectRoot),
    MOK_WORKSPACE_DIR: resolve(options.workspaceDir),
    PORT: '8787',
  }
  if (options.webRoot) {
    environment.MOK_WEB_ROOT = resolve(options.webRoot)
  }
  return environment
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs))
}

export async function startOrReuseLocalServer(options: {
  entryPath: string
  execPath: string
  fetchImpl?: typeof fetch
  projectRoot: string
  spawnImpl?: SpawnServer
  startupTimeoutMs?: number
  webRoot?: string
  workspaceDir: string
}): Promise<LocalServerHandle> {
  const fetchImpl = options.fetchImpl ?? fetch
  const initialState = await probeLocalServer(fetchImpl)
  if (initialState === 'ready') {
    // 打包模式下，8787 上可能是一个不提供前端页面的开发服务器；
    // 直接复用会让窗口只拿到 /canvas 的 404，呈现为黑屏。
    if (options.webRoot && !(await probeCanvasPage(fetchImpl))) {
      throw new Error(
        'Port 8787 is running a MO.K server that does not serve the app ' +
          '(most likely `npm run dev`). Stop it, then start MO.K again.',
      )
    }
    return { owned: false, process: null }
  }
  if (initialState === 'occupied') {
    throw new Error('Port 8787 is already used by a service other than MO.K.')
  }

  const spawnImpl = options.spawnImpl ?? spawn
  const child = spawnImpl(options.execPath, [resolve(options.entryPath)], {
    env: createServerEnvironment({
      baseEnv: process.env,
      projectRoot: options.projectRoot,
      webRoot: options.webRoot,
      workspaceDir: options.workspaceDir,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr = `${stderr}${String(chunk)}`.slice(-2_000)
  })

  const deadline = Date.now() + (options.startupTimeoutMs ?? 15_000)
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `MO.K server exited before startup.${stderr ? ` ${stderr.trim()}` : ''}`,
      )
    }
    await wait(150)
    const state = await probeLocalServer(fetchImpl)
    if (state === 'ready') {
      return { owned: true, process: child }
    }
    if (state === 'occupied') {
      child.kill()
      throw new Error('Port 8787 became occupied while MO.K was starting.')
    }
  }

  child.kill()
  throw new Error(
    `MO.K server did not become healthy in time.${stderr ? ` ${stderr.trim()}` : ''}`,
  )
}

export function stopOwnedLocalServer(handle: LocalServerHandle | null): void {
  if (handle?.owned && handle.process && handle.process.exitCode === null) {
    handle.process.kill()
  }
}
