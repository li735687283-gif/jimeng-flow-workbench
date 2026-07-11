# Tasks

> 历史 M0 任务快照；当前运行方式和端口见根 README。

- [x] Task 1: 搭建项目骨架
  - [x] SubTask 1.1: 创建 monorepo 结构（apps/web 前端 + apps/server 后端 + 共享 types 包）
  - [x] SubTask 1.2: 初始化前端（Vite + React + TypeScript + React Flow + Zustand + TanStack Query + lucide-react）
  - [x] SubTask 1.3: 初始化后端（Node.js + Fastify + cors + 静态文件服务）
  - [x] SubTask 1.4: 配置 Vite proxy 把 /api 转发到后端 8787 端口
  - [x] SubTask 1.5: 配置启动脚本（前端 5173、后端 8787，根目录统一启动）
  - [x] SubTask 1.6: 创建 .gitignore（忽略 workspace/、settings.json、node_modules）

- [x] Task 2: 实现配置层
  - [x] SubTask 2.1: 定义 Settings 数据模型（参考 PRD 11.3，含 jimengBaseUrl、authMode、apiKey、llmBaseUrl、llmModel、llmApiKey、outputDir、默认图片/视频参数）
  - [x] SubTask 2.2: 实现 settings.json 读写、默认值合并、目录自动创建
  - [x] SubTask 2.3: 实现 GET /api/settings 和 PUT /api/settings 接口
  - [x] SubTask 2.4: 实现最小设置 UI 弹窗（编辑 JimengCli_api 地址、鉴权、LLM provider、输出目录、默认参数）
  - [x] SubTask 2.5: 实现未配置时生成按钮置灰并提示配置入口

- [x] Task 3: 实现工作流持久化
  - [x] SubTask 3.1: 定义 Flow 数据模型（参考 PRD 11.1，含 id、name、nodes、edges、createdAt、updatedAt）
  - [x] SubTask 3.2: 实现 workspace/flows 目录结构和 flow JSON 读写
  - [x] SubTask 3.3: 实现 GET /api/flows、GET /api/flows/:id、POST /api/flows、PUT /api/flows/:id、DELETE /api/flows/:id 接口
  - [x] SubTask 3.4: 前端实现 Zustand store 管理当前 flow 状态
  - [x] SubTask 3.5: 实现前端自动保存（节流，如 1.5s）
  - [x] SubTask 3.6: 实现手动保存按钮和顶部工具栏入口
  - [x] SubTask 3.7: 实现打开历史工作流列表 UI

- [x] Task 4: 实现 React Flow 画布基础
  - [x] SubTask 4.1: 搭建工作台主布局（顶部工具栏：新建/保存/打开/设置/运行状态；左侧节点库；中间画布；右侧参数面板；底部 Composer/Agent 面板区）
  - [x] SubTask 4.2: 实现 React Flow 画布（暗色近黑点阵低对比网格背景、缩放、平移，参考 reference-node-canvas.png）
  - [x] SubTask 4.3: 实现节点通用样式（标题在卡片外侧上方含类型图标和名称、深灰色块主体、8-12px 圆角、轻微悬浮阴影）
  - [x] SubTask 4.4: 实现节点拖拽、连线（柔和贝塞尔曲线、低饱和灰蓝色、输入在左输出在右）、删除
  - [x] SubTask 4.5: 实现自定义 Edge 组件：剪刀断线按钮（透明加粗 hit area + 细贝塞尔可见路径 + EdgeLabelRenderer 渲染 lucide-react Scissors，参考 reference-edge-cut.png）
  - [x] SubTask 4.6: 实现右键画布菜单（上传、添加节点，参考 reference-canvas-context-menu.png）
  - [x] SubTask 4.7: 实现双击画布添加节点菜单（文本、图片、视频、即梦生成、Agent Prompt、备注、上传、从生成历史选择，参考 reference-add-node-menu.png）
  - [x] SubTask 4.8: 实现左侧节点库面板（点击或拖拽创建节点）
  - [x] SubTask 4.9: 实现右侧节点参数面板（点击节点后显示对应参数）

- [x] Task 5: 实现 Text/Prompt 节点
  - [x] SubTask 5.1: 定义 TextNodeData 数据模型（参考 PRD 11.5）
  - [x] SubTask 5.2: 实现文本节点 UI（标题在卡片外上方、内容摘要、quick actions：自己编写内容、图片反推提示词占位，参考 reference-text-node-quick-actions.png）
  - [x] SubTask 5.3: 实现文本 Composer（选中文本节点时底部出现，左侧模型下拉展示模型名/说明/耗时，输入框，提交按钮，参考 reference-text-node-model-menu.png）
  - [x] SubTask 5.4: 后端实现 LLM provider client（OpenAI-compatible Chat Completions 封装，统一 generateAgentReply/text 调用）
  - [x] SubTask 5.5: 实现 POST /api/llm/chat 和 POST /api/text-nodes/:id/run 接口（参考 PRD 10.6 请求/响应示例）
  - [x] SubTask 5.6: 实现返回内容写回文本节点（支持纯文本展示和 JSON 代码块展示，参考 reference-text-node-llm-output.png）
  - [x] SubTask 5.7: 实现返回内容含 action_input/prompt/optimizedPrompt 字段时识别为 Prompt 候选
  - [x] SubTask 5.8: 实现错误状态和重试入口

