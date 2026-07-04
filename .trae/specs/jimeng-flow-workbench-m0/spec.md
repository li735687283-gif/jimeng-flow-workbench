# 即梦 Flow 工作台 M0 技术验证 Spec

## Why
PRD 定义了一个完整的本地节点式 AI 图像/视频创作工作台，但完整 MVP 范围过大、风险点较多（JimengCli_api 调用稳定性、中转站 LLM provider 接入、视频参数控件映射、Agent 提示词优化实际效果）。PRD 第 14、18 节明确建议先用 M0 阶段跑通最关键的端到端链路，验证四大风险后再扩展完整 MVP，避免一次性投入导致大返工。本 spec 对应 PRD 的 M0 里程碑。

## What Changes
- 搭建本地前后端项目骨架（前端 Vite + React + React Flow + TypeScript + Zustand + TanStack Query；后端 Node.js + Fastify；monorepo 结构 apps/web + apps/server）
- 实现配置层（settings.json 读写 JimengCli_api base URL、鉴权信息、LLM provider 配置、输出目录、默认参数；最小设置 UI）
- 实现 React Flow 画布基础能力（暗色点阵网格、节点拖拽、连线、缩放、平移、删除）
- 实现剪刀断线交互（悬停/点击连线显示剪刀按钮，点击断开）
- 实现右键画布菜单（上传、添加节点）
- 实现双击画布添加节点菜单（文本、图片、视频、即梦生成、Agent Prompt、备注、上传、从生成历史选择）
- 实现 Text/Prompt 节点（手写内容 + LLM 模型切换 + 调用 LLM 返回内容写回 + 纯文本/JSON 两种展示）
- 实现 Jimeng Image Generate 节点（接收 Prompt + 可选参考图，调用 JimengCli_api 生成图片，自动创建 Image 节点并连线）
- 实现 Image 节点（大面积预览、占位图标、quick actions：图生图、作为参考图）
- 实现 Video 节点壳和最小视频 Composer 参数控件（M0 不要求真正生成视频，仅 UI 和参数映射）
- 实现最小 Agent 面板（Prompt 优化接口，结果可写回 Prompt 节点）
- 实现资产上传（右键上传图片/视频后自动创建对应节点）
- 实现工作流持久化（flow JSON 保存/加载、自动保存）
- 实现图片资产本地保存 + metadata JSON

## Impact
- Affected specs: 无（项目首次立项）
- Affected code: 全新项目，参考 PRD 第 9.2 节模块划分（apps/web/src/{components,state,api} + apps/server/src/{routes,services,config}）

## ADDED Requirements

### Requirement: 本地前后端项目骨架
系统 SHALL 提供 Vite + React + TypeScript 前端，启动后访问 http://localhost:5173；SHALL 提供 Node.js + Fastify 后端，启动后监听 http://localhost:8787；SHALL 通过 Vite proxy 把 /api 前缀请求转发到后端。

#### Scenario: 启动开发环境
- **WHEN** 开发者运行启动命令
- **THEN** 前端和后端分别启动
- **AND** 前端可访问 5173 端口，后端监听 8787 端口
- **AND** 前端通过 /api 前缀能访问后端接口

### Requirement: 配置层
系统 SHALL 提供 settings.json 本地配置文件，保存 JimengCli_api base URL、鉴权信息（API key/cookie/token）、LLM provider 配置（base URL、model、API key）、输出目录、默认模型和尺寸、默认视频参数。配置文件不进入 Git。SHALL 提供最小设置 UI 用于编辑配置。

#### Scenario: 配置读写
- **WHEN** 系统首次启动且无配置文件
- **THEN** 使用默认配置并提示用户先配置 JimengCli_api 和 LLM
- **WHEN** 用户在设置 UI 中保存配置
- **THEN** 配置写入 settings.json 并在下次启动时自动读取
- **WHEN** 未配置 JimengCli_api 地址时点击生成
- **THEN** 生成按钮不可用并提示配置入口

### Requirement: React Flow 画布基础能力
系统 SHALL 提供基于 React Flow 的无限画布，采用暗色近黑色点阵低对比网格背景（参考 reference-node-canvas.png）；SHALL 支持节点拖拽、节点连线（柔和贝塞尔曲线，输入在左、输出在右）、画布缩放、平移、节点删除、右键画布菜单、双击画布添加节点菜单；SHALL 支持节点标题显示在卡片外侧上方（包含类型图标和名称）。

#### Scenario: 节点交互
- **WHEN** 用户拖拽节点
- **THEN** 节点位置更新并触发自动保存
- **WHEN** 用户从节点输出连接点拖线到另一节点输入连接点
- **THEN** 创建一条柔和贝塞尔曲线连线，颜色为低饱和灰蓝色
- **WHEN** 用户右键画布空白区域
- **THEN** 在鼠标位置显示包含"上传"和"添加节点"的菜单（参考 reference-canvas-context-menu.png）
- **WHEN** 用户双击画布空白区域
- **THEN** 在触发位置附近显示添加节点菜单，包含：文本、图片、视频、即梦生成、Agent Prompt、备注、上传、从生成历史选择（参考 reference-add-node-menu.png）
- **WHEN** 菜单中创建新节点
- **THEN** 新节点出现在触发位置附近

