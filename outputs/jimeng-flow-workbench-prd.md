# 即梦 Flow 工作台 PRD

版本：v0.1  
日期：2026-07-04  
阶段：MVP 产品定义  
定位：本地个人 AI 图像/视频创作工作台

## 1. 产品一句话

一个基于 React Flow 的本地节点式图像/视频创作工作台，第一版通过 JimengCli_api 调用即梦账号能力完成文生图、图生图、文生视频、图生视频和图片/视频链路编排，同时内置 LLM Agent 帮用户优化改图和视频提示词、整理创作意图，并为后续接入中转站 API、多模型、多媒体工作流留下扩展口。

## 2. 背景与问题

现有即梦 CLI 或 JimengCli_api 更偏命令行/API 工具，适合自动化调用，但不适合可视化创作。创作者更需要一个可以拖拽、连线、复用图片结果的工作台：

- 每张图片都能成为一个节点，方便继续图生图、变体、放大或转视频。
- Prompt、参考图、模型参数和生成结果能留在同一个画布里。
- 本地 API key 和即梦账号能力可以统一管理，不需要每次手动敲命令。
- 后续可以逐步接入中转站、ComfyUI、Seedance、视频生成等更多能力。

第一版不追求全功能，而是先把“React Flow 画布 + JimengCli_api 调用 + 图片/视频结果回写画布”跑通。

## 3. 目标

### 3.1 MVP 目标

- 支持本地启动一个 Web 工作台。
- 支持配置 JimengCli_api 的服务地址和鉴权信息。
- 支持在画布中创建、拖动、连接节点。
- 支持上传本地图片/视频资源，并自动生成对应节点。
- 支持通过右键菜单或双击画布添加文本、图片、视频节点。
- 支持按住左键框选多个节点，并对选中节点执行宫格排列、水平排列、垂直排列。
- 支持从文本节点调用即梦生成图片。
- 支持文本节点连接中转站 LLM API，切换大语言模型并返回文本内容。
- 支持文本节点的 LLM 返回内容作为后续生图 Prompt 输入。
- 支持从已有图片节点继续发起图生图。
- 支持创建视频节点，并通过文本或图片输入生成视频。
- 支持视频生成的模型、比例、分辨率、清晰度、秒数和数量切换。
- 支持配置大语言模型服务，用 Agent 辅助优化文生图和改图提示词。
- 支持 Agent 读取当前节点上下文，并将优化后的 Prompt 写回节点。
- 支持把生成结果保存到本地项目目录，并在画布中可视化展示。
- 支持保存和重新打开一个工作流。

### 3.2 非目标

- 第一版不做云端部署。
- 第一版不做多人协作。
- 第一版不做账号体系。
- 第一版不做在线支付和额度系统。
- 第一版不直接实现即梦逆向逻辑，只调用本地已运行的 JimengCli_api。
- 第一版不做完全自主的长任务 Agent，只做面向提示词优化和节点写回的受控 Agent。
- 第一版不做完整 ComfyUI 兼容，只保留未来适配空间。
- 第一版做最小视频节点和视频生成 Composer；音频节点、视频合成、导演台、素材库和脚本节点只保留为未来扩展方向。
- 第一版不做完整生成 Composer、模型市场、画质比例面板、预设库、摄像机参数、批量张数菜单；这些作为图片节点的后续增强能力。

## 4. 目标用户

### 4.1 主要用户

个人创作者、AI 设计师、短视频创作者、提示词工作流玩家。

### 4.2 核心使用场景

- 用一段 Prompt 批量试图。
- 对满意图片继续图生图。
- 在画布上保存不同创意分支。
- 复盘某张图是由哪个 Prompt、参考图和参数生成的。
- 后续把图片链路接到视频生成或剪辑工作流。

## 5. 第一版产品形态

### 5.1 部署形态

本地网页应用：

- 前端：React + React Flow。
- 后端：Node.js 本地服务。
- 调用层：后端请求本地 JimengCli_api。
- 文件存储：本地工作区目录。
- 配置存储：本地配置文件或轻量数据库。

推荐本地访问地址：

```text
http://localhost:5173
```

推荐后端地址：

```text
http://localhost:8787
```

JimengCli_api 作为独立服务运行，MVP 中只要求用户提供它的本地服务地址。

## 6. 信息架构

### 6.1 主要页面

1. 工作台页面
   - 左侧节点库。
   - 中间无限画布。
   - 右侧节点参数面板。
   - 顶部工具栏。
   - Agent 对话面板。

2. 设置页面/弹窗
   - JimengCli_api 服务地址。
   - LLM 服务地址、模型和 API key。
   - API key 或 cookie/token 配置。
   - 输出目录配置。
   - 默认模型和尺寸配置。

3. 历史记录面板
   - 最近生成图片。
   - 生成状态。
   - 错误记录。

### 6.2 MVP 节点类型

1. Text/Prompt 节点
   - UI 名称：文本节点。
   - 输入：用户手写文本、LLM 对话输入、可选上游文本。
   - 输出：Prompt 数据、LLM 返回文本、可选结构化 JSON。
   - 用途：作为生成节点的文本输入，也可作为 LLM 交互节点。
   - MVP 能力：手写内容、调用中转站 LLM、切换模型、把返回内容写回节点。

2. Image 节点
   - 输入：图片文件或上游生成结果。
   - 输出：图片路径、图片元数据。
   - 用途：展示图片、作为图生图或图生视频参考图。

3. Jimeng Image Generate 节点
   - 输入：Prompt，可选参考图。
   - 输出：生成图片。
   - 参数：模型、尺寸、数量、风格、seed、是否使用参考图。

4. Jimeng Video Generate / Video 节点
   - UI 名称：视频节点。
   - 输入：Prompt，可选首帧图片、可选参考图片。
   - 输出：生成视频、本地视频路径、视频元数据。
   - 用途：完成文生视频、图生视频、首尾帧生成视频。
   - MVP 参数：模型、比例、分辨率、清晰度、秒数、数量、是否生成音频。

