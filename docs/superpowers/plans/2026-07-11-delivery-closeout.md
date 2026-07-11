# 工作树收口与可交付状态 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前已经通过浏览器与全量检查的本地改动拆成可审查提交，清零 7 条 lint warning，收口明确的本地杂项，并让主工作树达到可复现、可审查、`git status` 干净的交付状态。

**Architecture:** 先提交不触碰用户六个 UI 文件的 stale-flow 恢复修复，再把已验证的 UI 交互作为独立提交固化；随后在干净基线上逐项消除 lint warning，使机械清理不会混入功能提交。最后只删除明确可再生的冲突锁文件，版本化忽略 Codex 日志，并用 `.git/info/exclude` 保留嵌套脏仓库与两张本地图片，避免为了追求干净状态破坏用户数据。

**Tech Stack:** React 19、TypeScript、Zustand、Fastify、Node test runner、tsx、Oxlint、Vite 8、npm workspaces、PowerShell、Git

## Global Constraints

- [ ] 仅使用 npm；`package-lock.json` 是唯一锁文件，不运行 pnpm、Yarn 或 Bun。
- [ ] 所有安装、类型检查、lint、测试和构建命令都从仓库根目录运行。
- [ ] 不使用 `git reset --hard`、`git checkout --`、`git clean` 或任何会批量丢弃工作树内容的命令。
- [ ] 不删除 `jimeng-flow-workbench/`：它是一个有大量未提交改动的嵌套 Git 仓库，只允许加入主仓库的本地 `.git/info/exclude`。
- [ ] 不删除或提交 `image/墨K表情包01 经典拽脸_20260705_134805.png` 与 `image/裁剪_20260705_134713.png`；两者当前未被源码引用，只允许本地排除。
- [ ] `.codex-logs/` 是可再生日志目录，必须通过根 `.gitignore` 排除；日志文件是否物理删除不影响目标完成。
- [ ] `pnpm-lock.yaml` 与项目 npm-only 契约冲突，确认根 `package-lock.json` 存在后删除；不得把它加入 ignore 来掩盖错误包管理器使用。
- [ ] `workspace/`、设置、工作流、生成资产和密钥都不进入 Git。
- [ ] 真实图片或视频生成可能产生外部调用和费用，本计划不触发；Provider/CLI 只允许执行状态校验。
- [ ] Vite 的单 chunk 大于 500 kB 警告记录为后续独立性能目标；本次不引入路由、懒加载或手工分包，避免扩大收口范围。
- [ ] 每个提交前必须运行对应验证，检查暂存文件清单，并完成独立只读审查；Critical/Important 未清零不得继续。

---