- [x] Task 6: 实现 Jimeng Image Generate 节点
  - [x] SubTask 6.1: 定义 Generate 节点数据模型
  - [x] SubTask 6.2: 后端实现 JimengCli_api client 封装（图像生成能力，独立 service，前端不直接依赖具体接口字段）
  - [x] SubTask 6.3: 实现 POST /api/generations 接口（接收 flowId、nodeId、mediaType、prompt、inputImages、model、width、height、count、seed，参考 PRD 10.3）
  - [x] SubTask 6.4: 实现 GET /api/generations/:id 和 POST /api/generations/:id/retry 接口
  - [x] SubTask 6.5: 实现 Generate 节点 UI 和参数面板（模型、尺寸、数量、seed、状态、错误信息）
  - [x] SubTask 6.6: 实现生成任务状态管理（idle/queued/running/success/error）和前端取消等待
  - [x] SubTask 6.7: 实现生成成功后图片下载保存到 workspace/outputs/yyyy-mm-dd/
  - [x] SubTask 6.8: 实现图片 metadata JSON 同名保存（Prompt、参数、时间、来源节点）
  - [x] SubTask 6.9: 实现生成成功后自动创建 Image 节点并与 Generate 节点连线

- [x] Task 7: 实现 Image 节点和资产上传
  - [x] SubTask 7.1: 定义 Asset 数据模型（参考 PRD 11.2，含 type、path、prompt、sourceNodeId、inputAssetIds、provider、params）
  - [x] SubTask 7.2: 实现 Image 节点 UI（大面积预览、居中图片占位图标、选中时边框提亮和连接点显示、quick actions：图生图、作为参考图，参考 reference-image-node-quick-actions.png）
  - [x] SubTask 7.3: 实现 POST /api/assets/upload 接口（接收上传文件，复制到 workspace/outputs，生成 Asset metadata）
  - [x] SubTask 7.4: 实现 GET /api/assets/:assetId、GET /api/assets/:assetId/metadata、GET /api/assets/:assetId/file 接口
  - [x] SubTask 7.5: 实现右键上传图片/视频后自动创建对应节点
  - [x] SubTask 7.6: 实现上传后图片在节点中正常预览（通过后端静态文件服务访问）

- [x] Task 8: 实现 Video 节点壳
  - [x] SubTask 8.1: 定义 VideoNodeData 数据模型（参考 PRD 11.6）
  - [x] SubTask 8.2: 实现 Video 节点 UI（大面积预览、居中播放占位图标、quick actions：首尾帧生成视频、首帧生成视频，参考 reference-video-node-quick-actions.png）
  - [x] SubTask 8.3: 实现视频 Composer MVP 控件（模型、模式、Prompt、比例、分辨率、秒数、音频开关、数量、提交，参考 reference-video-composer.png 和 reference-video-*.png 系列）
  - [x] SubTask 8.4: 实现参数到请求数据结构的映射（参考 PRD 10.3 视频生成请求示例，M0 可仅打印日志不真正调用）
  - [x] SubTask 8.5: 实现 Video 节点接收 Text/Prompt 节点和 Image 节点输入

- [x] Task 9: 实现最小 Agent 面板
  - [x] SubTask 9.1: 定义 AgentMessage 数据模型（参考 PRD 11.4）
  - [x] SubTask 9.2: 后端实现 Agent prompt orchestration service（组装节点上下文和系统提示词）
  - [x] SubTask 9.3: 实现 POST /api/agent/prompt-optimize 接口（参考 PRD 8.7、10.5，返回 optimizedPrompt、negativePrompt、suggestedParams、proposedActions）
  - [x] SubTask 9.4: 实现 Agent 面板 UI（对话输入、展示优化 Prompt、负面约束、参数建议、复制按钮、写回 Prompt 节点、显示使用了哪些节点上下文）
  - [x] SubTask 9.5: 实现写回 Prompt 节点动作（写入选中的 Prompt 节点）

- [ ] Task 10: 集成验证
  - [ ] SubTask 10.1: 端到端验证文生图链路（Prompt 节点 → Generate 节点 → Image 节点）
  - [ ] SubTask 10.2: 端到端验证图生图链路（Image 节点 + Prompt 节点 → Generate 节点 → 新 Image 节点）
  - [ ] SubTask 10.3: 端到端验证文本节点 LLM 调用链路（切换模型 → 输入 → 返回写回 → 作为 Generate Prompt）
  - [ ] SubTask 10.4: 端到端验证 Agent Prompt 优化链路（输入想法 → 返回结构化 → 写回节点）
  - [ ] SubTask 10.5: 验证右键上传和双击添加节点
  - [ ] SubTask 10.6: 验证剪刀断线交互
  - [ ] SubTask 10.7: 验证工作流保存和重新打开（含页面刷新后恢复）
  - [ ] SubTask 10.8: 验证 Video 节点壳和参数控件完整性

# Task Dependencies
- Task 1（项目骨架）是所有任务的前置依赖
- Task 2（配置层）依赖 Task 1，是 Task 5（LLM）、Task 6（JimengCli_api）、Task 9（Agent）的前置依赖
- Task 3（工作流持久化）依赖 Task 1
- Task 4（画布基础）依赖 Task 1，是 Task 5、6、7、8、9 节点 UI 实现的前置依赖
- Task 5、6、7、8、9 在 Task 4 完成后可并行开发
- Task 9（Agent）依赖 Task 5 的 LLM provider client
- Task 7（Image 节点和上传）与 Task 6（Generate）有协作关系（生成结果创建 Image 节点）
- Task 10（集成验证）依赖所有功能任务完成
