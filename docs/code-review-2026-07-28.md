# MO.K / 墨K画布 代码审查报告（2026-07-28）

> 审查方式：只读静态追踪 + 全量验证命令，未修改任何代码、未提交 Git。
> 真相源：当前源码与测试（commit `1bbcb28`，工作区干净，无未提交改动）。

# 审查结论

这是一份工程质量明显高于平均水平的本地优先应用：loopback 绑定、反 DNS rebinding、路径穿越防护、Electron 安全三件套、保存/加载竞态守卫都有实现且有测试；typecheck、lint（0 错误）、全部测试、生产构建均通过，工作区无未提交改动。

最大风险区域集中在两处：

1. **生成链路刷新恢复**：视频生成进行中刷新页面会让节点永久卡死（无法再发送），图片/视频恢复订阅结束后内存状态残留 running——「长任务不阻塞、刷新可恢复」这条项目核心规则在视频链路上是破的。
2. **Agent 链路缺项目守卫**：Agent 发起的 SSE 订阅和对话循环不校验当前项目，切项目后结果节点和回复会写进另一个项目——直接违反「Agent 会话按项目隔离」的硬规则。

**建议**：可以进入日常使用，但建议先修 P1 三项（都是小改动），再正式依赖「刷新恢复」和「多项目并行」这两个场景。

# Findings

## [P1] 视频生成进行中刷新页面后，节点永久卡死且无法再发送

- 位置：`apps/web/src/nodes/VideoNode.tsx:579-667`（handleSend）、`apps/web/src/nodes/VideoNode.tsx:397-409`（resume effect 前置条件）、`apps/web/src/utils/videoGenerationState.ts:62`
- 置信度：高（已逐行复核）
- 问题：`handleSend` 在 `createGeneration` 之前 `saveCurrent()`（:651），此时 `buildVideoRunningNodePatch` 显式写入 `generationId: undefined`（videoGenerationState.ts:62）；拿到任务 id 后 `applyProgress`（:486-498）只更新内存 store，从不再次持久化。专为此时设计的 `persistInitialVideoGenerationResponse`（videoGenerationState.ts:83）在生产代码中**零调用**（仅测试引用）。
- 触发条件：视频生成进行中刷新页面或关闭重开。
- 影响：flow 文件里节点是 `status:'running'` 且无 `generationId` → resume effect 在 `VideoNode.tsx:398` 直接 return；节点又没有 ImageNode 那样的中断恢复守卫 → `running` 恒真，`handleSend` 第一行 `if (running) return`（:580）永久拦截，遮罩常显，用户只能删节点。
- 证据：上述代码链 + 全仓 grep 确认 `persistInitialVideoGenerationResponse` 无生产调用方。
- 修复方向：`handleGenerationResponse` 的 queued/running 分支改用 `persistInitialVideoGenerationResponse` 持久化 generationId；并给 VideoNode 加与 `isInterruptedImageGeneration` 对称的「running 且无 generationId → 标 error」守卫。
- 建议测试：模拟「saveCurrent 后、SSE 订阅前刷新」，断言节点被标为 error 且可重新发送。

## [P1] 刷新恢复的任务完成后 generateStore 残留 running，视频/图片节点状态卡死

- 位置：`apps/web/src/utils/generationResume.ts:25-57`
- 置信度：高（已复核全文）
- 问题：恢复订阅期间收到任何非终态 SSE（首次 running 推送即触发）都会经 `patchProgress` 把 running 写进 generateStore（:32-36）；终态到达时 `handleTerminal` 只 `loadFlow` 刷新画布，**从不 patch/清理 generateStore**。generateStore 按 nodeId 全局存活、loadFlow 不清它。
- 触发条件：任务进行中刷新页面，且刷新时任务尚未结束。
- 影响：generateStore 永远停在 running → VideoNode `displayStatus` 优先取 store（VideoNode.tsx:369-373）恒为 running（叠加 P1-1 卡死）；ImageNode 进度遮罩常显。
- 证据：generationResume.ts 全文无对 generateStore 的终态写入；与 P1-1 的 nodeData 路径互相印证。
- 修复方向：`handleTerminal` 里用终态数据 patch generateStore 或 `reset(nodeId)`。
- 建议测试：resume 场景 SSE 依次推 running→success，断言 canvasStore、generateStore、节点显示状态三者均为 success。

## [P1] Agent 生成结果在切换项目后写入错误项目画布（跨项目污染）