### Task 1: 固化 stale-flow 恢复与 Promise 竞态修复

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/flows.ts`
- Create: `apps/web/src/utils/lastFlowRestore.ts`
- Create: `apps/web/test/flowsApi.test.ts`
- Create: `apps/web/test/lastFlowRestore.test.ts`

**Interfaces:**

- Produces: `FlowApiError(message, status, code)` 与 `isFlowNotFoundError(error)`
- Produces: `startLastFlowRestore(options): Promise<LastFlowRestoreResult> | null`
- Guarantees: 同一 flow 的并发恢复只发起一次；只有 `404 + FLOW_NOT_FOUND` 才清理仍匹配的存储 ID；旧 Promise 不覆盖新 flow 的 view/restoring 状态

- [ ] **Step 1: 核对本任务 diff 没有混入 UI 文件**

Run:

```powershell
git diff -- apps/web/src/App.tsx apps/web/src/api/flows.ts
Get-Content -LiteralPath apps/web/src/utils/lastFlowRestore.ts -Raw
Get-Content -LiteralPath apps/web/test/flowsApi.test.ts -Raw
Get-Content -LiteralPath apps/web/test/lastFlowRestore.test.ts -Raw
```

Expected: 只包含错误结构化、恢复协调器、App 接线和对应测试；不改 `App.css`、播放器或节点组件。

- [ ] **Step 2: 运行恢复链路定向测试**

Run:

```powershell
node --import tsx --test apps/web/test/flowsApi.test.ts apps/web/test/lastFlowRestore.test.ts
```

Expected: 全部退出 0，并直接覆盖以下行为：

- 同一 stale ID 并发去重；
- 结构化 404 清理匹配 ID；
- 500、普通 Error 和错误 code 不被误判；
- A pending 时写入或加载 B，A 的迟到失败返回 `stale`；
- 只有最新 attempt 能结束 restoring 状态。

- [ ] **Step 3: 运行 Web 类型检查与全量检查**

Run:

```powershell
npm run typecheck:web
npm run check
git diff --check
```

Expected: 三条命令退出 0；lint 此时允许显示已知 7 条 warning，但不得出现 error。

- [ ] **Step 4: 暂存精确文件并审查**

Run:

```powershell
git add -- apps/web/src/App.tsx apps/web/src/api/flows.ts apps/web/src/utils/lastFlowRestore.ts apps/web/test/flowsApi.test.ts apps/web/test/lastFlowRestore.test.ts
git diff --cached --check
git diff --cached --name-only
git diff --cached
```

Expected: 暂存区恰好只有上述 5 个文件。独立 reviewer 必须给出 `Ready to merge: Yes`，且无 Critical/Important。

- [ ] **Step 5: 提交恢复修复**

Run:

```powershell
git commit -m "fix(web): harden last-flow restoration"
```

Expected: 提交成功；六个 UI 文件仍保持未提交状态。

---

### Task 2: 固化已经验证的首页与媒体交互

**Files:**

- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/components/VideoPlayerModal.tsx`
- Modify: `apps/web/src/nodes/ImageNode.tsx`
- Modify: `apps/web/src/nodes/VideoNode.tsx`
- Modify: `apps/web/src/nodes/registry.ts`
- Modify: `apps/web/src/state/flowStore.ts`
- Modify: `apps/web/src/utils/generationResume.ts`
- Create: `apps/web/test/flowStoreLoadRace.test.ts`
- Create: `apps/web/test/flowStoreSaveRace.test.ts`

**Interfaces:**

- Preserves: MO.K 首页与作品展示、设置入口、作品管理、图片输出兼容、视频节点单击编辑/双击播放、刷新后生成状态与资产持久化
- Consumes: Task 1 已提交的恢复协调行为

**Review-driven scope expansion (2026-07-12):** 预提交与多轮正式审查连续发现 latest-intent、保存队列、后台刷新、删除复活及请求等待窗口覆盖本地编辑等竞态。Controller 批准用 TDD 分离用户导航和后台刷新语义，引入稳定画布快照、per-flow 删除 epoch 与 reload identity gate，新增上述两个真实 store 回归测试，并将后台生成恢复调用点显式标为 refresh。最终 52 条竞态回归全部通过；Task 2 精确提交范围由 6 个源文件扩为 9 个文件。

- [ ] **Step 1: 审查最终九文件边界**

Run:

```powershell
git diff --stat -- apps/web/src/App.css apps/web/src/components/VideoPlayerModal.tsx apps/web/src/nodes/ImageNode.tsx apps/web/src/nodes/VideoNode.tsx apps/web/src/nodes/registry.ts apps/web/src/state/flowStore.ts apps/web/src/utils/generationResume.ts apps/web/test/flowStoreLoadRace.test.ts apps/web/test/flowStoreSaveRace.test.ts
git diff --check
```

Expected: Task 2 提交只有上述 9 个文件；不包含 API、Server、测试 runner、锁文件或文档。

- [ ] **Step 2: 运行媒体与首页相关测试**

Run:

```powershell
node --import tsx --test apps/web/test/homePage.test.tsx apps/web/test/homeFeaturedVideos.test.tsx apps/web/test/settingsModalHomeVisual.test.tsx apps/web/test/videoAdminModal.test.tsx apps/web/test/videoNodePlaybackLayout.test.ts apps/web/test/videoGenerationState.test.ts apps/web/test/imageGenerationInputs.test.ts apps/web/test/flowStoreLoadRace.test.ts apps/web/test/flowStoreSaveRace.test.ts
npm run typecheck:web
```

Expected: 所有定向测试与类型检查退出 0。

- [ ] **Step 3: 执行非计费浏览器烟测**

启动或复用根开发服务；禁止打开额外可见终端窗口：

```powershell
$webReady = $false
try {
  $webReady = (Invoke-WebRequest -Uri 'http://127.0.0.1:5174' -UseBasicParsing).StatusCode -eq 200
} catch {}
if (-not $webReady) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory (Get-Location) -WindowStyle Hidden
  Start-Sleep -Seconds 2
}
```