5. Note 节点
   - 输入：无。
   - 输出：说明文本。
   - 用途：记录想法、版本、分支说明。

6. Agent Prompt 节点
   - 输入：原始 Prompt、改图意图、可选参考图上下文。
   - 输出：优化后的 Prompt、负面约束、参数建议。
   - 用途：让 LLM Agent 把用户的自然语言改图需求整理成更适合即梦生成的提示词。

MVP 只做这 6 类节点，避免第一版节点体系膨胀。文本节点承担“手写内容 + LLM 文本生成”的基础能力，视频节点承担最小文生视频/图生视频能力，Agent 能力优先服务 Prompt 优化，不扩展成通用自动化平台。

## 7. 核心用户流程

### 7.1 首次配置

1. 用户启动前端和后端。
2. 打开设置弹窗。
3. 输入 JimengCli_api 地址。
4. 输入本地鉴权信息。
5. 点击“测试连接”。
6. 连接成功后进入工作台。

验收标准：

- 未配置时，生成按钮不可用并提示配置入口。
- 配置错误时，显示明确错误原因。
- 配置成功后，能保存到本地并在下次启动自动读取。

### 7.2 文生图

1. 用户创建 Prompt 节点。
2. 输入 Prompt。
3. 创建 Jimeng Generate 节点。
4. 将 Prompt 节点连接到 Generate 节点。
5. 选择尺寸和数量。
6. 点击生成。
7. 后端调用 JimengCli_api。
8. 图片生成完成后自动创建 Image 节点。
9. Image 节点与 Generate 节点连线。

验收标准：

- 生成过程有 loading 状态。
- 生成成功后图片能显示在画布上。
- 图片文件保存到本地输出目录。
- 图片元数据保存 Prompt、参数、时间、来源节点。

### 7.3 图生图

1. 用户选择一个已有 Image 节点。
2. 创建新的 Prompt 节点描述修改方向。
3. 创建 Jimeng Generate 节点。
4. 将 Image 节点和 Prompt 节点连接到 Generate 节点。
5. 点击生成。
6. 生成结果作为新的 Image 节点出现在画布上。

验收标准：

- Generate 节点能识别上游图片输入。
- 参考图路径能被正确传给 JimengCli_api。
- 新图片和原图之间保留连线关系。

### 7.4 Agent 辅助改图

1. 用户选中一张 Image 节点。
2. 用户在 Agent 面板输入自然语言需求，例如“保留人物姿势，把背景改成霓虹雨夜，服装更高级一点”。
3. Agent 读取当前 Image 节点的元数据、上游 Prompt、生成参数和用户的新需求。
4. Agent 输出优化后的改图 Prompt，并说明保留项、修改项和风险点。
5. 用户点击“写回 Prompt 节点”或“创建改图分支”。
6. 系统自动创建 Prompt 节点和 Jimeng Generate 节点，并连到原 Image 节点。
7. 用户确认后点击生成。

验收标准：

- Agent 能读取当前选中节点的上下文。
- Agent 输出的 Prompt 可直接用于 Jimeng Generate 节点。
- Agent 不自动生成图片，必须由用户确认后触发。
- 用户可以选择覆盖当前 Prompt，或创建一个新的改图分支。

### 7.5 Agent 辅助文生图

1. 用户在 Agent 面板输入粗略想法。
2. Agent 追问或直接整理成结构化 Prompt。
3. Agent 给出 2-3 个方向，例如写实、广告海报、电影剧照。
4. 用户选择一个方向。
5. 系统创建 Prompt 节点，并可选创建 Generate 节点。

验收标准：

- Agent 能把口语化需求整理为可执行 Prompt。
- Agent 输出包含主体、场景、风格、镜头、光线、材质、构图和限制。
- 用户能一键把结果放进画布。

### 7.6 文本节点调用大语言模型

1. 用户创建或选中文本节点。
2. 底部出现文本 Composer。
3. 用户在模型下拉中选择中转站提供的大语言模型，例如 GVLM、Qwen VL、其他 OpenAI-compatible 模型。
4. 用户在输入框中写入自然语言需求，例如“一个女孩在风中飞舞”。
5. 点击提交。
6. 后端通过配置好的 LLM base URL 和 API key 调用模型。
7. 模型返回文本内容，写入当前文本节点。
8. 文本节点显示模型返回内容摘要，并保留完整返回内容。
9. 用户可将该文本节点连接到 Jimeng Generate 节点，作为生图 Prompt。

验收标准：

- 用户能在文本节点 Composer 中切换 LLM 模型。
- 用户输入文字后，文本节点能显示 LLM 返回结果。
- LLM 返回内容支持纯文本和结构化 JSON 两种展示。
- 文本节点输出能连接到 Generate 节点。
- LLM 调用失败时，节点显示错误状态和可重试入口。

### 7.7 视频生成

文生视频流程：

1. 用户创建 Text/Prompt 节点。
2. 用户输入视频描述，或通过 LLM 优化成视频 Prompt。
3. 用户创建 Video 节点。
4. 将 Text/Prompt 节点连接到 Video 节点。
5. 用户在视频 Composer 中选择模型、比例、分辨率、清晰度、秒数和数量。
6. 用户点击生成。
7. 后端调用 JimengCli_api 的视频生成能力。
8. 生成完成后，Video 节点显示视频预览并保存本地视频文件。

图生视频流程：

1. 用户选择一个 Image 节点作为首帧或参考图。
2. 用户创建 Text/Prompt 节点描述运动、镜头和变化。
3. 用户创建 Video 节点。
4. 将 Image 节点和 Text/Prompt 节点连接到 Video 节点。
5. 用户在视频 Composer 中选择“图生视频”或“全能参考”等模式。
6. 用户确认模型、比例、分辨率、清晰度、秒数和数量。
7. 点击生成，结果回写到 Video 节点。

验收标准：