- 位置：`apps/web/src/utils/agentTools.ts:249-270`（createAdditionalImageNodes 无 flowId 守卫）、`apps/web/src/utils/agentTools.ts:421、603`（subscribeGeneration 返回的取消函数被丢弃）
- 置信度：高（已复核 createAdditionalImageNodes 无条件 `addNode`）
- 问题：Agent 工具发起的 SSE 订阅没有 owner、没有项目 id 守卫；onComplete 里对「当前打开的画布」无条件建附加图片节点和连线。节点组件自身路径因 nodeId 不存在而天然免疫，唯独 Agent 路径不免疫。
- 触发条件：项目 A 让 Agent 生成多张图，在完成前切到项目 B。
- 影响：A 的生成结果节点被建到 B 画布并随 B 的 auto-save 持久化——正是项目规则明确禁止的跨项目串数据。
- 修复方向：创建订阅时捕获 flowId，每个回调开头比对 `getCurrentFlowId()`；取消函数注册到项目切换清理路径。
- 建议测试：mock subscribeGeneration，onComplete 前 loadFlow(B)，断言 B 的节点数不增加。

## [P2] Agent 对话循环无项目守卫，A 项目的回复追加进 B 项目会话

- 位置：`apps/web/src/components/AgentPanel.tsx:356-409`（runAgentLoop）、`apps/web/src/state/agentStore.ts:191-213`（setActiveProject 强制 `loading:false`）
- 置信度：高
- 问题：runAgentLoop 的异步循环不校验项目归属；setActiveProject 切项目时不终止进行中的 loop 反而重置 loading。会话存储本身按项目隔离（已确认），但进行中的回复会落进切换后的项目并以 B 的 projectId 持久化。
- 触发条件：A 发送消息后、LLM 响应未返回时回首页再打开 B。
- 影响：B 的对话记录被写入无关消息；loading 状态错误使 B 可重复提交，两个 loop 交错写同一会话。
- 修复方向：loop 入口捕获 projectId/conversationId，每轮 await 后比对，不一致则丢弃并中止。
- 建议测试：sendAgentChat 返回 deferred，期间 setActiveProject(B)，resolve 后断言 B 的 messages 为空。

## [P2] Agent 生成的图片节点历史记录（generationRuns）被下一次保存冲掉

- 位置：`apps/web/src/utils/agentTools.ts:439-446`（onComplete 不 append generationRun）、`apps/server/src/services/flows.ts:129-143`（shouldKeepCurrentGeneratedData）
- 置信度：高（已复核 flows.ts 合并逻辑）
- 问题：后端完成任务时已把 generationRuns 写进 flow 文件；但 agent 的 onComplete 只写 assetId 且 updatedAt 更晚，下一次 saveCurrent 合并时 incoming 整体获胜（:138-142 要求 current.updatedAt 严格更大才保留），文件中的历史 run 被丢弃。手动图片路径和视频路径都 append 了 run，唯独 agent 图片路径漏了。
- 触发条件：Agent 出图成功后做任何触发保存的操作。
- 影响：Agent 生成的图片节点历史版本条为空，无法切回旧版本。
- 修复方向：agentTools onComplete 用 `buildImageGenerationRunFromResponse` + `appendImageGenerationRun` 补齐。
- 建议测试：agent 图片 onComplete 后执行 mergeNodesForFlowUpdate，断言 generationRuns 不丢失。

## [P2] ImageNode 恢复订阅与新生成共用同一 ref：旧订阅泄漏 + cleanup 误杀新订阅

- 位置：`apps/web/src/nodes/ImageNode.tsx:256-278`（resume effect cleanup 读 ref 当前值）、`apps/web/src/nodes/ImageNode.tsx:1323`（覆盖 ref 前未取消旧订阅）
- 置信度：高（已复核 :256-278）
- 问题：resume effect 的 cleanup 执行时读 ref 的**当前值**。刷新后恢复订阅生效期间用户再点发送：:1323 覆盖 ref 而未取消恢复订阅（旧 SSE 泄漏）；随后 nodeData 变化触发 effect 重跑，cleanup 调用的已是**新** flow 的 cancel——新订阅被杀，`setIsGenerating(false)` 依赖的回调永不到达。
- 触发条件：页面刷新后节点 running（恢复订阅已建立），用户直接再次点发送。
- 影响：两个后端任务并发扣费；`isGenerating` 永久卡 true，发送按钮永久禁用。
- 修复方向：cleanup 闭包捕获本次订阅函数本身，不经 ref；覆盖 ref 前先调旧值。
- 建议测试：挂载 running 节点后调 handleSend，断言新 flow 的 cancel 未被调用、旧 unsubscribe 被调一次。