### Requirement: 剪刀断线交互
系统 SHALL 使用 React Flow custom edge 实现剪刀断线交互。可见路径为细贝塞尔曲线，另加一条透明加粗路径作为 hover/click 命中热区；SHALL 在鼠标悬停或点击连线时，于连线视觉中点通过 EdgeLabelRenderer 渲染剪刀按钮（使用 lucide-react 的 Scissors 图标）；点击剪刀按钮后删除当前 edge，保留两端节点和内容；鼠标移出连线和剪刀按钮区域后按钮自动消失。

#### Scenario: 断开连线
- **WHEN** 鼠标悬停在连线上或点击选中连线
- **THEN** 连线高亮（参考 reference-edge-cut.png 蓝色高亮段效果）并在中点显示剪刀按钮
- **WHEN** 用户点击剪刀按钮
- **THEN** 调用 `setEdges(edges => edges.filter(edge => edge.id !== currentEdgeId))`，当前连线被删除，两端节点和内容保留
- **WHEN** 鼠标移出连线和剪刀按钮区域
- **THEN** 剪刀按钮自动消失

### Requirement: Text/Prompt 节点
系统 SHALL 提供 Text/Prompt 节点，支持手写文本内容；选中文本节点时底部出现文本 Composer（参考 reference-text-node-model-menu.png、reference-text-node-llm-output.png），Composer 左侧显示 LLM 模型下拉（展示模型名、简短说明和预计耗时），输入框用于输入用户文字需求，提交后调用 LLM 返回内容写入节点；返回内容支持纯文本和 JSON 代码块两种展示；节点 quick actions 保留"自己编写内容"和"图片反推提示词"（后者显示为未来能力）；文本节点输出可连接到 Generate 或 Video 节点。

#### Scenario: 文本节点 LLM 调用
- **WHEN** 用户选中文本节点
- **THEN** 底部出现文本 Composer，左侧显示 LLM 模型下拉
- **WHEN** 用户在模型下拉中切换模型
- **THEN** 当前文本节点的 LLM 配置更新
- **WHEN** 用户输入文字并提交
- **THEN** 后端通过配置的 LLM provider（OpenAI-compatible Chat Completions）调用模型
- **AND** 返回内容写入文本节点
- **AND** 节点显示返回内容摘要，完整内容在详情中查看
- **WHEN** 返回内容为 JSON 且包含 `action_input`、`prompt`、`optimizedPrompt` 等字段
- **THEN** 系统识别为可用于生图的 Prompt 候选
- **WHEN** LLM 调用失败
- **THEN** 节点显示错误状态和可重试入口

### Requirement: Jimeng Image Generate 节点
系统 SHALL 提供 Jimeng Image Generate 节点，接收上游 Prompt 节点输入和可选参考图输入；参数面板包含模型、尺寸、数量、seed、状态、错误信息；点击生成后调用 JimengCli_api 生成图片；生成过程有 loading 状态；生成成功后图片文件保存到本地输出目录（workspace/outputs/yyyy-mm-dd/），图片 metadata JSON 同名保存（包含 Prompt、参数、时间、来源节点）；SHALL 自动创建 Image 节点并与 Generate 节点连线。

#### Scenario: 文生图
- **WHEN** 用户创建 Prompt 节点并输入 Prompt
- **AND** 创建 Generate 节点并将 Prompt 节点连接到 Generate 节点
- **AND** 选择尺寸和数量后点击生成
- **THEN** 后端通过 JimengCli_api client 调用即梦生成图片
- **AND** 生成过程中 Generate 节点显示 loading 状态
- **AND** 生成成功后图片文件保存到本地输出目录，metadata JSON 同名保存
- **AND** 自动创建 Image 节点并与 Generate 节点连线
- **WHEN** JimengCli_api 返回失败
- **THEN** 节点显示原始错误摘要并保留重试按钮

#### Scenario: 图生图
- **WHEN** 用户选择已有 Image 节点作为参考图
- **AND** 创建 Prompt 节点描述修改方向
- **AND** 创建 Generate 节点并将 Image 节点和 Prompt 节点连接到 Generate 节点
- **THEN** Generate 节点识别上游图片输入
- **AND** 参考图路径被正确传给 JimengCli_api

### Requirement: Image 节点
系统 SHALL 提供 Image 节点，主体以大面积图片预览为核心；空图片或加载失败时显示居中图片占位图标；选中时节点边框提亮、左右连接点显示；节点 quick actions 保留"图生图"和"作为参考图"（"图片高清"等显示为未来能力）；SHALL 可作为 Jimeng Generate 节点的输入。

