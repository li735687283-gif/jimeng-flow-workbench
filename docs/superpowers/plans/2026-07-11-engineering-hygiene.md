# 工程入口与文档收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 明确 npm 为唯一包管理器，为 monorepo 建立可发现的根级开发、构建、类型检查、lint 和全仓测试入口，并把根 README 设为当前运行事实的唯一文档入口。

**Architecture:** 根 `package.json` 负责跨 workspace 编排和工具版本契约，各 workspace 只负责自己的类型检查；跨平台 Node runner 从仓库根递归枚举测试并把排序后的绝对路径显式交给 Node test runner，因为现有测试以仓库根为相对路径基准。根 `README.md` 记录当前命令、端口和本机安全边界，旧 PRD、M0 spec、路线图和实施计划只保留为带状态标识的历史快照。

**Tech Stack:** npm workspaces、Node.js test runner、tsx、TypeScript 5.7/6.0、Oxlint、Vite 8、Markdown

## Global Constraints

- [ ] npm 是唯一支持的包管理器，`package-lock.json` 是唯一锁文件；固定 `packageManager` 为 `npm@11.13.0`。
- [ ] Node 版本约束必须与 Vite 8 和 Oxlint 一致：`^20.19.0 || >=22.12.0`。
- [ ] 不升级现有业务依赖，不运行 `npm audit fix`，不新增 CI、发布或部署能力。
- [ ] 不修改用户当前尚未提交的 6 个前端文件：`apps/web/src/App.css`、`apps/web/src/components/VideoPlayerModal.tsx`、`apps/web/src/nodes/ImageNode.tsx`、`apps/web/src/nodes/VideoNode.tsx`、`apps/web/src/nodes/registry.ts`、`apps/web/src/state/flowStore.ts`。
- [ ] 不删除、跳过、重命名或收窄现有测试来制造绿色；根测试入口必须覆盖 `apps/server/test` 和 `apps/web/test` 的全部 73 个 `*.test.ts` / `*.test.tsx` 文件。
- [ ] 当前基线必须如实保留：Server 78/78 通过；全仓 239 项中 227 通过、12 个前端测试失败；Web 类型检查存在既有错误。脚本正确性的标准是执行正确范围并保留真实退出码，不是掩盖既有前端债务。
- [ ] 不把历史 RED/GREEN 命令结果改写成当前 runbook；根 `README.md` 是当前运行入口，旧文档只增加明确的历史状态和指针。

---

### Task 1: 固定 npm 契约并建立根级工程脚本

**Files:**

- Modify: `package.json`
- Create: `scripts/run-tests.mjs`
- Create: `scripts/run-tests.test.mjs`
- Modify: `package-lock.json`
- Modify: `apps/server/package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/tsconfig.json`

**Interfaces:**

- Produces: 根命令 `npm run dev|build|typecheck|lint|test|test:server|test:web|check`
- Produces: workspace 命令 `npm run typecheck --workspace <workspace>`
- Produces: `scripts/run-tests.mjs` 支持 `server` / `web` scope，递归发现并排序 `*.test.ts` / `*.test.tsx`，未知 scope 或空集合明确失败
- Consumes: Node 20.19 已支持的 `fs`、`child_process.spawn`、`node:test` 和 `--import` 能力；不依赖 Node test runner 的 quoted-glob 展开能力

- [ ] **Step 1: 写入根包管理器、版本和脚本契约**

把根 `package.json` 更新为：

```json
{
  "name": "jimeng-flow-workbench",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "npm@11.13.0",
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspace apps/web",
    "check": "npm run typecheck && npm run lint && npm test && npm run build",
    "dev": "concurrently -n web,server -c green,blue \"npm:dev:web\" \"npm:dev:server\"",
    "dev:web": "npm --workspace apps/web run dev",
    "dev:server": "npm --workspace apps/server run dev",
    "lint": "oxlint apps packages scripts",
    "test": "node --test scripts/run-tests.test.mjs && npm run test:server && npm run test:web",
    "test:server": "node scripts/run-tests.mjs server",
    "test:web": "node scripts/run-tests.mjs web",
    "typecheck": "npm run typecheck --workspaces",
    "typecheck:server": "npm run typecheck --workspace apps/server",
    "typecheck:web": "npm run typecheck --workspace apps/web"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "oxlint": "^1.71.0",
    "tsx": "^4.19.2"
  }
}
```

