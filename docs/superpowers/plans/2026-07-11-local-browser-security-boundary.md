# 本机浏览器安全边界 Implementation Plan

> 已完成的历史实施计划；其中 RED/GREEN 基线和命令输出只描述当时状态，当前命令见根 README。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Fastify 后端限制为只监听本机回环地址，并在业务路由执行前拒绝未知网页 Origin 和 cross-site 浏览器请求，同时保持当前 Vite `/api` 调用、本机无 Origin 工具和健康检查可用。

**Architecture:** 新增纯策略模块 `security/localAccess.ts`，把回环 Host、Origin 白名单和根级 `onRequest` 守卫集中在一处。再把 Fastify 组装提取到 `createApp()`，让真实 Hook、CORS、预检请求和健康路由可以通过 `Fastify.inject()` 做集成验证；`index.ts` 只负责监听 `127.0.0.1` 和进程级错误退出。Vite `/api` 代理目标同步固定为 `127.0.0.1`，避免 Windows 把 `localhost` 优先解析为 `::1`；开发端口设为 strict，避免静默漂移到 Origin 白名单以外。

**Tech Stack:** TypeScript 5.7、Fastify 5、`@fastify/cors` 10、Node.js test runner、tsx

## Global Constraints

- [ ] 开始实现前先确认当前 `HEAD` 已包含本 spec 和 plan，再使用 `superpowers:using-git-worktrees` 从该提交创建隔离工作树和 `codex/` 前缀分支，避免覆盖当前脏工作树。
- [ ] 不修改以下用户已有前端改动：`apps/web/src/App.css`、`apps/web/src/components/VideoPlayerModal.tsx`、`apps/web/src/nodes/ImageNode.tsx`、`apps/web/src/nodes/VideoNode.tsx`、`apps/web/src/nodes/registry.ts`、`apps/web/src/state/flowStore.ts`。
- [ ] 不增加运行时依赖，不改变相对 `/api`、既定端口或代理协议；Vite 配置只允许把代理 Host 从 `localhost` 改为 `127.0.0.1`，并加入 `strictPort: true`。
- [ ] 本批不处理 Settings 密钥脱敏、CLI 路径能力隔离、Codex 沙箱、SSRF 或本地路径读取。
- [ ] 每个生产改动都先写失败测试，再写最小实现；每次提交只暂存本任务列出的文件。
- [ ] 保留现有 `500 * 1024 * 1024` multipart 限制和全部业务路由注册顺序。

## Known Baseline

执行前重新确认以下基线；它们不是本批修复范围：

- Server TypeScript 检查当前会因 `apps/server/src/config/index.ts:42` 的既有 `TS2352` 退出非零。
- Server 全量测试当前为 65 tests、64 pass、1 fail；唯一失败是 `apps/server/test/videosService.test.ts:4` 在收集阶段导入不存在的 `buildVideoListResponse`，抛出 `SyntaxError`。
- 当前环境中 Node 对 `localhost` 的解析顺序是 `::1`、`127.0.0.1`；Vite 当前代理目标 `http://localhost:8787` 必须与 IPv4 回环监听对齐。
- Vite 当前没有 `strictPort`；5174 被占用时会自动切换端口，与固定 Origin 白名单冲突。
- 验收时允许这两个已知问题继续存在，但不允许出现新的 TypeScript 错误或测试失败。

---

### Task 1: 建立单一来源的本机访问策略

**Files:**

- Create: `apps/server/test/localAccess.test.ts`
- Create: `apps/server/src/security/localAccess.ts`
- Create: `apps/server/tsconfig.security-tests.json`

**Interfaces:**

```ts
export const LOCAL_SERVER_HOST: '127.0.0.1'
export const LOCAL_BROWSER_ORIGINS: ReadonlySet<string>

export interface LocalRequestMetadata {
  origin?: string
  secFetchSite?: string
}

export function isAllowedLocalRequest(
  metadata: LocalRequestMetadata,
): boolean

export function installLocalAccessGuard(app: FastifyInstance): void
```

- [ ] **Step 1: 先写策略和 Hook 的失败测试**

