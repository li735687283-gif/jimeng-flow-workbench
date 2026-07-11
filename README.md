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
| `npm run lint` | 使用 Oxlint 检查 `apps/`、`packages/` 与 `scripts/` |
| `npm test` | 先验证跨平台测试发现 runner，再依次运行全部 Server 与 Web 测试 |
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