根脚本不能依赖 quoted glob：Node 20.19 不会替 npm 脚本展开这些参数。`scripts/run-tests.mjs` 必须从仓库根递归枚举并排序测试文件，把显式绝对路径传给 `process.execPath --import tsx --test`，保持仓库根 cwd 并原样传播子进程退出码；测试不能下沉到 workspace，因为部分测试读取 `apps/...` 根相对路径。

- [ ] **Step 2: 为三个 workspace 增加明确的依赖和类型检查入口**

在 `apps/server/package.json` 的 `scripts` 中加入：

```json
"typecheck": "tsc -p tsconfig.json --noEmit --pretty false"
```

并在 `dependencies` 中加入：

```json
"@jimeng-flow/shared": "0.0.0"
```

在 `apps/web/package.json` 中把开发脚本收敛为 Vite 配置单一来源，并加入类型检查：

```json
"dev": "vite",
"typecheck": "tsc -p tsconfig.app.json --noEmit --pretty false && tsc -p tsconfig.node.json --noEmit --pretty false"
```

同时在 `dependencies` 中加入：

```json
"@jimeng-flow/shared": "0.0.0"
```

把 `packages/shared/package.json` 更新为包含：

```json
"scripts": {
  "typecheck": "tsc -p tsconfig.json --noEmit --composite false --incremental false --pretty false"
},
"devDependencies": {
  "typescript": "~5.7.2"
}
```

`packages/shared/tsconfig.json` 在 `compilerOptions` 中加入：

```json
"rootDir": "./src"
```

该字段消除 package self-subpath export 导致的 `TS2209` 根目录歧义；不改变当前源码和运行时导出；未来启用 emit 时 dist 布局从 `dist/src/*` 变为 `dist/*`。

- [ ] **Step 3: 用指定 npm 更新锁文件**

Run:

```powershell
npm install --package-lock-only
npm install
```

Expected: 两条命令退出 0；`package-lock.json` 只同步根工具声明、workspace 依赖关系、Node engine 和 shared TypeScript，不升级现有解析版本。

- [ ] **Step 4: 验证绿色子入口**

Run:

```powershell
npm run typecheck:server
npm run typecheck --workspace packages/shared
npm run lint
node --test scripts/run-tests.test.mjs
npm run test:server
```

Expected: 五条命令退出 0；runner 单测通过，Server 测试为 78/78。Lint 可以报告当前 warning，但不得出现 error 或非零退出。

- [ ] **Step 5: 验证全仓入口没有掩盖既有失败**

Run:

```powershell
npm run typecheck:web
npm run test:web
npm run typecheck
npm test
npm run check
```

Expected: 命令保持真实非零退出。`test:web` 必须发现全部 161 项 Web 测试并报告既有 12 项失败；`npm test` 必须先通过 runner 单测和 Server 78 项，再进入 Web 测试并报告同一失败集合。`typecheck:web` 必须报告当前 Web 源码错误，不能因配置或脚本范围变窄而退出 0。

- [ ] **Step 6: 验证干净安装可复现且不改锁文件**

Run:

```powershell
$lockHashBefore = (Get-FileHash -LiteralPath package-lock.json -Algorithm SHA256).Hash
npm ci
$lockHashAfter = (Get-FileHash -LiteralPath package-lock.json -Algorithm SHA256).Hash
if ($lockHashBefore -ne $lockHashAfter) {
  throw 'npm ci changed package-lock.json'
}
```

Expected: `npm ci` 退出 0；安装前后的 `package-lock.json` SHA-256 完全相同。

- [ ] **Step 7: 提交 Task 1**

Run:

```powershell
git add package.json scripts/run-tests.mjs scripts/run-tests.test.mjs package-lock.json apps/server/package.json apps/web/package.json packages/shared/package.json packages/shared/tsconfig.json
git diff --cached --check
git diff --cached --name-only
git commit -m "chore: standardize npm engineering scripts"
```