- 视频节点能接收文本输入和图片输入。
- 视频生成前必须可切换模型。
- 视频生成前必须可切换比例、分辨率、清晰度和秒数。
- 视频生成前必须可切换数量。
- 视频结果保存到本地，并在 Video 节点中显示可播放预览。
- 生成失败时，Video 节点显示错误状态和可重试入口。

## 8. 功能需求

### 8.1 画布

- 支持节点拖拽。
- 支持节点连线。
- 支持节点删除。
- 支持画布缩放和平移。
- 支持右键画布打开上下文菜单。
- 支持双击画布打开添加节点菜单。
- 支持按住左键拖拽框选多个节点。
- 支持对选中节点执行宫格排列、水平排列、垂直排列。
- 支持上传本地图片或视频资源并创建节点。
- 支持自动保存当前工作流。
- 支持手动保存工作流。
- 支持打开历史工作流。

### 8.2 节点参数面板

- 点击节点后右侧显示参数。
- Text/Prompt 节点显示文本编辑器、LLM 模型、最近一次输入和模型返回内容。
- Image 节点显示图片预览、文件路径、生成参数。
- Image Generate 节点显示模型、尺寸、数量、seed、状态、错误信息。
- Video 节点显示模型、比例、分辨率、清晰度、秒数、数量、是否生成音频、状态、错误信息。

### 8.3 生成任务

- 支持单次生成。
- 支持任务状态：idle、queued、running、success、error。
- 支持取消前端等待状态。
- 支持失败重试。
- 支持查看错误详情。

MVP 暂不要求真正中断 JimengCli_api 后台任务；取消可以只取消前端等待和 UI 状态。

### 8.4 视频生成任务

视频生成是 MVP 必备能力，第一版只做单节点视频生成，不做复杂剪辑。

输入：

- 文本 Prompt。
- 可选 Image 节点作为首帧。
- 可选 Image 节点作为参考图。

参数：

- 模型：至少支持从 JimengCli_api 暴露的视频模型列表中选择。
- 比例：Auto、16:9、9:16、4:3、3:4、1:1、21:9。
- 分辨率/清晰度：480P、720P、1080P、4K；若实际模型不支持某档，前端置灰或后端返回明确错误。
- 秒数：至少支持 5s；后续可扩展 3s、10s、15s 等。
- 数量：1 个、2 个、4 个。
- 生成音频：开启/关闭。

输出：

- 本地视频文件。
- 视频预览节点。
- 视频元数据 JSON。

约束：

- MVP 不做时间线剪辑。
- MVP 不做视频合成节点。
- MVP 不做多段视频拼接。
- MVP 不做自动配乐和音频节点。

### 8.5 本地文件管理

推荐目录结构：

```text
workspace/
  flows/
    flow-id.json
  outputs/
    yyyy-mm-dd/
      image-id.png
      image-id.json
  config/
    settings.json
```

图片和视频旁边保存同名 JSON 元数据。

### 8.6 设置与密钥

- 支持保存 JimengCli_api base URL。
- 支持保存 API key、cookie 或 token 字段。
- 支持保存 LLM provider、base URL、model 和 API key。
- 支持测试连接。
- 支持清空配置。

密钥处理：

- MVP 可先存本地配置文件。
- 配置文件不进入 Git。
- 后续版本改为系统钥匙串或加密存储。

### 8.7 LLM Agent

Agent 是 MVP 的核心创作辅助能力，第一版只开放受控动作。

能力范围：

- 优化文生图 Prompt。
- 优化图生图/改图 Prompt。
- 根据当前图片节点的生成历史整理改图建议。
- 将结果写回 Prompt 节点。
- 创建新的 Prompt + Generate 分支。
- 解释为什么这样改 Prompt。

不做的能力：

- 不自动连续生成多轮图片。
- 不自动删除或覆盖用户节点。
- 不直接访问外部网页。
- 不执行任意本地命令。

Agent 输入上下文：

- 用户当前消息。
- 当前选中节点类型。
- 当前选中 Image 节点的图片元数据。
- 上游 Prompt。
- Generate 节点参数。
- 用户手动选中的参考节点。

Agent 输出结构：

```json
{
  "intent": "edit_image_prompt",
  "optimizedPrompt": "优化后的提示词",
  "negativePrompt": "需要避免的内容",
  "preserve": ["人物姿势", "主体身份"],
  "change": ["背景", "服装", "光线"],
  "suggestedParams": {
    "width": 1024,
    "height": 1024,
    "count": 2
  },
  "actions": [
    {
      "type": "create_prompt_node",
      "label": "创建改图 Prompt"
    }
  ]
}
```

### 8.8 Agent 面板

- 支持对话输入。
- 支持显示 Agent 输出的优化 Prompt。
- 支持复制 Prompt。
- 支持写回当前 Prompt 节点。
- 支持创建新分支。
- 支持查看 Agent 使用了哪些节点上下文。

### 8.9 文本节点 LLM 能力

文本节点既是手写内容节点，也是最小 LLM 调用节点。

MVP 能力：

- 支持手写文本。
- 支持从中转站 LLM API 获取返回文本。
- 支持模型下拉切换。
- 支持显示模型预计耗时或标签。
- 支持将返回内容写入当前文本节点。
- 支持把文本节点输出连到 Image Generate 或 Video 节点。
- 支持复制返回内容。

返回内容展示：

- 短文本直接显示在节点中。
- 长文本在节点中显示摘要，完整内容在节点详情或展开状态显示。
- JSON 内容使用代码块样式展示。
- 如果返回结构中包含 `action_input`、`prompt`、`optimizedPrompt` 等字段，系统可把它识别为可用于生图的 Prompt。

未来能力：

- 一键创建视频生成分支。
- 图片反推提示词。
- 文字生音乐。
- 多轮文本对话记忆。
- 文本节点之间的上下文串联。

## 9. 技术架构

### 9.1 推荐技术栈

前端：

- Vite
- React
- TypeScript
- React Flow
- Zustand
- TanStack Query

后端：