#### Scenario: 图片节点展示
- **WHEN** Image 节点有图片资源
- **THEN** 节点主体显示大面积图片预览
- **WHEN** Image 节点为空或加载失败
- **THEN** 显示居中图片占位图标

### Requirement: Video 节点壳
系统 SHALL 提供 Video 节点壳和最小视频 Composer。Video 节点主体以大面积视频预览为核心，空视频或生成前显示居中播放占位图标；quick actions 保留"首尾帧生成视频"和"首帧生成视频"；视频 Composer MVP 控件包含模型切换（由 JimengCli_api 暴露的视频模型决定）、模式切换（文生视频/图生视频/全能参考/首尾帧/图片参考）、Prompt 输入框、比例切换（Auto/16:9/9:16/4:3/3:4/1:1/21:9）、分辨率切换（480P/720P/1080P/4K，不可用项置灰）、秒数切换（至少 5s）、是否生成音频开关、数量切换（1/2/4）、提交按钮。M0 阶段不要求真正调用视频生成接口，只验证 UI 和参数到请求数据结构的映射。

#### Scenario: 视频节点参数配置
- **WHEN** 用户选中 Video 节点
- **THEN** 显示视频 Composer（参考 reference-video-composer.png 及 reference-video-*.png 系列）
- **WHEN** 用户切换各项参数
- **THEN** 参数更新到 Video 节点数据
- **WHEN** 用户点击提交
- **THEN** 系统组装符合 PRD 10.3 视频生成请求示例的数据结构（M0 可仅打印日志，不真正调用）

### Requirement: 最小 Agent 面板
系统 SHALL 提供最小 Agent 面板，支持用户输入粗略想法；后端 Agent prompt orchestration service 组装系统提示词调用 LLM provider；返回结构化结果，包含 `optimizedPrompt`、`negativePrompt`、`suggestedParams`、`proposedActions` 等字段（参考 PRD 8.7、10.5）；前端展示优化后的 Prompt，支持复制和写回当前 Prompt 节点，支持查看 Agent 使用了哪些节点上下文。Agent 不自动生成图片，必须由用户确认触发；不自动删除或覆盖用户节点。

#### Scenario: Prompt 优化
- **WHEN** 用户在 Agent 面板输入粗略想法
- **THEN** 后端调用 LLM provider 返回结构化优化 Prompt
- **AND** 前端展示优化后的 Prompt、负面约束、参数建议
- **WHEN** 用户点击"写回 Prompt 节点"
- **THEN** 优化后的 Prompt 写回当前选中的 Prompt 节点
- **WHEN** Agent 调用失败
- **THEN** 显示错误状态和重试入口

### Requirement: 资产上传与节点创建
系统 SHALL 支持右键画布点击"上传"打开本地文件选择器，支持图片和视频文件；上传后文件被复制到 workspace/outputs 目录并生成 Asset metadata；SHALL 在上传位置创建对应 Image 或 Video 节点。

#### Scenario: 上传图片创建节点
- **WHEN** 用户右键画布点击"上传"并选择本地图片文件
- **THEN** 文件被复制到 workspace/outputs 目录
- **AND** 生成 Asset metadata（参考 PRD 11.2）
- **AND** 在上传位置创建 Image 节点
- **WHEN** 用户上传视频文件
- **THEN** 创建 Video 节点

### Requirement: 工作流持久化
系统 SHALL 支持保存当前工作流为 flow JSON 文件（参考 PRD 11.1 数据模型），保存到 workspace/flows/flow-id.json；SHALL 支持重新打开历史工作流；SHALL 支持画布变化时自动保存（节流）。

#### Scenario: 保存与加载
- **WHEN** 用户点击保存按钮
- **THEN** 当前画布节点和边保存到 flow JSON 文件
- **WHEN** 用户打开历史工作流
- **THEN** 从 flow JSON 恢复画布状态
- **WHEN** 画布节点或边发生变化时
- **THEN** 系统节流后自动保存
- **WHEN** 页面刷新后重新打开
- **THEN** 自动恢复最近一次工作流

### Requirement: 生成任务状态
系统 SHALL 支持单次生成任务，状态包含 idle、queued、running、success、error；SHALL 支持取消前端等待状态（MVP 不要求真正中断 JimengCli_api 后台任务）；SHALL 支持失败重试；SHALL 支持查看错误详情。

#### Scenario: 任务状态流转
- **WHEN** 用户点击生成
- **THEN** 任务状态从 idle 流转到 queued、running
- **WHEN** 生成成功
- **THEN** 状态变为 success，显示完成状态和缩略图
- **WHEN** 生成失败
- **THEN** 状态变为 error，显示红色状态和错误入口
- **WHEN** 用户点击重试
- **THEN** 任务重新进入 queued 状态

## MODIFIED Requirements
无（项目首次立项）

## REMOVED Requirements
无（项目首次立项）