创建 `apps/server/test/localAccess.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {
  LOCAL_SERVER_HOST,
  installLocalAccessGuard,
  isAllowedLocalRequest,
} from '../src/security/localAccess'

test('uses the IPv4 loopback host', () => {
  assert.equal(LOCAL_SERVER_HOST, '127.0.0.1')
})

test('allows approved local browser origins and no-origin clients', () => {
  assert.equal(
    isAllowedLocalRequest({ origin: 'http://127.0.0.1:5174' }),
    true,
  )
  assert.equal(
    isAllowedLocalRequest({ origin: 'http://localhost:5174' }),
    true,
  )
  assert.equal(isAllowedLocalRequest({}), true)
})

test('rejects an unknown origin', () => {
  assert.equal(
    isAllowedLocalRequest({ origin: 'https://evil.example' }),
    false,
  )
})

test('rejects cross-site metadata even when the origin is approved', () => {
  assert.equal(
    isAllowedLocalRequest({
      origin: 'http://127.0.0.1:5174',
      secFetchSite: 'cross-site',
    }),
    false,
  )
})

test('guard rejects before the business handler executes', async () => {
  const app = Fastify()
  let handled = false

  installLocalAccessGuard(app)
  app.post('/api/test', async () => {
    handled = true
    return { ok: true }
  })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/test',
      headers: {
        origin: 'https://evil.example',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.deepEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: '仅允许本机浏览器访问',
    })
    assert.equal(handled, false)
  } finally {
    await app.close()
  }
})
```

- [ ] **Step 2: 运行测试，确认 RED**

Run:

```powershell
node --import tsx --test apps/server/test/localAccess.test.ts
```

Expected: 退出非零，错误明确指出找不到 `../src/security/localAccess`。如果测试因其他原因失败，先修正测试环境，不写生产代码绕过。

- [ ] **Step 3: 写最小策略实现**

创建 `apps/server/src/security/localAccess.ts`：

```ts
import type { FastifyInstance } from 'fastify'

export const LOCAL_SERVER_HOST = '127.0.0.1' as const

export const LOCAL_BROWSER_ORIGINS: ReadonlySet<string> = new Set([
  'http://127.0.0.1:5174',
  'http://localhost:5174',
])

export interface LocalRequestMetadata {
  origin?: string
  secFetchSite?: string
}

export function isAllowedLocalRequest({
  origin,
  secFetchSite,
}: LocalRequestMetadata): boolean {
  if (secFetchSite?.toLowerCase() === 'cross-site') {
    return false
  }

  return origin === undefined || LOCAL_BROWSER_ORIGINS.has(origin)
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function installLocalAccessGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const allowed = isAllowedLocalRequest({
      origin: request.headers.origin,
      secFetchSite: firstHeaderValue(request.headers['sec-fetch-site']),
    })

    if (allowed) {
      return
    }

    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: '仅允许本机浏览器访问',
    })
  })
}
```

- [ ] **Step 4: 运行测试，确认 GREEN**

Run:

```powershell
node --import tsx --test apps/server/test/localAccess.test.ts
```

Expected: 5 个测试全部通过，0 failure。

- [ ] **Step 5: 为新增安全测试建立严格类型检查入口**

创建 `apps/server/tsconfig.security-tests.json`：

```json
{
  "extends": "./tsconfig.json",
  "include": [
    "src",
    "test/localAccess.test.ts"
  ]
}
```

Run:

```powershell
npm exec --workspace apps/server -- tsc -p tsconfig.security-tests.json --noEmit --pretty false
```

Expected: 非零退出时只能包含既有的 `src/config/index.ts(42,9): error TS2352`；`localAccess.ts` 和 `localAccess.test.ts` 不得出现类型错误。

- [ ] **Step 6: 检查并提交 Task 1**

Run:

```powershell
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  throw 'Git index was not empty before Task 1 staging'
}
git add apps/server/test/localAccess.test.ts apps/server/src/security/localAccess.ts apps/server/tsconfig.security-tests.json
git diff --cached --check
git diff --cached --name-only
git diff --cached -- apps/server/test/localAccess.test.ts apps/server/src/security/localAccess.ts apps/server/tsconfig.security-tests.json
git commit -m "feat(server): add local browser access guard"
```