- Node.js
- Fastify 或 Express
- 本地文件系统存储
- JimengCli_api HTTP 调用封装
- LLM provider HTTP 调用封装
- Agent prompt orchestration service

可选桌面壳：

- MVP 暂不做 Electron。
- React + Node 本地服务先跑通。
- 稳定后再包 Electron/Tauri。

### 9.2 模块划分

```text
apps/web
  src/components/canvas
  src/components/nodes
  src/components/sidebar
  src/components/inspector
  src/state
  src/api

apps/server
  src/routes
  src/services/jimeng
  src/services/llm
  src/services/agent
  src/services/storage
  src/services/flows
  src/config
```

### 9.3 数据流

```text
React Flow 节点
  -> 前端提交 generate 请求
  -> 本地 Node 后端
  -> JimengCli_api
  -> 返回图片/视频 URL 或文件
  -> 后端下载/保存图片或视频
  -> 后端保存元数据
  -> 前端创建 Image/Video 节点并连线
```

视频生成数据流：

```text
Text/Prompt 节点 + 可选 Image 节点
  -> Video 节点提交 generate 请求
  -> 本地 Node 后端
  -> JimengCli_api 视频生成能力
  -> 返回视频 URL 或文件
  -> 后端保存视频和 metadata
  -> 前端更新 Video 节点预览
```

上传资源数据流：

```text
用户右键画布点击上传
  -> 选择本地图片或视频文件
  -> 前端上传到本地 Node 后端
  -> 后端复制文件到 workspace/outputs 或 workspace/assets
  -> 后端生成 Asset metadata
  -> 前端在上传位置创建 Image 或 Video 节点
```

Agent 数据流：

```text
用户消息 + 当前节点上下文
  -> 前端提交 agent 请求
  -> 本地 Node 后端
  -> Agent service 组装上下文和系统提示词
  -> LLM provider
  -> 返回结构化 Prompt 建议
  -> 前端展示建议
  -> 用户确认写回节点或创建分支
```

LLM provider 设计：

- 第一版支持 OpenAI-compatible Chat Completions 接口。
- 配置项包括 base URL、model、API key。
- 后端统一封装为 `generateAgentReply()`，前端不感知具体模型供应商。
- 文本节点和 Agent 共用同一个 LLM provider client，但使用不同的 system prompt 和返回处理逻辑。
- 后续可增加 Ollama、本地模型、中转站多 key 轮询。

## 10. 后端 API 草案

### 10.1 配置

```http
GET /api/settings
PUT /api/settings
POST /api/settings/test-jimeng
POST /api/settings/test-llm
```

### 10.2 工作流

```http
GET /api/flows
GET /api/flows/:id
POST /api/flows
PUT /api/flows/:id
DELETE /api/flows/:id
```

### 10.3 生成

```http
POST /api/generations
GET /api/generations/:id
POST /api/generations/:id/retry
```

`POST /api/generations` 请求示例：

```json
{
  "flowId": "flow_001",
  "nodeId": "node_generate_001",
  "mediaType": "image",
  "prompt": "一张电影感的未来城市海报",
  "inputImages": ["C:/path/to/image.png"],
  "model": "jimeng",
  "width": 1024,
  "height": 1024,
  "count": 1,
  "seed": null
}
```

视频生成请求示例：

```json
{
  "flowId": "flow_001",
  "nodeId": "node_video_001",
  "mediaType": "video",
  "mode": "image_to_video",
  "prompt": "镜头缓慢推进，人物回头，雨夜霓虹反光，电影感",
  "inputImages": ["C:/path/to/first-frame.png"],
  "model": "seedance-2.0",
  "aspectRatio": "16:9",
  "resolution": "720P",
  "quality": "standard",
  "durationSeconds": 5,
  "count": 1,
  "generateAudio": true
}
```

### 10.4 媒体文件

```http
GET /api/assets/:assetId
GET /api/assets/:assetId/metadata
GET /api/assets/:assetId/file
POST /api/assets/upload
```

### 10.5 Agent

```http
POST /api/agent/prompt-optimize
POST /api/agent/edit-image-prompt
POST /api/agent/actions/apply
```

`POST /api/agent/edit-image-prompt` 请求示例：

```json
{
  "flowId": "flow_001",
  "selectedNodeId": "node_image_001",
  "userMessage": "保留人物姿势，把背景改成霓虹雨夜，服装更高级一点",
  "contextNodeIds": ["node_prompt_001", "node_generate_001", "node_image_001"]
}
```

### 10.6 文本节点 LLM

```http
POST /api/llm/chat
POST /api/text-nodes/:id/run
```

`POST /api/text-nodes/:id/run` 请求示例：

```json
{
  "flowId": "flow_001",
  "nodeId": "node_text_001",
  "model": "gvlm-3.1",
  "message": "一个女孩在风中飞舞",
  "outputFormat": "auto"
}
```

响应示例：

```json
{
  "nodeId": "node_text_001",
  "model": "gvlm-3.1",
  "content": "{\n  \"action\": \"text_to_image\",\n  \"action_input\": \"这是一幅极具电影质感的真实摄影作品...\",\n  \"supplementary\": {\n    \"style\": \"唯美真实摄影 / 电影级光影\",\n    \"aspect_ratio\": \"16:9\"\n  }\n}",
  "contentType": "json",
  "promptCandidate": "这是一幅极具电影质感的真实摄影作品...",
  "usage": {
    "promptTokens": 120,
    "completionTokens": 480
  }
}
```

响应示例：

```json
{
  "message": "我会保留主体姿势和人物身份，主要调整背景、服装质感和光线。",
  "optimizedPrompt": "保留原图人物姿势和面部特征，背景改为霓虹雨夜街头，高级黑色科技感外套，湿润地面反光，电影感布光，浅景深，细节丰富，真实摄影质感",
  "negativePrompt": "避免改变人物姿势，避免多手指，避免脸部变形，避免低清晰度",
  "suggestedParams": {
    "width": 1024,
    "height": 1024,
    "count": 2
  },
  "proposedActions": [
    {
      "id": "action_001",
      "type": "create_edit_branch",
      "label": "创建改图分支",
      "payload": {
        "sourceImageNodeId": "node_image_001",
        "prompt": "保留原图人物姿势和面部特征，背景改为霓虹雨夜街头，高级黑色科技感外套，湿润地面反光，电影感布光，浅景深，细节丰富，真实摄影质感"
      }
    }
  ]
}
```

