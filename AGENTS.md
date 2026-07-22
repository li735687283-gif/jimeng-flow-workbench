# 项目协作准则

## 项目定位与真相源

- 这是一个本地优先的 AI 图片、视频创作工作台。前端提供 React Flow 无限画布和 Agent 面板，后端负责项目持久化、素材管理、模型调用和生成任务编排。
- 运行时事实的优先级是：源码与测试 > 各级 `package.json`、TypeScript/Vite 配置 > 根 `README.md` > 历史方案和设计文档。旧 PRD、计划文档不能覆盖当前代码行为。
- 不把项目默认改造成云端服务。涉及公网监听、跨域放开、账号系统、远程数据库或云存储时，必须先明确需求和安全边界。

## 工程入口

- 仅使用 npm；`package-lock.json` 是唯一锁文件，不生成或提交 pnpm、Yarn、Bun 锁文件。
- 安装、启动、构建、检查和测试统一从仓库根目录运行。
- 当前命令、端口和目录说明以根 `README.md` 为准。
- Node.js 使用 `^20.19.0 || >=22.12.0`，npm 使用 11.x；仓库采用 ESM 和 npm workspaces。
- 常用根命令：`npm run dev`、`npm run build`、`npm run typecheck`、`npm run lint`、`npm test`、`npm run check`。
- 本地开发默认地址：Web 为 `http://127.0.0.1:5174`，Server 为 `http://127.0.0.1:8787`；前端通过 `/api` 代理访问后端，不在业务代码中散落服务端绝对地址。

## 技术栈

- Monorepo：npm workspaces，目录为 `apps/*` 与 `packages/*`。
- Web：React 19、TypeScript 6、Vite 8、`@xyflow/react` 12、Zustand 5、lucide-react。
- Server：Node.js、Fastify 5、TypeScript 5.7、tsx；使用 Fastify CORS、multipart、static 插件。
- Shared：源码直出的 TypeScript ESM 包 `@jimeng-flow/shared`，供 Web 与 Server 共享契约。
- 质量工具：Node 内置 test runner + tsx、Oxlint、TypeScript project references、Vite production build。
- 持久化：本地 JSON 与媒体文件；异步生成状态通过 HTTP 查询和 SSE 推送。
- 外部能力：Dreamina/即梦 CLI、Codex CLI，以及 OpenAI 兼容的文本、图片、视频接口。具体可用模型以运行时设置和服务端路由为准。

## 外部 CLI 参考

- 即梦（Dreamina）CLI 体验指南：https://bytedance.larkoffice.com/wiki/FVTwwm0bGiishxkKOoScdHR2nsg 。修复或更新即梦 CLI 相关内容（命令参数、模型版本、resolution_type 等）前，优先核对这份指南；指南与本机行为不一致时，以 `dreamina <子命令> -h` 的实际输出为准。

## 仓库结构与模块边界

### `apps/web`

- `src/components/` 放界面组件；画布专属组件位于 `components/canvas/`，统一菜单组件位于 `components/menus/`。
- `src/nodes/` 放 React Flow 节点及节点注册表。节点只处理展示和交互，不直接读写服务器文件。
- `src/state/` 放 Zustand store。`canvasStore` 负责节点、边、连接和选区；`flowStore` 负责当前项目的加载、保存和与画布同步；其他业务状态继续放在各自 store 中。
- `src/api/` 是浏览器访问 `/api` 的唯一集中入口。组件中不重复拼接请求、轮询或错误解析逻辑。
- `src/utils/` 放可测试的纯逻辑，`src/hooks/` 放 React 生命周期封装。不要把可复用业务判断塞进大型组件。
- 当前应用通过本地 `home | canvas` 状态切换页面，没有 React Router。不要假定路由库或擅自引入一套并行导航状态。
- `App.css` 是现有集中式业务样式，`index.css` 是全局基础和设计令牌。新增样式优先复用现有令牌、组件类和视觉规范，不建立第二套主题系统。

### `apps/server`

- `src/routes/` 只处理 HTTP 边界：参数读取、校验、状态码和响应映射。
- `src/services/` 处理业务、模型供应商、CLI、文件系统与持久化。不要把供应商调用或文件写入堆进 route。
- `src/config/` 管理运行时配置，`src/security/` 管理本地访问和 Origin 校验。安全策略必须集中维护。
- 新增能力时沿用“route -> service -> shared contract”的方向，避免 Web 端绕过 Server 直接调用 CLI、模型供应商或本地文件。

### `packages/shared`

- 跨 Web/Server 使用的请求、响应、设置、项目、素材、节点和 Agent 消息类型放在这里；单端内部类型留在对应 app。
- 该包是 source-first 包。沿用 `@jimeng-flow/shared/...` 子路径导入，不新增编译产物依赖或手工复制类型。
- 修改持久化结构或接口契约时，要同时检查前端调用、后端实现、旧 JSON 兼容和相关测试；需要时增加归一化或迁移，不能让旧项目静默损坏。

### 运行时与文档目录

- `workspace/config/settings.json` 保存本地设置，`workspace/flows/` 保存项目 JSON，`workspace/outputs/` 保存生成素材及元数据。
- `workspace/`、`.env*`、日志、构建产物和依赖目录不提交。真实密钥、访问令牌、用户素材和生成结果不得写入源码、测试快照或日志。
- `scripts/` 放仓库级测试发现器和维护脚本；`docs/` 是说明与历史记录，不是运行时配置源。