Expected: `git diff --cached --check` 无输出；`--name-only` 恰好列出上述三个新文件，缓存 diff 不包含其他路径。

---

### Task 2: 把守卫接入真实 Fastify 应用和回环监听

**Files:**

- Create: `apps/server/test/appSecurity.test.ts`
- Create: `apps/server/src/app.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/tsconfig.security-tests.json`
- Create: `apps/web/test/viteProxy.test.ts`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**

```ts
export interface CreateAppOptions {
  logger?: boolean
}

export function createApp(
  options?: CreateAppOptions,
): FastifyInstance
```

- [ ] **Step 1: 先写真实应用组合的失败测试**

创建 `apps/server/test/appSecurity.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/app'

async function withApp(
  run: (app: FastifyInstance) => Promise<void>,
): Promise<void> {
  const app = createApp({ logger: false })

  try {
    await run(app)
  } finally {
    await app.close()
  }
}

test('allows an approved browser origin and emits its CORS header', async () => {
  await withApp(async (app) => {
    const origin = 'http://127.0.0.1:5174'
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin,
        'sec-fetch-site': 'same-site',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], origin)
    assert.equal(response.json().status, 'ok')
  })
})

test('keeps no-origin local clients working', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
    assert.equal(response.json().status, 'ok')
  })
})

test('rejects an unknown browser origin', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'https://evil.example',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.deepEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: '仅允许本机浏览器访问',
    })
  })
})

test('rejects cross-site metadata before routing', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:5174',
        'sec-fetch-site': 'cross-site',
      },
    })

    assert.equal(response.statusCode, 403)
  })
})

test('rejects a cross-site preflight before CORS can answer', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:5174',
        'sec-fetch-site': 'cross-site',
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  })
})

test('rejects an unknown-origin preflight before CORS can answer', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  })
})

test('answers an approved CORS preflight request', async () => {
  await withApp(async (app) => {
    const origin = 'http://localhost:5174'
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin,
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 204)
    assert.equal(response.headers['access-control-allow-origin'], origin)
  })
})
```

- [ ] **Step 2: 运行测试，确认 RED**

Run:

```powershell
node --import tsx --test apps/server/test/appSecurity.test.ts
```

Expected: 退出非零，错误明确指出找不到 `../src/app`。

- [ ] **Step 3: 提取可测试的应用组装函数**

创建 `apps/server/src/app.ts`：

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import type { ApiHealthResponse } from '@jimeng-flow/shared'
import settingsRoutes from './routes/settings'
import flowsRoutes from './routes/flows'
import llmRoutes from './routes/llm'
import assetsRoutes from './routes/assets'
import generationsRoutes from './routes/generations'
import agentRoutes from './routes/agent'
import codexRoutes from './routes/codex'
import videosRoutes from './routes/videos'
import {
  installLocalAccessGuard,
  isAllowedLocalRequest,
} from './security/localAccess'

export interface CreateAppOptions {
  logger?: boolean
}

export function createApp(
  options: CreateAppOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  installLocalAccessGuard(app)
  app.register(cors, {
    origin(origin, callback) {
      callback(null, isAllowedLocalRequest({ origin }))
    },
  })

  app.get('/api/health', async () => {
    const body: ApiHealthResponse = {
      status: 'ok',
      service: 'jimeng-flow-server',
      timestamp: Date.now(),
    }
    return body
  })

  app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024,
      files: 1,
    },
  })
  app.register(settingsRoutes)
  app.register(flowsRoutes)
  app.register(llmRoutes)
  app.register(assetsRoutes)
  app.register(generationsRoutes)
  app.register(agentRoutes)
  app.register(codexRoutes)
  app.register(videosRoutes)

  return app
}
```

说明：`app.register()` 在 `createApp()` 中排入 Fastify 插件队列；`app.inject()` 和 `app.listen()` 都会等待应用 ready，无需把 `createApp()` 变成异步函数。

- [ ] **Step 4: 把进程入口缩减为回环监听**

用以下内容替换 `apps/server/src/index.ts`：

```ts
import { createApp } from './app'
import { LOCAL_SERVER_HOST } from './security/localAccess'