## 11. 数据模型草案

### 11.1 Flow

```json
{
  "id": "flow_001",
  "name": "赛博城市海报探索",
  "nodes": [],
  "edges": [],
  "createdAt": "2026-07-04T00:00:00.000Z",
  "updatedAt": "2026-07-04T00:00:00.000Z"
}
```

### 11.2 Asset

```json
{
  "id": "asset_001",
  "type": "image",
  "path": "outputs/2026-07-04/asset_001.png",
  "prompt": "一张电影感的未来城市海报",
  "sourceNodeId": "node_generate_001",
  "inputAssetIds": [],
  "provider": "jimeng",
  "params": {
    "width": 1024,
    "height": 1024,
    "count": 1
  },
  "createdAt": "2026-07-04T00:00:00.000Z"
}
```

视频资产示例：

```json
{
  "id": "asset_video_001",
  "type": "video",
  "path": "outputs/2026-07-04/asset_video_001.mp4",
  "prompt": "镜头缓慢推进，人物回头，雨夜霓虹反光，电影感",
  "sourceNodeId": "node_video_001",
  "inputAssetIds": ["asset_image_001"],
  "provider": "jimeng",
  "params": {
    "model": "seedance-2.0",
    "aspectRatio": "16:9",
    "resolution": "720P",
    "quality": "standard",
    "durationSeconds": 5,
    "count": 1,
    "generateAudio": true
  },
  "createdAt": "2026-07-04T00:00:00.000Z"
}
```

### 11.3 Settings

```json
{
  "jimengBaseUrl": "http://localhost:3000",
  "authMode": "apiKey",
  "apiKey": "",
  "llmBaseUrl": "https://api.openai.com/v1",
  "llmModel": "gpt-4.1-mini",
  "llmApiKey": "",
  "outputDir": "./workspace/outputs",
  "defaultModel": "jimeng",
  "defaultSize": "1024x1024",
  "defaultVideoModel": "seedance-2.0",
  "defaultVideoAspectRatio": "16:9",
  "defaultVideoResolution": "720P",
  "defaultVideoQuality": "standard",
  "defaultVideoDurationSeconds": 5,
  "defaultVideoCount": 1,
  "defaultVideoGenerateAudio": true
}
```

### 11.4 AgentMessage

```json
{
  "id": "agent_msg_001",
  "flowId": "flow_001",
  "role": "assistant",
  "content": "我会保留主体姿势，主要调整背景和服装质感。",
  "selectedNodeId": "node_image_001",
  "contextNodeIds": ["node_prompt_001", "node_generate_001", "node_image_001"],
  "optimizedPrompt": "保留原图人物姿势和面部特征，背景改为霓虹雨夜街头...",
  "proposedActions": [],
  "createdAt": "2026-07-04T00:00:00.000Z"
}
```

### 11.5 TextNodeData

```json
{
  "id": "node_text_001",
  "type": "text",
  "title": "文本节点 1",
  "input": "一个女孩在风中飞舞",
  "content": "这是一幅极具电影质感的真实摄影作品...",
  "contentType": "text",
  "llm": {
    "provider": "openai-compatible",
    "model": "gvlm-3.1",
    "baseUrl": "https://example-gateway.com/v1"
  },
  "promptCandidate": "这是一幅极具电影质感的真实摄影作品...",
  "status": "success",
  "createdAt": "2026-07-04T00:00:00.000Z",
  "updatedAt": "2026-07-04T00:00:00.000Z"
}
```

### 11.6 VideoNodeData

```json
{
  "id": "node_video_001",
  "type": "video",
  "title": "视频节点 1",
  "prompt": "镜头缓慢推进，人物回头，雨夜霓虹反光，电影感",
  "inputImageAssetIds": ["asset_image_001"],
  "assetIds": ["asset_video_001"],
  "mode": "image_to_video",
  "model": "seedance-2.0",
  "aspectRatio": "16:9",
  "resolution": "720P",
  "quality": "standard",
  "durationSeconds": 5,
  "count": 1,
  "generateAudio": true,
  "status": "success",
  "createdAt": "2026-07-04T00:00:00.000Z",
  "updatedAt": "2026-07-04T00:00:00.000Z"
}
```

## 12. 错误处理

### 12.1 配置错误

- JimengCli_api 地址为空：提示先配置服务地址。
- 服务不可访问：提示检查 JimengCli_api 是否启动。
- 鉴权失败：提示检查 API key、cookie 或 token。

### 12.2 生成错误

- Prompt 为空：阻止提交。
- 上游图片不存在：提示图片文件丢失。
- 视频生成缺少文本或图片输入：提示补充 Prompt 或参考图。
- 当前模型不支持所选比例、分辨率、清晰度或秒数：提示切换参数。
- JimengCli_api 返回失败：展示原始错误摘要，并保留重试按钮。
- 图片下载失败：提示生成可能成功但保存失败，保留返回 URL。
- 视频下载失败：提示生成可能成功但保存失败，保留返回 URL。

### 12.3 文件错误

- 输出目录不可写：提示更换目录。
- 工作流保存失败：显示错误，并避免前端误报成功。

## 13. UI 要求

### 13.1 风格

- 工具型界面，信息密度适中。
- 不做营销落地页。
- 首页就是工作台。
- 节点卡片紧凑，优先展示状态和关键结果。
- 视觉参考采用用户提供的暗色节点画布参考：`reference-node-canvas.png`。
- 连线删除交互参考用户提供的剪刀断线效果：`reference-edge-cut.png`。
- 整体气质接近专业创作软件，不做花哨渐变和装饰性视觉。