## [P2] ImageNode 发送按钮连点 → 同节点重复提交生成

- 位置：`apps/web/src/nodes/ImageNode.tsx:1043-1091`
- 置信度：高（已复核：防重 guard 在 :1044，`setIsGenerating(true)` 在 :1091，位于 `await ensureCurrentFlow()`（:1085）之后）
- 问题：防重入标志在一次网络往返之后才置位，两次快速点击都能通过 guard。
- 影响：同节点两个生成任务、两份计费、结果互相覆盖（叠加上面的 ref 竞态）。VideoNode 在首个 await 前同步 patch queued，无此窗口。
- 修复方向：把 `setIsGenerating(true)`（或 generateStore 置 queued）移到第一个 await 之前。
- 建议测试：mock ensureCurrentFlow 为 deferred，连调两次 handleSend，断言 createGeneration 只调一次。

## [P2] 服务端 flow JSON 读-改-写竞态 + 非原子写

- 位置：`apps/server/src/services/flows.ts:358-383`（updateFlow 无锁 read-merge-write，writeFile 非原子）；同样模式见 `apps/server/src/services/settings.ts:39-44`、`apps/server/src/services/videos.ts:109-112`
- 置信度：中（机制明确，未做并发实测）
- 问题：两个任务同时完成（或任务完成与前端 autosave 交错）时，内部 getFlow 与 writeFile 之间存在丢更新窗口；writeFile 非原子，进程崩溃可产出截断 JSON → 整个工作流报 FLOW_CORRUPT 不可读。现有 merge 逻辑缓解了陈旧 autosave，但挡不住这个交错窗口。
- 修复方向：per-flow 写队列串行化；临时文件 + rename 原子替换。
- 建议测试：并发两个 updateFlow（不同节点补丁）断言两份都在；模拟写中崩溃断言无半截 JSON。

## [P2] Windows 下 Codex `.cmd` 启动器的参数转义可被双引号击穿 → 命令注入

- 位置：`apps/server/src/services/codexImage.ts:271-274`（quoteWindowsCommandArg）、`apps/server/src/services/codexImage.ts:294-321`（defaultRunCommand）；注入面入口 `getCodexExecModel`（:155-175）
- 置信度：高（代码缺陷明确）；实际可触达性低
- 问题：Windows 下 codexPath 为 `.cmd` 时经 `cmd.exe /d /s /c` 启动，`quoteWindowsCommandArg` 把 `"` 转成 `^"`，但 cmd 在双引号内部不识别 caret 转义，`"` 仍闭合引号，后续 `&` 即命令分隔符。`model` 字段由 API 请求体控制（如 `codex:x"&calc&echo "`）。
- 触发条件：win32 + 未找到原生 codex.exe（回退 codex.cmd）+ 本地调用方构造恶意 model。
- 影响：以 server 进程权限执行任意命令。远程恶意网页打不到（localAccess 三关 + 反 DNS rebinding 已确认有效），实际攻击面是本机进程或配合下面的 SVG 问题的同源脚本，故定 P2 而非 P1。
- 修复方向：对 model id 加字符白名单（如 `/^[A-Za-z0-9._:-]+$/`），或 Windows 下解析 codex.exe 真实路径直接 spawn 不经 cmd。
- 建议测试：win32 + command 指向 `.cmd`，断言 `model:'codex:x"&calc&"'` 不执行第二命令。

## [P2] 上传的 SVG 以 `image/svg+xml` 从 API 特权源直出 → 同源脚本执行

- 位置：`apps/server/src/services/assets.ts:46`（放行 svg）、`apps/server/src/routes/assets.ts:511-577`（/file 原样输出）
- 置信度：中（代码路径明确，未实际上传验证）
- 问题：SVG 从 `127.0.0.1:8787`（与返回明文密钥的 `GET /api/settings` 同源）直出，直接导航打开时内嵌 `<script>` 以该源执行。应用内 `<img>` 展示路径安全，风险在直接打开链接。
- 影响：同源脚本可读全部明文 API Key、触发生成任务、借上一条在 Windows 执行命令。
- 修复方向：SVG 响应加 `Content-Security-Policy: script-src 'none'`，并全局加 `X-Content-Type-Options: nosniff`。
- 建议测试：上传含 `<script>` 的 SVG，GET /file 断言带 CSP 头。