Expected: 缓存只包含上述 8 个文件。

---

### Task 2: 建立当前文档入口并标记历史快照

**Files:**

- Create: `README.md`
- Modify: `AGENTS.md`
- Modify: `apps/web/README.md`
- Modify: `docs/agent-roadmap.md`
- Modify: `docs/superpowers/specs/2026-07-11-local-browser-security-boundary-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-local-browser-security-boundary.md`
- Modify: `outputs/jimeng-flow-workbench-prd.md`
- Modify: `.trae/specs/jimeng-flow-workbench-m0/spec.md`
- Modify: `.trae/specs/jimeng-flow-workbench-m0/tasks.md`
- Modify: `.trae/specs/jimeng-flow-workbench-m0/checklist.md`

**Interfaces:**

- Produces: `README.md` 作为当前安装、端口、目录和工程命令的唯一入口
- Preserves: 历史 PRD/spec/plan 的原始正文，不把旧测试结果改成当前结果

- [ ] **Step 1: 创建根 README**

创建 `README.md`：

````markdown
# 即梦 Flow 工作台

即梦 Flow 是一个运行在本机浏览器中的 React Flow 图像/视频创作工作台。前端、Fastify 后端和共享类型都在同一个 npm workspace 中。

## 环境要求

- Node.js `^20.19.0 || >=22.12.0`
- npm `11.13.0`

本仓库只支持 npm，`package-lock.json` 是唯一锁文件。不要使用 pnpm、Yarn 或 Bun 生成第二套锁文件。

## 安装与启动

在仓库根目录执行：

```powershell
npm ci
npm run dev
```

| 服务 | 地址 |
| --- | --- |
| Web 工作台 | `http://127.0.0.1:5174` |
| Server 健康检查 | `http://127.0.0.1:8787/api/health` |

前后端都只监听 IPv4 回环地址。未知网页 Origin 和 `cross-site` 请求会被后端拒绝；本项目不支持手机或其他局域网设备访问。

## 工程命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时启动 Web 和 Server |
| `npm run dev:web` | 只启动 Vite Web |
| `npm run dev:server` | 只启动 Fastify Server |
| `npm run build` | 类型检查并构建 Web 生产包 |
| `npm run typecheck` | 检查全部 workspace 的 TypeScript |
| `npm run typecheck:server` | 只检查 Server TypeScript |
| `npm run typecheck:web` | 只检查 Web TypeScript |
| `npm run lint` | 使用 Oxlint 检查 `apps/` 与 `packages/` |
| `npm test` | 依次运行全部 Server 与 Web 测试 |
| `npm run test:server` | 只运行 Server 测试 |
| `npm run test:web` | 只运行 Web 测试 |
| `npm run check` | 依次运行类型检查、lint、测试和构建 |

质量命令的退出码和终端输出是当前状态的唯一依据；文档不固化容易过期的通过数量。

## 目录

```text
apps/web/         React + Vite 前端
apps/server/      Fastify 本地后端
packages/shared/  前后端共享类型与生成逻辑
workspace/        本地配置、工作流和生成资产（Git 忽略）
```

本地设置通过工作台写入 `workspace/config/settings.json`。`workspace/`、密钥和生成资产都不应提交到 Git。

## 文档

- `AGENTS.md`：项目协作硬规则。
- `docs/agent-roadmap.md`：历史 Agent 规划快照。
- `docs/superpowers/`、`.trae/specs/`：设计与实施过程快照。
- `outputs/jimeng-flow-workbench-prd.md`：v0.1 历史产品定义。

历史 PRD、spec、plan 和 checklist 不是当前运行手册；安装、端口和工程命令以本 README 与源码为准。
````

- [ ] **Step 2: 收敛子包 README 与 Agent 规则**

把 `apps/web/README.md` 替换为：

```markdown
# @jimeng-flow/web

即梦 Flow 的 React + Vite 前端 workspace。

安装、启动、构建、类型检查和测试统一从仓库根目录运行，不在该目录单独维护依赖或锁文件。

当前命令、端口和本机访问边界见 [`../../README.md`](../../README.md)。
```