使用内置浏览器验证：

- 首页 Logo 菜单可打开设置和作品管理；
- 设置 range 修改后点击取消，重开保持原值；
- 作品管理可在“全部 / 精选作品 / 视频 / 图片”间切换；
- 图片校验与即梦 CLI 校验进入成功或明确错误状态；
- 有成品的视频节点单击只打开编辑器，双击打开 compact 播放器；
- 刷新后当前视频 asset ID 不丢失；
- 不点击“发送生成”“高清确认”或任何真实生成入口。

Expected: 页面无白屏；除浏览器媒体 user-activation 限制外，控制台无新增 error。若打开已有 flow 触发自动保存，测试后恢复原 selected 标记，不修改节点内容、提示词或资产。

- [ ] **Step 4: 全量验证并独立审查**

Run:

```powershell
npm run check
git diff --check
```

Expected: 退出 0；允许当前 7 条既有 lint warning。Reviewer 无 Critical/Important。

- [ ] **Step 5: 暂存并提交 UI 改动**

Run:

```powershell
git add -- apps/web/src/App.css apps/web/src/components/VideoPlayerModal.tsx apps/web/src/nodes/ImageNode.tsx apps/web/src/nodes/VideoNode.tsx apps/web/src/nodes/registry.ts apps/web/src/state/flowStore.ts apps/web/src/utils/generationResume.ts apps/web/test/flowStoreLoadRace.test.ts apps/web/test/flowStoreSaveRace.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(web): refine home and media interactions"
```

Expected: 暂存区恰好只有批准的 9 个文件，提交成功。

---

### Task 3: 清零 7 条 lint warning

**Files:**

- Modify: `apps/web/test/imageGenerationFlow.test.ts`
- Modify: `apps/server/src/services/agent/index.ts`
- Create: `apps/web/src/components/canvas/cutEdgeGeometry.ts`
- Modify: `apps/web/src/components/canvas/CutEdge.tsx`
- Modify: `apps/web/test/nodeHandleAnchor.test.ts`
- Modify: `apps/web/src/nodes/VideoNode.tsx`
- Modify: `apps/web/src/nodes/ImageNode.tsx`

**Interfaces:**

- Produces: `getCardEdgePoint(node, fallback, position)` 从非组件模块导出，避免 Fast Refresh 组件文件混合导出
- Preserves: 视频默认参数同步、图片引用去重、剪刀断线几何行为
- Removes: 未使用类型 import 与未使用 `asStringArray`

- [ ] **Step 1: 记录 lint RED 基线**

Run:

```powershell
npm run lint
```

Expected: 命令退出 0，但准确报告 7 条 warning：1 条未使用 import、1 条 only-export-components、2 条 Server 未使用符号、2 条 VideoNode effect 依赖、1 条 ImageNode memo 依赖。

- [ ] **Step 2: 移除两个确定的未使用符号**

把 `apps/web/test/imageGenerationFlow.test.ts` 的导入改为：

```ts
import { startImageGenerationFlow } from '../src/utils/imageGenerationFlow'
```

从 `apps/server/src/services/agent/index.ts` 删除完整的未使用函数：

```ts
function asStringArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}
```

Expected: 不改相邻解析行为。

- [ ] **Step 3: 把边几何函数移出组件文件**

创建 `apps/web/src/components/canvas/cutEdgeGeometry.ts`：

```ts
import { Position, type Node } from '@xyflow/react'

const FALLBACK_NODE_WIDTH = 200
const FALLBACK_NODE_HEIGHT = 150

function getNodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT,
  }
}

export function getCardEdgePoint(
  node: Node | undefined,
  fallback: { x: number; y: number },
  position: Position,
): { x: number; y: number } {
  if (!node) return fallback

  const { width, height } = getNodeSize(node)
  const left = node.position.x
  const right = node.position.x + width
  const top = node.position.y
  const bottom = node.position.y + height

  if (position === Position.Left || position === Position.Right) {
    return {
      x: position === Position.Left ? left : right,
      y: top + height / 2,
    }
  }

  return {
    x: Math.min(right, Math.max(left, fallback.x)),
    y: position === Position.Top ? top : bottom,
  }
}
```