### 13.2 布局

```text
顶部工具栏：新建 / 保存 / 打开 / 设置 / 运行状态
左侧节点库：Text / Image / Image Generate / Video / Agent Prompt / Note
中间画布：React Flow
右侧参数面板：当前节点配置
底部可选：生成日志
```

### 13.3 画布视觉

- 背景使用近黑色点阵网格，点阵低对比，不干扰图片预览。
- 画布支持平移、缩放和拖拽选中。
- 节点标题位于节点卡片外侧上方，包含类型图标和名称，例如“文本节点 1”“图片节点 2”。
- 节点主体为深灰色块，圆角偏柔和，推荐 8-12px。
- 节点不使用厚重描边，默认状态下只保留轻微层次和悬浮阴影。
- 图片节点和视频占位节点使用大面积预览区，内容为空时显示居中的类型占位图标。
- 文本节点可以显示简短内容摘要或可选动作列表，但不要在卡片里塞满表单。

### 13.4 连线与连接点

- 节点左右两侧显示圆形连接点。
- 连接点默认低对比，悬停或拖线时高亮。
- 连线使用柔和贝塞尔曲线，不使用折线。
- 连线颜色使用低饱和灰蓝色，选中时提亮。
- 连接方向默认从左到右：输入在左，输出在右。
- 图片到图片、图片到生成、Prompt 到生成都使用同一种基础连线语言，避免早期出现多套交互。

断线交互：

- 鼠标悬停在连线上时，连线中段浮现一个圆形剪刀按钮。
- 鼠标点击选中连线时，也显示剪刀按钮。
- 鼠标移出连线和剪刀按钮区域后，剪刀按钮自动消失。
- 点击剪刀按钮后，当前连线立即断开。
- 断线只删除 edge，不删除两端节点和节点内容。
- 剪刀按钮位置默认在连线视觉中点，随画布缩放和平移正确定位。
- 剪刀按钮出现时，当前连线高亮，参考图中蓝色高亮段效果。
- 连线需要有足够大的透明点击热区，避免用户必须精确点中细线。

实现建议：

- 使用 React Flow custom edge。
- 可见路径使用细贝塞尔曲线。
- 另加一条透明加粗路径作为 hover/click hit area。
- 使用 EdgeLabelRenderer 在路径中点渲染剪刀按钮。
- 剪刀图标优先使用 lucide-react 的 `Scissors`。
- 点击剪刀按钮时调用 `setEdges(edges => edges.filter(edge => edge.id !== currentEdgeId))`。

### 13.5 添加节点菜单

添加节点菜单采用浮层形式，出现在画布当前位置附近。

添加节点菜单参考：

- `reference-add-node-menu.png`

MVP 显示：

- 文本
- 图片
- 视频
- 即梦生成
- Agent Prompt
- 备注
- 上传
- 从生成历史选择

未来扩展只在设计上预留，不进入 MVP 开发：

- 音频
- 视频合成
- 导演台
- 脚本
- 素材库

触发方式：

- 双击画布空白区域打开添加节点菜单。
- 右键画布菜单中点击“添加节点”打开添加节点菜单。
- 菜单创建的新节点应出现在触发位置附近。

### 13.6 画布右键菜单

右键菜单参考用户提供的截图：

- `reference-canvas-context-menu.png`

MVP 菜单项：

- 上传。
- 添加节点。

未来菜单项：

- 保存到我的资产。
- 撤销。
- 重做。
- 粘贴。

交互要求：

- 右键画布空白区域时，菜单出现在鼠标位置附近。
- 点击“上传”打开本地文件选择器，支持图片和视频文件。
- 上传图片后创建 Image 节点。
- 上传视频后创建 Video 节点。
- 点击“添加节点”打开添加节点菜单。
- 未来项可以在 UI 中暂不显示，或显示为 disabled 状态，但不进入 MVP 验收。

### 13.7 框选与批量工具条

框选和批量工具条参考用户提供的截图：

- `reference-selection-toolbar.png`

MVP 能力：

- 按住左键拖拽形成选择框。
- 选择框覆盖到的节点进入选中状态。
- 多选后在选区上方显示浮动工具条。
- 工具条必须提供排列菜单。
- 排列菜单必须包含宫格排列、水平排列、垂直排列。

排列规则：

- 宫格排列：按当前选区节点数量自动计算列数，保持统一间距。
- 水平排列：按节点当前位置从左到右排序，统一 y 坐标。
- 垂直排列：按节点当前位置从上到下排序，统一 x 坐标。
- 排列操作只改变节点位置，不改变连线关系。

未来批量工具：

- 保存到资产。
- 创建副本。
- 打组。
- 批量下载。
- 对齐到网格。
- 批量删除确认。

### 13.8 文本节点参考

文本节点参考用户提供的文本节点系列截图：

- `reference-text-node-model-menu.png`
- `reference-text-node-llm-output.png`
- `reference-text-node-quick-actions.png`

MVP 文本节点要求：

- 节点标题显示在卡片外上方，例如“文本节点 4”。
- 节点主体显示文本图标或内容摘要。
- 节点内部可显示轻量 quick actions。
- MVP quick actions 保留“自己编写内容”和“图片反推提示词”。
- “一键创建视频分支”和“文字生音乐”显示为未来能力，不进入 M0/M1 实现。
- 选中文本节点时，底部出现文本 Composer。
- 文本 Composer 左侧显示当前 LLM 模型下拉。
- 模型下拉展示模型名、简短说明和预计耗时。
- 输入框用于输入用户文字需求。
- 提交后，LLM 返回内容写入文本节点。
- 返回内容可以显示为普通文本，也可以显示为 JSON 代码块。
- 文本节点输出可连接到 Generate 节点。

未来 quick actions：

- 一键创建视频生成分支。
- 图片反推提示词的批量模式。
- 文字生音乐。
- 剧本转分镜。
- 文本改写为多风格 Prompt。