const PORT = Number(process.env.PORT ?? 8787)
const app = createApp()

const start = async () => {
  try {
    await app.listen({
      port: PORT,
      host: LOCAL_SERVER_HOST,
    })
    app.log.info(
      '即梦 Flow 后端监听 http://' + LOCAL_SERVER_HOST + ':' + PORT,
    )
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

- [ ] **Step 5: 运行两层安全测试，确认 GREEN**

Run:

```powershell
node --import tsx --test apps/server/test/localAccess.test.ts apps/server/test/appSecurity.test.ts
```

Expected: 12 个测试全部通过，0 failure；合法预检返回 204，未知 Origin 和 cross-site 请求（包括 OPTIONS）返回 403。

- [ ] **Step 6: 先写 Vite 回环代理的失败测试**

创建 `apps/web/test/viteProxy.test.ts`：

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import config from '../vite.config'

test('Vite API proxy targets the IPv4 loopback server', () => {
  const apiProxy = config.server?.proxy?.['/api']

  assert.deepEqual(
    {
      host: config.server?.host,
      port: config.server?.port,
      strictPort: config.server?.strictPort,
      target:
        typeof apiProxy === 'object' && apiProxy !== null
          ? apiProxy.target
          : apiProxy,
    },
    {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      target: 'http://127.0.0.1:8787',
    },
  )
})
```

- [ ] **Step 7: 运行代理测试，确认 RED**

Run:

```powershell
node --import tsx --test apps/web/test/viteProxy.test.ts
```

Expected: 1 个测试失败，差异明确显示当前 `strictPort` 为 `undefined`、代理为 `http://localhost:8787`。

- [ ] **Step 8: 对齐 Vite 代理和后端监听地址**

在 `apps/web/vite.config.ts` 中只改这一行：

```diff
     host: '127.0.0.1',
     port: 5174,
+    strictPort: true,
     proxy: {
       '/api': {
-        target: 'http://localhost:8787',
+        target: 'http://127.0.0.1:8787',
```

Run:

```powershell
node --import tsx --test apps/web/test/viteProxy.test.ts
```

Expected: 1/1 pass。不要加入环境变量、动态端口白名单或新的代理分支；端口冲突必须显式失败。

- [ ] **Step 9: 检查 Vite 配置 TypeScript**

Run:

```powershell
npm exec --workspace apps/web -- tsc -p tsconfig.node.json --noEmit --pretty false
```

Expected: 退出 0、无输出。`tsconfig.node.json` 只检查 `vite.config.ts`，不会被前端应用中既有类型问题污染。

- [ ] **Step 10: 检查 Server TypeScript 增量**

把 `apps/server/tsconfig.security-tests.json` 更新为：

```json
{
  "extends": "./tsconfig.json",
  "include": [
    "src",
    "test/localAccess.test.ts",
    "test/appSecurity.test.ts"
  ]
}
```

Run:

```powershell
npm exec --workspace apps/server -- tsc -p tsconfig.security-tests.json --noEmit --pretty false
```

Expected: 仍会非零退出，但输出只能包含既有的 `src/config/index.ts(42,9): error TS2352`；新增生产文件和两个安全测试不得出现类型错误。如果基线错误消失，则命令应为 0。

- [ ] **Step 11: 运行 Server 全量测试，排除回归**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath 'apps/server/test' -Filter '*.test.ts' |
  ForEach-Object { $_.FullName }
node --import tsx --test --test-reporter=tap $tests
```

Expected: 77 tests、76 pass、1 fail；唯一失败必须仍是 `videosService.test.ts:4` 的 `SyntaxError: ... does not provide an export named 'buildVideoListResponse'`。任何不同错误签名或额外失败都视为回归，不用本批顺手修该旧测试。

- [ ] **Step 12: 启动真实进程，验证监听地址和 HTTP 行为**

在仓库根目录运行：

```powershell
$root = (Get-Location).Path
$serverPort = 8787
$webPort = 5174
$occupied = Get-NetTCPConnection -State Listen -LocalPort @($serverPort, $webPort) -ErrorAction SilentlyContinue
if ($occupied) {
  $details = $occupied |
    Select-Object LocalAddress, LocalPort, OwningProcess |
    Format-Table -AutoSize |
    Out-String
  throw ('Smoke-test ports are already in use:' + [Environment]::NewLine + $details)
}

function Wait-ForOwnedListener {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$Port,
    [string]$StderrPath
  )

  $deadline = (Get-Date).AddSeconds(15)
  do {
    if ($Process.HasExited) {
      $errorText = Get-Content -LiteralPath $StderrPath -Raw -ErrorAction SilentlyContinue
      throw "Process $($Process.Id) exited before listening on $Port. stderr: $errorText"
    }

    $listener = @(
      Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -eq $Process.Id }
    )
    if ($listener.Count -gt 0) {
      return $listener
    }

    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  throw "Process $($Process.Id) did not listen on $Port within 15 seconds"
}

$server = $null
$web = $null
$logs = @()
$hadPort = Test-Path Env:PORT
$previousPort = $env:PORT

try {
  $serverOut = [System.IO.Path]::GetTempFileName()
  $logs += $serverOut
  $serverErr = [System.IO.Path]::GetTempFileName()
  $logs += $serverErr
  $webOut = [System.IO.Path]::GetTempFileName()
  $logs += $webOut
  $webErr = [System.IO.Path]::GetTempFileName()
  $logs += $webErr

  $env:PORT = [string]$serverPort
  $server = Start-Process -FilePath 'node' -ArgumentList '--import', 'tsx', 'apps/server/src/index.ts' -WorkingDirectory $root -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden -PassThru
  if ($hadPort) {
    $env:PORT = $previousPort
  } else {
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
  }
  $serverListener = @(Wait-ForOwnedListener -Process $server -Port $serverPort -StderrPath $serverErr)
  $serverAddresses = @(
    $serverListener |
      Select-Object -ExpandProperty LocalAddress -Unique
  )
  if ($serverAddresses.Count -ne 1 -or $serverAddresses[0] -ne '127.0.0.1') {
    throw "Server listener is not IPv4 loopback-only: $($serverAddresses -join ', ')"
  }

  $web = Start-Process -FilePath 'node' -ArgumentList '..\..\node_modules\vite\bin\vite.js', '--config', 'vite.config.ts' -WorkingDirectory (Join-Path $root 'apps\web') -RedirectStandardOutput $webOut -RedirectStandardError $webErr -WindowStyle Hidden -PassThru
  $webListener = @(Wait-ForOwnedListener -Process $web -Port $webPort -StderrPath $webErr)
  $webAddresses = @(
    $webListener |
      Select-Object -ExpandProperty LocalAddress -Unique
  )
  if ($webAddresses.Count -ne 1 -or $webAddresses[0] -ne '127.0.0.1') {
    throw "Vite listener is not IPv4 loopback-only: $($webAddresses -join ', ')"
  }

  $directHealth = Invoke-RestMethod "http://127.0.0.1:$serverPort/api/health"
  if ($directHealth.status -ne 'ok') {
    throw 'Direct loopback health check failed'
  }

  $proxyHealth = Invoke-RestMethod "http://127.0.0.1:$webPort/api/health" -Headers @{
    Origin = 'http://127.0.0.1:5174'
    'Sec-Fetch-Site' = 'same-origin'
  }
  if ($proxyHealth.status -ne 'ok') {
    throw 'Vite proxy health check failed'
  }

  try {
    Invoke-WebRequest "http://127.0.0.1:$serverPort/api/health" -Headers @{ Origin = 'https://evil.example' } -UseBasicParsing | Out-Null
    throw 'Unknown Origin unexpectedly reached the route'
  } catch {
    $statusCode = if ($_.Exception.Response) {
      [int]$_.Exception.Response.StatusCode
    } else {
      0
    }
    if ($statusCode -ne 403) {
      throw
    }
  }
} finally {
  foreach ($child in @($web, $server)) {
    if ($null -ne $child) {
      if (-not $child.HasExited) {
        Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
      }
      Wait-Process -Id $child.Id -Timeout 5 -ErrorAction SilentlyContinue
    }
  }

  if ($hadPort) {
    $env:PORT = $previousPort
  } else {
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
  }

  foreach ($log in $logs) {
    Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
  }
}
```

Expected: 脚本无输出退出；后端和 Vite 的监听记录都属于刚启动的 PID，且地址严格为 `127.0.0.1`；直连和 Vite `/api` 代理 health 都返回 `ok`；未知 Origin 返回 403。启动失败或端口被占用时脚本明确失败，`finally` 只终止自己启动的进程并删除自己的临时日志。

- [ ] **Step 13: 检查并提交 Task 2**

Run:

```powershell
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  throw 'Git index was not empty before Task 2 staging'
}
git add apps/server/src/app.ts apps/server/src/index.ts apps/server/test/appSecurity.test.ts apps/server/tsconfig.security-tests.json apps/web/vite.config.ts apps/web/test/viteProxy.test.ts
git diff --cached --check
git diff --cached --name-only
git diff --cached -- apps/server/src/app.ts apps/server/src/index.ts apps/server/test/appSecurity.test.ts apps/server/tsconfig.security-tests.json apps/web/vite.config.ts apps/web/test/viteProxy.test.ts
git commit -m "refactor: enforce local browser boundary"
```

Expected: `git diff --cached --check` 无输出；`--name-only` 恰好列出上述六个文件，缓存 diff 不包含其他路径。

---

## Final Verification

- [ ] 再运行定向测试：

  ```powershell
  node --import tsx --test apps/server/test/localAccess.test.ts apps/server/test/appSecurity.test.ts apps/web/test/viteProxy.test.ts
  ```

  Expected: 13/13 pass。

- [ ] 再运行 Vite 配置 TypeScript 检查：

  ```powershell
  npm exec --workspace apps/web -- tsc -p tsconfig.node.json --noEmit --pretty false
  ```

  Expected: 退出 0、无输出。

- [ ] 再运行 Server 源码与新增测试的严格类型检查：

  ```powershell
  npm exec --workspace apps/server -- tsc -p tsconfig.security-tests.json --noEmit --pretty false
  ```

  Expected: 只有既有 `src/config/index.ts(42,9): error TS2352`，没有第二个错误。

- [ ] 再运行 Server 全量测试，Expected: 77 tests、76 pass、1 个精确匹配既有 `buildVideoListResponse` 缺失导出的失败。
- [ ] 再运行 Step 12 的双进程 smoke，Expected: 后端回环监听、Vite 回环监听、`/api` 真实代理链和未知 Origin 403 全部通过。
- [ ] 运行 `git diff --check` 和 `git status --short`，Expected: 实现工作树无未提交改动。
- [ ] 运行 `git diff --name-only HEAD~2..HEAD`，Expected: 两个实现提交合计只包含以下 8 个路径：

  ```text
  apps/server/src/app.ts
  apps/server/src/index.ts
  apps/server/src/security/localAccess.ts
  apps/server/test/appSecurity.test.ts
  apps/server/test/localAccess.test.ts
  apps/server/tsconfig.security-tests.json
  apps/web/test/viteProxy.test.ts
  apps/web/vite.config.ts
  ```

- [ ] 运行 `git -C 'F:\AI\vs code\claudecode\即梦CLI调用' status --short`，确认原工作树中的 6 个前端修改和既有未跟踪文件仍在，且没有被实现提交覆盖。
- [ ] 运行 `git log -3 --oneline`，确认安全实现由两个边界清晰的提交组成。
- [ ] 对照 `docs/superpowers/specs/2026-07-11-local-browser-security-boundary-design.md` 逐项检查验收标准。
- [ ] 使用 `superpowers:verification-before-completion` 做最终证据核验；在声称完成前报告定向测试、全量测试、TypeScript 检查和真实监听 smoke test 的实际结果。

## Deferred Work

不要在本计划内继续扩张。后续单独设计并实施：

1. Settings API 密钥脱敏和 write-only 更新。
2. CLI 可执行文件与输出目录从 HTTP 设置面剥离。
3. Codex 隔离工作目录和最小沙箱权限。
4. Provider URL、远程下载和本地输入路径策略统一化。