在 `CutEdge.tsx` 删除 `Position`、`Node`、fallback 常量、`getNodeSize` 和导出的 `getCardEdgePoint`，改为：

```ts
import { EdgeLabelRenderer, getBezierPath, useStore } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { getCardEdgePoint } from './cutEdgeGeometry'
```

把 `apps/web/test/nodeHandleAnchor.test.ts` 的导入改为：

```ts
import { getCardEdgePoint } from '../src/components/canvas/cutEdgeGeometry'
```

- [ ] **Step 4: 精确修复 Hook 依赖，不依赖整个 nodeData 对象**

在 `VideoNode.tsx` 第一个默认值 effect 中，把传入对象收窄为实际读取字段：

```ts
nodeData: {
  aspectRatio: rawNodeData.aspectRatio,
  count: rawNodeData.count,
  durationSeconds: rawNodeData.durationSeconds,
  resolution: rawNodeData.resolution,
},
```

保留依赖数组中的四个对应字段、`nodeData.mode` 和 `nodeData.prompt`。

在模型默认值 effect 中改为：

```ts
nodeData: { model: rawNodeData.model },
```

保留依赖 `modelTouched`、`rawNodeData.model`、`videoModelOptions`。不得把整个 `rawNodeData` 加进依赖数组，避免对象身份变化触发不必要的状态回写。

在 `ImageNode.tsx` 的 `referenceAssetIds` memo 依赖数组加入：

```ts
nodeData.assetId,
```

- [ ] **Step 5: 验证 lint GREEN 与行为不变**

Run:

```powershell
npm run lint
node --import tsx --test apps/web/test/nodeHandleAnchor.test.ts apps/web/test/cutEdgeScissors.test.ts apps/web/test/videoGenerationState.test.ts apps/web/test/imageGenerationInputs.test.ts apps/web/test/imageGenerationFlow.test.ts
npm run typecheck
npm run check
```

Expected: `npm run lint` 零 warning、零 error；其余命令全部退出 0。Vite chunk-size warning 不计入 lint warning。

- [ ] **Step 6: 暂存、审查并提交 warning 清理**

Run:

```powershell
git add -- apps/web/test/imageGenerationFlow.test.ts apps/server/src/services/agent/index.ts apps/web/src/components/canvas/cutEdgeGeometry.ts apps/web/src/components/canvas/CutEdge.tsx apps/web/test/nodeHandleAnchor.test.ts apps/web/src/nodes/VideoNode.tsx apps/web/src/nodes/ImageNode.tsx
git diff --cached --check
git diff --cached --name-only
git diff --cached
git commit -m "fix: eliminate lint warnings"
```

Expected: 只包含上述 7 个文件；独立 reviewer 无 Critical/Important。

---

### Task 4: 收口本地杂项且保留用户数据

**Files:**

- Modify: `.gitignore`
- Modify locally, do not commit: `.git/info/exclude`
- Delete untracked: `pnpm-lock.yaml`
- Commit with this task: `docs/superpowers/plans/2026-07-11-delivery-closeout.md`

**Interfaces:**

- Produces: 主仓库不再显示 Codex 日志、嵌套脏仓库和两张本地图片
- Preserves: 嵌套仓库全部未提交内容及两张图片原文件

- [ ] **Step 1: 验证可删除与不可删除边界**

Run:

```powershell
Test-Path -LiteralPath package-lock.json
Test-Path -LiteralPath pnpm-lock.yaml
git -C jimeng-flow-workbench status --short
Get-Item -LiteralPath 'image/墨K表情包01 经典拽脸_20260705_134805.png','image/裁剪_20260705_134713.png' | Select-Object FullName,Length
```

Expected: `package-lock.json` 存在；`pnpm-lock.yaml` 存在且未跟踪；嵌套仓库显示大量 dirty 文件，因此禁止删除；两张图片存在。

- [ ] **Step 2: 版本化忽略 Codex 日志**

在根 `.gitignore` 的日志区加入：

```gitignore
.codex-logs/
```

不得把 `pnpm-lock.yaml` 加入 ignore。

- [ ] **Step 3: 本地排除用户私有文件**

用 `apply_patch` 向 `.git/info/exclude` 追加：

```gitignore
jimeng-flow-workbench/
image/墨K表情包01 经典拽脸_20260705_134805.png
image/裁剪_20260705_134713.png
```