在 `AGENTS.md` 的 UI 图标规则前增加：

```markdown
## 工程入口

- 仅使用 npm；`package-lock.json` 是唯一锁文件，不生成或提交 pnpm、Yarn、Bun 锁文件。
- 安装、启动、构建、检查和测试统一从仓库根目录运行。
- 当前命令、端口和目录说明以根 `README.md` 为准。
```

不得加入本次提交叙事。

- [ ] **Step 3: 给历史文档增加状态，不重写历史正文**

在下列文档标题下加入一段短状态：

- `docs/agent-roadmap.md`：`历史规划快照（2026-07-05），不作为当前能力清单。`
- 安全 design：把 `状态：已批准` 改为 `状态：已实现`，并保留日期。
- 安全 plan：`已完成的历史实施计划；其中 RED/GREEN 基线和命令输出只描述当时状态，当前命令见根 README。`
- PRD：`v0.1 历史产品定义，不作为当前端口、API 或能力清单；当前运行方式见根 README。`
- 三个 `.trae` M0 文档：`历史 M0 规格/任务/验收快照；当前运行方式和端口见根 README。`

除安全 design 的状态字段外，不逐条篡改旧端口、旧失败数量或旧 checklist；历史资料必须保持可追溯。

- [ ] **Step 4: 文档机械自检**

Run:

```powershell
rg -n --hidden -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!.superpowers/**' -e 'npm ci' -e 'npm run dev' -e '127\.0\.0\.1:5174' -e '127\.0\.0\.1:8787'
rg -n --hidden -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!.superpowers/**' -e '历史.*快照' -e '状态：已实现'
rg -n -e 'pnpm' -e 'yarn' README.md AGENTS.md apps/web/README.md
```

Expected: 根 README 包含唯一当前安装/启动说明和两个回环地址；历史文档均有状态；当前入口没有建议使用 pnpm/yarn。

- [ ] **Step 5: 验证文档中的根命令真实存在**

Run:

```powershell
npm run
npm run typecheck:server
npm run test:server
```

Expected: `npm run` 列出 README 表中的全部根命令；后两条退出 0，Server 为 78/78。

- [ ] **Step 6: 提交 Task 2**

Run:

```powershell
git add README.md AGENTS.md apps/web/README.md docs/agent-roadmap.md docs/superpowers/specs/2026-07-11-local-browser-security-boundary-design.md docs/superpowers/plans/2026-07-11-local-browser-security-boundary.md outputs/jimeng-flow-workbench-prd.md .trae/specs/jimeng-flow-workbench-m0/spec.md .trae/specs/jimeng-flow-workbench-m0/tasks.md .trae/specs/jimeng-flow-workbench-m0/checklist.md
git diff --cached --check
git diff --cached --name-only
git commit -m "docs: establish canonical project runbook"
```

Expected: 缓存只包含上述 10 个文件。

---

## Final Verification

- [ ] `npm ci` 退出 0，且安装后 manifest/lockfile 无新增漂移。
- [ ] `npm run lint` 退出 0；现有 warning 如实显示。
- [ ] `npm run typecheck:server` 与 shared typecheck 退出 0。
- [ ] `node --test scripts/run-tests.test.mjs` 退出 0，且验证 package scripts、递归过滤、排序、未知 scope 和空集合失败。
- [ ] `npm run test:server` 为 78/78。
- [ ] `npm run test:web` 与 `npm run typecheck:web` 仍以已记录的既有前端问题非零退出，失败范围没有增加。
- [ ] `npm test` 先运行 runner 单测，再覆盖 Server 与 Web，而不是只跑绿色子集。
- [ ] `README.md` 中的 npm 命令、端口、目录和安全说明都能在 manifest/代码中找到对应事实。
- [ ] `git diff --check` 无输出；实现工作树干净。
- [ ] 与 `f344d0e` 比较，改动不包含 6 个用户前端文件。
- [ ] 独立任务审查与全分支审查无 Critical/Important 后才允许快进合并。