### 13.9 图片节点参考

图片节点参考用户提供的图片节点系列截图：

- `reference-image-node-quick-actions.png`
- `reference-image-composer.png`
- `reference-model-menu.png`
- `reference-quality-ratio-menu.png`
- `reference-preset-menu.png`
- `reference-count-menu.png`

MVP 图片节点要求：

- 图片节点主体以大面积图片预览为核心。
- 空图片或加载失败时显示居中的图片占位图标。
- 节点内部可显示轻量 quick actions。
- MVP quick actions 只保留“图生图”和“作为参考图”。
- “图片高清”显示为未来能力，不进入 M0/M1 实现。
- 选中图片节点时，节点边框提亮，左右连接点显示。
- 图片节点可作为 Jimeng Generate 节点的输入。

未来 quick actions：

- 图片高清。
- 图片扩图。
- 图片局部重绘。
- 背景替换。
- 风格迁移。
- 人像质感调节。
- 电影级光影校正。

### 13.10 生成 Composer 参考

生成 Composer 是未来围绕图片节点展开的底部创作面板。它用于把“选中图片 + Prompt + 参数 + 模型 + 预设”整合到一个输入区里。

MVP 只做最小形态：

- 一个 Prompt 输入区。
- 一个提交按钮。
- 自动读取当前选中的图片节点作为参考图。
- 调用 Agent 优化 Prompt 后，可写回 Prompt 输入区。

未来完整形态参考：

- 顶部功能按钮：风格、标记、参考。
- Prompt 大输入区，支持上传图片后输入文字指令改图。
- 模型选择下拉，例如 Lib Image、Seedream、其他即梦或中转站模型。
- 画质和清晰度设置，例如低画质、标准画质、高画质、1K、2K、4K。
- 比例设置，例如自适应、1:1、1:2、2:1、9:16、16:9、3:4、4:3、21:9。
- 预设菜单，例如故事板、分镜叙事、画面推演、设定图、人像质感调节、电影级光影校正。
- 摄像机参数入口。
- 语言/翻译入口。
- 张数选择，例如 1 张、2 张、4 张。
- 额度或消耗显示。
- 提交按钮。

这些 Composer 能力不进入 MVP 的核心验收，只作为后续版本的 UI 和功能方向。

### 13.11 视频节点参考

视频节点参考用户提供的视频节点系列截图：

- `reference-video-node-quick-actions.png`
- `reference-video-composer.png`
- `reference-video-resolution-duration-menu.png`
- `reference-video-model-menu.png`
- `reference-video-count-menu.png`

MVP 视频节点要求：

- 视频节点主体以大面积视频预览为核心。
- 空视频或生成前显示居中的播放占位图标。
- 节点内部 quick actions 保留“首尾帧生成视频”和“首帧生成视频”。
- 视频节点可以接入 Image 节点作为首帧/参考图。
- 视频节点可以接入 Text/Prompt 节点作为视频描述。
- 选中视频节点时显示视频 Composer。
- 视频生成结果保存为本地视频文件，并可在节点内播放预览。

视频 Composer MVP 必备控件：

- 模型切换：例如 Seedance 2.0、Seedance 2.0 Fast、Seedance 2.0 Mini、Kling 等，由 JimengCli_api 实际可用模型决定。
- 模式切换：文生视频、图生视频、全能参考、首尾帧、图片参考。
- Prompt 输入框：描述生成画面内容，支持 `@` 引用素材。
- 比例切换：Auto、16:9、9:16、4:3、3:4、1:1、21:9。
- 分辨率/清晰度切换：480P、720P、1080P、4K；不可用选项置灰。
- 秒数切换：MVP 至少支持 5s；模型支持更多时再展示 3s、10s、15s。
- 是否生成音频：开启/关闭。
- 数量切换：1 个、2 个、4 个。
- 提交按钮。

视频 Composer 未来能力：

- 运镜预设。
- 特效。
- 角色库。
- 多参考素材管理。
- 画面级分镜控制。
- 视频合成和剪辑。

### 13.12 节点状态

- idle：默认边框。
- running：显示进度/旋转状态。
- success：显示完成状态和缩略图。
- error：红色状态和错误入口。

## 14. 里程碑

### M0：技术验证

目标：证明 React Flow 前端可以通过后端调用 JimengCli_api 并显示图片，同时能通过 LLM Agent 优化 Prompt。

交付：

- React Flow 画布。
- 一个 Text/Prompt 节点。
- 一个 Jimeng Generate 节点。
- 一个最小 Agent 面板。
- 右键上传。
- 双击添加文本、图片、视频节点。
- LLM provider 配置。
- 文本节点 LLM 模型切换。
- 文本节点调用 LLM 并写回返回内容。
- Prompt 优化接口。
- 调用后端生成图片。
- 图片结果显示在画布上。
- 上传图片或视频后能创建对应节点。

验收：

- 输入粗略想法后，Agent 能返回优化 Prompt。
- 优化 Prompt 能写回 Prompt 节点。
- 文本节点能选择 LLM 模型并返回文本内容。
- 文本节点返回内容能作为 Generate 节点 Prompt。
- 输入 Prompt 后能生成一张图。
- 图片保存到本地。
- 页面刷新后能重新看到工作流。

### M1：可用 MVP

目标：做成日常可用的个人工作台。

交付：

- 设置弹窗。
- API 连接测试。
- Image 节点。
- Video 节点。
- 图生图链路。
- 文生视频链路。
- 图生视频链路。
- 视频模型、比例、分辨率、清晰度、秒数和数量切换。
- 框选多个节点。
- 宫格排列、水平排列、垂直排列。
- 文本节点返回内容的 JSON 展示。
- 图片节点 quick actions：图生图、作为参考图。
- 最小生成 Composer：Prompt 输入、提交、读取当前图片参考。
- Agent 改图提示词优化。
- Agent 创建改图分支。
- 工作流保存/打开。
- 生成历史。
- 错误重试。

验收：