## 核心数据流规则

- 画布节点和边通过 `canvasStore` 修改，项目元数据和保存队列通过 `flowStore` 修改。不要在组件里直接突变 React Flow 对象，也不要建立另一份项目真相源。
- 新项目必须初始化为空画布、空 Agent 对话。Agent 会话按项目隔离，不能因 localStorage 或 store 复用而继承上一个项目的历史。
- Agent 模型负责理解任务、组织中文提示词和生成计划；真正出图或出视频由用户选择的图片/视频生成模型完成。两类模型配置不能混为一个字段或在 UI 中互相覆盖。
- 生成流程保持统一：Web 创建任务 -> Server 选择供应商并执行 -> 结果落入素材库并关联项目 -> SSE/状态接口通知 Web -> 节点恢复或展示结果。
- 每个生成任务、每个节点必须拥有独立的任务 ID、订阅、进度和错误状态。批量生成不能共享一个全局订阅或只让第一个节点更新动画。
- 供应商选择集中在 Server 的生成服务和共享设置模型中。React 组件不得按 Dreamina、Codex、OpenAI 等供应商分别复制完整业务流程。
- Kimi API、Kimi Coding Plan 与 DeepSeek 使用各自独立的 Base URL 和 API Key；不得共享字段、互相回退或用一个入口覆盖另一个入口。
- 浏览器 localStorage 只适合视图偏好、最近项目、生成默认值等轻量客户端状态；项目内容、素材和运行时设置以 Server 持久化为准。

## 编码与修改规则

- 保持 ESM；类型导入优先使用 `import type`。遵循所在文件的既有风格，不做与需求无关的格式化或重构。
- 先复用已有 store、API client、service、菜单和节点基础组件。不要因为依赖已经安装就引入新的全局状态层、请求层或 UI 体系。
- 修改只覆盖需求所需范围。因本次改动产生的未使用 import、变量和分支要清理，原有无关代码不顺手改。
- 所有用户可见错误要可操作；服务端保留可诊断上下文，但不得记录密钥、完整授权头或用户私密素材。
- 长耗时模型调用不得阻塞为一次不可恢复的前端请求。保持任务状态查询、SSE 恢复、重试和刷新后继续显示结果的能力。
- 涉及文件路径时使用已解析的 workspace 路径和既有安全工具，禁止接受未经校验的任意绝对路径或目录穿越输入。

## 本地安全边界

- Web 与 Server 默认只监听 IPv4 loopback。允许的浏览器 Origin 限于 `http://127.0.0.1:5174`、`http://localhost:5174` 或无 Origin 的本地调用。
- 不把 CORS 改成任意 Origin，不把 host 改成 `0.0.0.0`，也不绕过 `localAccess`。如需求确实涉及局域网或公网访问，必须单独设计鉴权、CSRF、上传和文件读取边界并补测试。
- 上传沿用 Server 现有 multipart 限制与素材服务；扩大文件数量、体积或类型前，先评估内存、磁盘和解析风险。

## 测试与完成标准

- Bug 修复先补能复现问题的测试，再让测试通过。新功能至少覆盖核心纯逻辑、接口契约或关键交互中的一层。
- 测试文件放在 `apps/server/test/**/*.test.ts(x)` 或 `apps/web/test/**/*.test.ts(x)`，由 `scripts/run-tests.mjs` 排序发现，使用 Node test runner + tsx 执行。
- 小改动先跑相关测试和对应 workspace 的 typecheck；跨包、共享契约或生成链路改动，提交前跑 `npm run check`。
- 纯文档改动至少执行 `git diff --check` 并核对文档中的命令、端口和目录来自当前配置。
- 不用“页面能打开”代替验证。成功标准要对应实际风险，例如刷新后恢复、多个节点并发、旧项目兼容、空白处关闭菜单或拒绝非法 Origin。

## UI 图标规范

- 放大、缩小、全屏预览、展开查看等同类入口统一使用 lucide-react 的 `Maximize2` 风格，也就是两个斜向外扩的箭头。
- 不使用四个斜向外扩箭头的 `Expand` 图标表示放大或全屏，避免同一功能出现两套视觉语言。
- 新增相关按钮时，优先沿用已有按钮尺寸、线宽和 hover 状态，只替换图标，不额外增加装饰。

## UI 菜单规范

- 所有用户可见的二级菜单、下拉菜单和参数选择菜单，必须复用项目统一的深色菜单模板；视觉与交互基准是画布双击后的“添加节点”菜单。
- React 中的单选下拉优先使用 `SecondaryMenuSelect`。不得使用原生 `<select>` 作为用户可见的二级菜单，避免操作系统弹出白色菜单并绕开项目样式。
- 菜单面板与选项必须沿用 `--menu-surface-*`、`--menu-control-*`、`--menu-item-*` 令牌，以及统一的 hover、focus、selected、disabled 状态；不得为单个业务菜单另写颜色、圆角或阴影模板。
- 菜单必须支持点击空白处关闭、按 Escape 关闭、选择后关闭；新增或修改菜单时要补回归测试，防止重新引入原生下拉。
