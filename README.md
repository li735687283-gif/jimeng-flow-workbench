# MO.K / 墨K画布

MO.K 是本地优先的 React Flow 图像/视频创作工作台，可运行在浏览器或 Electron Windows 桌面壳中。React 前端、Fastify 后端、mok CLI 和共享类型位于同一个 npm workspace。

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
| Web 工作台 | `http://127.0.0.1:5174/canvas` |
| Server 健康检查 | `http://127.0.0.1:8787/api/health` |

前后端都只监听 IPv4 回环地址。未知网页 Origin 和 `cross-site` 请求会被后端拒绝；本项目不支持手机或其他局域网设备访问。

## 工程命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时启动 Web 和 Server |
| `npm run dev:web` | 只启动 Vite Web |
| `npm run dev:server` | 只启动 Fastify Server |
| `npm run dev:desktop` | 启动 Vite 和 Electron；桌面主进程按需启动 Server |
| `npm run build` | 类型检查并构建 Web 生产包 |
| `npm run build:desktop` | 构建 Web、Electron 主进程、preload 和生产 Server bundle |
| `npm run package:win` | 生成 NSIS Windows 安装包与自动更新文件 |
| `npm run typecheck` | 检查全部 workspace 的 TypeScript |
| `npm run typecheck:desktop` | 只检查 Desktop TypeScript |
| `npm run typecheck:server` | 只检查 Server TypeScript |
| `npm run typecheck:web` | 只检查 Web TypeScript |
| `npm run lint` | 使用 Oxlint 检查 `apps/`、`packages/` 与 `scripts/` |
| `npm test` | 运行根测试以及全部 Server、Web、Desktop 测试 |
| `npm run test:desktop` | 只运行 Desktop 测试 |
| `npm run test:server` | 只运行 Server 测试 |
| `npm run test:web` | 只运行 Web 测试 |
| `npm run check` | 依次运行类型检查、lint、测试和构建 |

质量命令的退出码和终端输出是当前状态的唯一依据；文档不固化容易过期的通过数量。

## 目录

```text
apps/web/         React + Vite 前端
apps/server/      Fastify 本地后端
apps/desktop/     Electron 主进程、preload、后端生命周期与自动更新
packages/shared/  前后端共享类型与生成逻辑
workspace/        本地配置、工作流和生成资产（Git 忽略）
```

浏览器开发模式继续使用仓库的 `workspace/`。桌面生产版使用 Electron `userData/workspace`，首次运行只在目标目录为空时迁移旧数据。

`workspace/`、密钥和生成资产都不应提交到 Git，也不会作为应用资源写进安装包。

## 文档

- `AGENTS.md`：项目协作硬规则。
- `docs/windows-desktop-release.md`：Windows 构建、版本升级、GitHub Release、自动更新与代码签名。
- `docs/agent-roadmap.md`：历史 Agent 规划快照。
- `docs/superpowers/`、`.trae/specs/`：设计与实施过程快照。
- `outputs/jimeng-flow-workbench-prd.md`：v0.1 历史产品定义。

历史 PRD、spec、plan 和 checklist 不是当前运行手册；安装、端口和工程命令以本 README 与源码为准。