## [P2] VideoComposer 使用 5 处原生 `<select>`（硬性规范违反，用户可见）

- 位置：`apps/web/src/components/VideoComposer.tsx:451、466、481、498、522`；挂载点 `apps/web/src/components/inspector/BottomPanel.tsx:14-15`
- 置信度：高（已 grep 复核）
- 问题：规范要求参数菜单复用 SecondaryMenuSelect 深色模板、禁原生 select。选中视频节点底部面板即渲染，原生下拉样式突兀、无 Portal、有 overflow 裁剪风险。
- 修复方向：改为 SecondaryMenuSelect（AgentPanel.tsx:708-794 有现成受控用法）。
- 建议测试：逐个打开 5 个下拉，验证点空白/Escape/选择后关闭与贴底上翻。

## [P2] 画布 ContextMenu / AddNodeMenu / ReferenceNodeMenu 不支持 Escape 关闭、无贴底上翻限高

- 位置：`apps/web/src/components/menus/ContextMenu.tsx:33-43`、`apps/web/src/components/menus/AddNodeMenu.tsx:23-31`、`apps/web/src/components/menus/ReferenceNodeMenu.tsx:26-39`
- 置信度：高（grep 确认三个菜单无 keydown/Escape 处理，定位直接用右键坐标无碰撞检测；ViewportMenuPortal 具备这些能力但未被使用）
- 影响：按 Escape 无反应；在画布底部/右缘右键时菜单超出视口。
- 修复方向：复用 ViewportMenuPortal（已具备 Escape、外部点击、getFloatingMenuPlacement 上翻限高），把右键坐标包装成虚拟 anchor。
- 建议测试：画布四边缘右键验证菜单完整可见；Escape 关闭三类菜单。

## [P2] SSE 断线兜底不一致：图片轮询仅 3 分钟，视频/Agent 完全无兜底

- 位置：`apps/web/src/utils/imageGenerationFlow.ts:43-44`（90×2s）、`apps/web/src/nodes/VideoNode.tsx:566-575`、`apps/web/src/utils/agentTools.ts:461-469`
- 置信度：中
- 问题：dreamina 图片超时最长 30 分钟（`apps/server/src/services/jimeng/index.ts:33`），弱网 SSE 断线后图片链路 3 分钟就误判失败；视频和 Agent 路径 SSE 一断直接标 error，而后端任务仍在跑并写回 flow，内存状态与磁盘不一致。
- 修复方向：三条链路统一「SSE 断开 → 状态接口轮询兜底」，时长对齐供应商超时。
- 建议测试：mock SSE 断开 + 任务 5 分钟后完成，断言节点最终恢复为 success。

## [P3] `GET /api/settings` 返回全部明文 API Key

- 位置：`apps/server/src/routes/settings.ts:15-18`
- 置信度：高。本地工具场景可接受，但它是上述两个安全问题的「战利品放大器」。
- 修复方向：GET 脱敏（返回 `hasApiKey` + 掩码），仅 PUT 接受新值。

## [P3] 新建/打开项目失败零反馈；断网错误展示英文 "Failed to fetch"

- 位置：`apps/web/src/App.tsx:293-312`（catch 仅 console.error）、`apps/web/src/components/VideoComposer.tsx:348-355`
- 置信度：高。用户视角是「按钮没反应」或看不懂的英文。
- 修复方向：加用户可见中文提示；展示前把 `Failed to fetch` 映射为「无法连接服务，请确认后端已启动」。

## [P3] 其他低影响确认项（合并列出）

- Agent 输入草稿未按项目隔离，切项目即丢（`apps/web/src/components/AgentPanel.tsx:114`，draft 为组件本地 state）。
- 临时文件不清理：dreamina 每次 `mkdtemp`（`apps/server/src/services/jimeng/index.ts:486`）、codex 的 `.codex-image-*` 目录（`apps/server/src/services/codexImage.ts:959`），长期运行磁盘膨胀。
- `POST /api/generations` bodyLimit 4MB（`apps/server/src/routes/generations.ts:50`）：两张 3MB PNG 的 base64 参考图即 413。
- 复制粘贴节点携带 `generationId`/`status`（`apps/web/src/state/canvasStore.ts:95-111`）：粘贴 running 节点会让副本订阅同一任务。
- ImageNode 编辑器 prompt/画质等本地 useState 在 nodeData 被服务端刷新后不回填（`apps/web/src/nodes/ImageNode.tsx:302-323`，VideoNode 有同步 effect 而 ImageNode 只对 model 有）。
- `apps/web/src/components/TextComposer.tsx` 全仓无 import（含 :252 原生 select），属死代码，建议删除。
- `/api/settings/test-jimeng` 可用请求体路径执行任意本地二进制的 `version`（`apps/server/src/routes/settings.ts:86-94`，execFile 无注入，属能力过大的纵深防御问题）。
- 上传未检查 `data.file.truncated`（`apps/server/src/routes/assets.ts:173-177`）：超 500MB 文件被静默截断保存。