- 能完成文生图和图生图。
- 能完成文生视频和图生视频。
- 视频生成前能切换模型、比例、分辨率、清晰度、秒数和数量。
- 能框选多个节点，并执行宫格、水平、垂直排列。
- 能选中图片后让 Agent 生成改图 Prompt。
- 能一键创建 Prompt + Generate 改图分支。
- 能保存和打开工作流。
- 生成失败时能看到明确原因。

### M2：扩展能力

目标：开始从单工具变成多能力创作工作台。

候选功能：

- 中转站 OpenAI-compatible 生图节点。
- 多模型 Provider 抽象。
- 更强 Agent 工具调用，例如批量生成方案、自动对比结果、自动整理提示词模板。
- 文本节点多轮对话。
- 文本节点一键创建视频分支、图片反推提示词、文字生音乐。
- 批量生成。
- 图片放大节点。
- 图片高清节点或图片高清 quick action。
- 完整生成 Composer。
- 模型选择菜单。
- 画质、清晰度和比例面板。
- 预设库。
- 摄像机参数。
- 张数选择菜单。
- 音频节点。
- 视频合成节点。
- 导演台节点。
- 脚本节点。
- 素材库节点。
- Prompt 模板库。
- Electron/Tauri 桌面打包。

## 15. 优先级

### P0

- 本地前后端启动。
- JimengCli_api 配置。
- LLM provider 配置。
- Agent 面板。
- Prompt 优化接口。
- Text/Prompt 节点。
- 文本节点 LLM 模型切换。
- 文本节点 LLM 返回内容写回。
- Image Generate 节点。
- Image 节点。
- Video 节点基础展示。
- 右键上传图片/视频。
- 双击添加文本、图片、视频节点。
- 生成图片保存。
- 工作流保存。

### P1

- 图生图。
- 文生视频。
- 图生视频。
- 视频模型切换。
- 视频比例、分辨率、清晰度、秒数和数量切换。
- 视频结果保存和预览。
- 框选多个节点。
- 宫格排列、水平排列、垂直排列。
- 图片作为参考图。
- 最小生成 Composer。
- 文本节点 JSON 返回展示。
- Agent 改图提示词优化。
- Agent 创建改图分支。
- 设置测试连接。
- 生成历史。
- 错误重试。
- 输出目录配置。

### P2

- 中转站 API 节点。
- 批量生成。
- Agent 多轮任务规划。
- 文本节点多轮对话和上下文串联。
- 文本节点一键创建视频分支、图片反推提示词、文字生音乐。
- 保存到资产、创建副本、打组、批量下载。
- 撤销、重做、粘贴。
- 图片高清。
- 完整生成 Composer。
- 模型菜单、画质比例菜单、预设菜单、张数菜单。
- 视频合成、音频、导演台、素材库等扩展节点。
- 桌面打包。
- 模板库。
- 多 Provider 管理。

## 16. 风险与对策

### 16.1 JimengCli_api 稳定性

风险：即梦接口变化或鉴权失效会导致调用失败。  
对策：将 Jimeng 调用封装在独立 service 中，前端不直接依赖具体接口字段。

### 16.2 密钥安全

风险：本地明文保存密钥存在泄露风险。  
对策：MVP 明确只做个人本地工具，配置文件加入忽略规则；后续接系统钥匙串。

### 16.3 工作流复杂度膨胀

风险：第一版加入太多节点会拖慢进度。  
对策：MVP 只保留 Prompt、Image、Generate、Note 四类节点。

### 16.4 图片资产丢失

风险：工作流引用本地图片，移动文件后失效。  
对策：所有生成结果统一复制到 workspace/outputs，不直接引用临时路径。

## 17. 验收标准总表

- 用户能在本地打开工作台。
- 用户能配置 JimengCli_api 地址。
- 用户能测试连接成功或看到明确失败原因。
- 用户能在画布中创建 Text/Prompt、Image Generate、Video 节点。
- 用户能通过右键菜单上传图片/视频，并自动创建对应节点。
- 用户能通过双击画布添加文本、图片、视频节点。
- 用户能在文本节点中选择 LLM 模型、输入内容并获得模型返回文本。
- 文本节点返回内容能连接到 Image Generate 或 Video 节点作为 Prompt。
- 用户能连线节点。
- 用户能悬停或点击连线看到剪刀按钮，并点击剪刀断开连线。
- 用户能通过即梦生成图片。
- 生成图片能保存到本地。
- 生成图片能作为 Image 节点显示。
- 用户能从 Image 节点继续图生图。
- 用户能通过即梦生成视频。
- 视频生成前能切换模型、比例、分辨率、清晰度、秒数和数量。
- 生成视频能保存到本地。
- 生成视频能作为 Video 节点显示并播放预览。
- 用户能框选多个节点，并执行宫格排列、水平排列、垂直排列。
- 用户能保存并重新打开工作流。
- 常见失败场景有可理解的错误提示。

## 18. 第一轮开发建议

推荐先做 M0，不直接上完整 MVP：

1. 建 React + React Flow 前端。
2. 建 Node 本地后端。
3. 写 JimengCli_api client。
4. 写 LLM provider client。
5. 做 settings.json。
6. 做 Text/Prompt、Image Generate、Video 和最小 Agent 面板。
7. 做右键上传和双击添加文本、图片、视频节点。
8. 跑通文本节点 LLM 模型切换和返回内容写回。
9. 跑通 Agent 优化 Prompt。
10. 跑通文生图。
11. 搭出 Video 节点壳和视频 Composer 参数控件。
12. 生成成功后自动创建 Image 节点。
13. 保存 flow JSON 和图片 metadata。

M0 跑通后再补图生图、文生视频、图生视频、Agent 改图分支、设置弹窗和历史记录。这样可以最快验证四个关键风险：本地工作台能否稳定调用 JimengCli_api，文本节点能否稳定接入中转站 LLM，视频参数控件能否映射到 JimengCli_api，以及 LLM Agent 能否真正提高提示词和改图效率。