Expected: 只影响当前 clone 的状态显示，不删除、不移动、不提交这些内容。

- [ ] **Step 4: 删除冲突锁文件**

在确认 `package-lock.json` 存在且已跟踪后，用 `apply_patch` 删除未跟踪的 `pnpm-lock.yaml`。

Run:

```powershell
git ls-files --error-unmatch package-lock.json
Test-Path -LiteralPath pnpm-lock.yaml
```

Expected: 第一条退出 0；第二条返回 `False`。

- [ ] **Step 5: 暂存并提交版本化收口内容**

Run:

```powershell
git add -- .gitignore docs/superpowers/plans/2026-07-11-delivery-closeout.md
git diff --cached --check
git diff --cached --name-only
git commit -m "chore: close repository delivery hygiene"
```

Expected: 提交只包含 `.gitignore` 与本计划文档；`.git/info/exclude` 不在提交中。

---

### Task 5: 最终验收与交付

**Files:**

- Verify only; no planned production edits

**Interfaces:**

- Produces: 可复现安装、全量绿色质量门、干净主工作树与清晰提交历史

- [ ] **Step 1: 验证 npm 干净安装不漂移锁文件**

Run:

```powershell
$lockHashBefore = (Get-FileHash -LiteralPath package-lock.json -Algorithm SHA256).Hash
npm ci
$lockHashAfter = (Get-FileHash -LiteralPath package-lock.json -Algorithm SHA256).Hash
if ($lockHashBefore -ne $lockHashAfter) {
  throw 'npm ci changed package-lock.json'
}
```

Expected: `npm ci` 退出 0；锁文件哈希不变。

- [ ] **Step 2: 运行唯一最终质量门**

Run:

```powershell
npm run check
git diff --check
```

Expected: 类型检查、lint、Server/Web 全量测试和生产构建全部退出 0；lint 零 warning；允许 Vite 报告已知 chunk-size warning。

- [ ] **Step 3: 只读核对本机服务边界**

复用现有服务；若服务未运行，则在隐藏后台进程中启动后验证：

```powershell
$webReady = $false
try {
  $webReady = (Invoke-WebRequest -Uri 'http://127.0.0.1:5174' -UseBasicParsing).StatusCode -eq 200
} catch {}
if (-not $webReady) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory (Get-Location) -WindowStyle Hidden
  Start-Sleep -Seconds 2
}
Invoke-WebRequest -Uri 'http://127.0.0.1:5174' -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri 'http://127.0.0.1:8787/api/health' -UseBasicParsing | Select-Object StatusCode
```

Expected: 两个状态码均为 200；监听地址仍为 IPv4 loopback，不开放局域网。

- [ ] **Step 4: 执行最终只读审查**

Reviewer 必须检查从 `68b0475` 到当前 HEAD 的全部提交，重点验证：

- stale-flow 恢复没有存储清理或 Promise 竞态；
- UI 提交没有混入 Server、锁文件或本地资产；
- lint 清理没有改变生成默认值和节点引用语义；
- `.gitignore` 没有隐藏第二套 lockfile；
- 嵌套仓库和图片仍然存在。

Expected: `Ready to merge: Yes`，无 Critical/Important。

- [ ] **Step 5: 验证干净状态和提交历史**

Run:

```powershell
git status --short
git log -5 --oneline
Test-Path -LiteralPath 'jimeng-flow-workbench/.git'
Test-Path -LiteralPath 'image/墨K表情包01 经典拽脸_20260705_134805.png'
Test-Path -LiteralPath 'image/裁剪_20260705_134713.png'
```

Expected:

- `git status --short` 无输出；
- 最近提交按顺序包含恢复修复、UI、lint 清理和交付收口；
- 嵌套仓库与两张图片都返回 `True`；
- `pnpm-lock.yaml` 不存在；
- 目标完成，无需再做代码修改。

---

## Definition of Done

- [ ] 当前功能改动被拆成可独立回滚、可独立审查的提交。
- [ ] `npm run check` 退出 0，lint 零 warning。
- [ ] `package-lock.json` 是唯一锁文件。
- [ ] 根 `git status --short` 无输出。
- [ ] 嵌套脏仓库和两张本地图片完整保留。
- [ ] 未触发真实付费图片/视频生成。
- [ ] 独立最终审查为 `Ready to merge: Yes`。