# 验证结果

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run typecheck` | 0 | 四个 workspace 全部通过，无错误 |
| `npm run lint` | 0 | 0 错误，12 警告（含 ImageNode.tsx:731 缺失依赖警告——已复核为**误报**，函数体只读 `selectedModel.id` 且 `selectedModel?.id` 已在依赖数组中） |
| `npm test` | 0 | 全部通过：所见统计 364 pass / 0 fail（一组）+ desktop 21/21；命令为 `&&` 链，最终步骤跑完即全链路成功 |
| `npm run build` | 0 | 构建成功，仅有 chunk >500kB 体积提示 |
| `git status --porcelain` | 0 | 干净，无未提交改动，全部 Findings 均为仓库原有代码 |

静态追踪之外的运行时确认未做（未启动真实生成任务），标「中」置信度的条目即因此保留。

# 测试缺口

- `generationResume.ts` 零测试——P1-1/P1-2 的回归保护完全缺失。
- 无 VideoNode 中断恢复测试（ImageNode 的 `isInterruptedImageGeneration` 有测试，视频侧没有对称覆盖）。
- agentTools SSE 回调的项目守卫无测试（现有测试只用源码正则断言了通知守卫）。
- 无 `updateFlow` 并发/原子性测试（`flowMerge.test.ts` 只测合并纯函数）。
- 无 handleSend 连点防重、恢复订阅期间再发送的时序测试。
- 无 VideoComposer 菜单规范回归测试（规范要求新增菜单补测试，这里原生 select 一直存在说明缺口长期存在）。

# 架构与质量建议

1. **统一「任务订阅生命周期」模块（高优先级，中成本）**：当前 ImageNode、VideoNode、agentTools、generationResume 四处各自管理 SSE 订阅/取消/ref，P1-2、P2-6、P2-7 三个 Bug 同源于此。抽一个带 owner（nodeId+flowId）的订阅管理器，收益是一次修掉一类 Bug，成本是动四条链路的核心交互，需配足测试。
2. **Agent 工具调用统一加项目守卫（高优先级，低成本）**：在 agentTools 的订阅创建和 runAgentLoop 入口各加一个 flowId 比对，几十行改动消除 P1-3、P2-4 两个跨项目污染路径。
3. **服务端持久化写路径加 per-file 串行队列 + 原子写（中优先级，低成本）**：flows/settings/videos 三处共用一个 writeJsonAtomic 工具即可，消除截断 JSON 丢整个项目的尾部风险。
4. **菜单规范补 lint/测试兜底（中优先级，低成本）**：VideoComposer 原生 select 说明规范只靠文档约束不住；加一条 oxlint 自定义规则或一个「apps/web/src 禁止 `<select`」的脚本测试，比逐个改菜单更防回归。
5. **GET /api/settings 脱敏（低优先级，低成本）**：把明文密钥回显改为掩码 + hasApiKey，收窄 SVG/XSS 类问题的爆炸半径；需同步改 SettingsModal 表单为占位符模式，有一定前端成本。

# 未确认事项

- 三条标「中」置信度的运行时行为（SVG 脚本执行、updateFlow 并发丢数据、SSE 兜底时长不足）只做了代码级追踪，未起真实服务复现。
- 即梦/Codex/OpenAI 供应商的真实调用路径未验证（无凭证、不联网）；「模型 id 未登记时跨供应商静默回退」只确认到代码分支存在，未确认正常 UI 流程是否可达。
- Electron 打包后 server 生命周期（`apps/desktop/src/localServer.ts`）有测试覆盖且通过，但未在真实安装包环境验证。
- Windows cmd 注入的实际命令行解析行为未在 win32 上实测（仅做转义逻辑推演，未做攻击实验）。
