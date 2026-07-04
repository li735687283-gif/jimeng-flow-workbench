# M0 验收检查清单

## 项目骨架
- [x] 前端可访问 http://localhost:5173
- [x] 后端监听 http://localhost:8787
- [x] 前端通过 /api 前缀能访问后端接口
- [x] .gitignore 已忽略 workspace/、settings.json、node_modules

## 配置层
- [x] settings.json 数据模型完整（含 JimengCli_api、LLM provider、输出目录、默认参数）
- [x] 系统首次启动时使用默认配置并提示用户先配置 <!-- M0: 默认值合并已实现；提示仅在 Composer 底部 hint 中体现，无独立首次启动引导弹窗 -->
- [x] 设置 UI 可编辑并保存配置
- [x] 配置写入 settings.json 并在下次启动自动读取
- [x] 未配置 JimengCli_api 地址时生成按钮置灰并提示入口 <!-- 已修复：GenerateComposer 读取 isJimengConfigured，未配置时按钮置灰 + 红色提示入口 -->

## 工作流持久化
- [x] flow JSON 可保存到 workspace/flows/flow-id.json
- [x] 可重新打开历史工作流
- [x] 支持画布变化时自动保存（节流）
- [x] 页面刷新后能自动恢复最近工作流 <!-- 已修复：useAutoSave 首次挂载先 loadFlowList 取 updatedAt 最大项 loadFlow，列表空才 createFlow -->
- [x] GET/POST/PUT/DELETE /api/flows 接口可用

## 画布基础
- [x] 暗色近黑点阵低对比网格背景（符合 reference-node-canvas.png）
- [x] 节点标题显示在卡片外侧上方（含类型图标和名称）
- [x] 节点可拖拽、连线、缩放、平移、删除
- [x] 连线为柔和贝塞尔曲线、低饱和灰蓝色、输入在左输出在右

## 剪刀断线
- [x] 鼠标悬停或点击连线时高亮并显示剪刀按钮（符合 reference-edge-cut.png）
- [x] 点击剪刀按钮断开连线，保留两端节点和内容
- [x] 鼠标移出区域后剪刀按钮自动消失
- [x] 连线有足够大的透明点击热区

## 画布菜单
- [x] 右键画布显示"上传"和"添加节点"菜单（符合 reference-canvas-context-menu.png）
- [x] 双击画布显示节点类型菜单（符合 reference-add-node-menu.png）
- [x] 菜单包含：文本、图片、视频、即梦生成、Agent Prompt、备注、上传、从生成历史选择
- [x] 新节点出现在触发位置附近
- [x] 左侧节点库可创建节点

## 文本节点
- [x] 支持手写文本内容
- [x] 选中文本节点时底部出现文本 Composer（符合 reference-text-node-model-menu.png）
- [x] Composer 左侧显示 LLM 模型下拉（模型名/说明/耗时）
- [x] 可切换 LLM 模型
- [x] 输入并提交后调用 LLM 返回内容写回节点
- [x] 返回内容支持纯文本和 JSON 代码块两种展示（符合 reference-text-node-llm-output.png）
- [x] 返回内容含 action_input/prompt/optimizedPrompt 字段时识别为 Prompt 候选
- [x] 文本节点输出可连接到 Generate 或 Video 节点
- [x] LLM 调用失败时显示错误状态和重试入口
- [x] quick actions 含"自己编写内容"和"图片反推提示词"占位

## Generate 节点
- [x] 可接收 Prompt 节点输入和可选参考图输入
- [x] 参数面板含模型、尺寸、数量、seed、状态、错误信息
- [x] 点击生成调用 JimengCli_api
- [x] 生成过程有 loading 状态
- [x] 生成成功后图片保存到 workspace/outputs/yyyy-mm-dd/
- [x] 图片 metadata JSON 同名保存（Prompt/参数/时间/来源节点）
- [x] 生成成功后自动创建 Image 节点并连线
- [x] 生成失败时显示错误摘要并保留重试按钮
- [x] 支持图生图（识别上游 Image 节点作为参考图）

## 生成任务状态
- [x] 支持 idle/queued/running/success/error 状态流转
- [x] 支持取消前端等待状态
- [x] 支持失败重试
- [x] 支持查看错误详情 <!-- M0: 错误信息在 Composer 错误行中用 ellipsis 截断，但 title 属性提供完整文本 tooltip；GenerateNode 节点上也以 title 显示完整 error -->

## Image 节点
- [x] 大面积图片预览
- [x] 空图片或加载失败时显示居中占位图标
- [x] 选中时边框提亮、连接点显示
- [x] quick actions 含"图生图"和"作为参考图"（符合 reference-image-node-quick-actions.png）
- [x] 可作为 Generate 节点输入

## 资产上传
- [x] 右键"上传"可打开本地文件选择器
- [x] 支持图片和视频文件
- [x] 上传文件复制到 workspace/outputs 目录
- [x] 生成 Asset metadata
- [x] 上传图片后创建 Image 节点
- [x] 上传视频后创建 Video 节点
- [x] GET/POST /api/assets 接口可用 <!-- 实际路径为 GET /api/assets 与 POST /api/assets/upload（非 POST /api/assets），功能等价 -->

## Video 节点壳
- [x] 大面积视频预览，空状态显示居中播放占位图标（符合 reference-video-node-quick-actions.png）
- [x] quick actions 含"首尾帧生成视频"和"首帧生成视频"
- [x] 视频 Composer 含模型切换（符合 reference-video-model-menu.png）
- [x] 视频 Composer 含模式切换（文生/图生/全能参考/首尾帧/图片参考）
- [x] 视频 Composer 含 Prompt 输入框
- [x] 视频 Composer 含比例切换（Auto/16:9/9:16/4:3/3:4/1:1/21:9）
- [x] 视频 Composer 含分辨率切换（480P/720P/1080P/4K，不可用置灰，符合 reference-video-resolution-duration-menu.png）
- [x] 视频 Composer 含秒数切换（至少 5s） <!-- 已修复：VIDEO_DURATIONS 改为 [5, 10, 15] -->
- [x] 视频 Composer 含是否生成音频开关
- [x] 视频 Composer 含数量切换（1/2/4，符合 reference-video-count-menu.png）
- [x] 视频 Composer 含提交按钮 <!-- M0 stub：提交仅 console.log 请求结构，不真正调用后端，符合 M0 范围 -->
- [x] 参数可映射到 PRD 10.3 视频生成请求示例数据结构

## Agent 面板
- [x] 可输入粗略想法
- [x] 返回结构化优化 Prompt（含 optimizedPrompt/negativePrompt/suggestedParams/proposedActions）
- [x] 前端展示优化 Prompt、负面约束、参数建议
- [x] 支持复制 Prompt
- [x] 支持写回当前 Prompt 节点
- [x] 支持查看 Agent 使用了哪些节点上下文
- [x] Agent 不自动生成图片，需用户确认触发
- [x] Agent 调用失败时显示错误和重试入口

## 端到端验证
- [x] 文生图链路跑通（Prompt → Generate → Image）
- [x] 图生图链路跑通（Image+Prompt → Generate → 新 Image）
- [x] 文本节点 LLM 调用链路跑通
- [x] Agent Prompt 优化链路跑通（输入→返回→写回）
- [x] 右键上传和双击添加节点可用
- [x] 剪刀断线交互可用
- [x] 工作流保存/打开可用（含页面刷新恢复） <!-- 已修复：刷新恢复已实现 -->
- [x] Video 节点壳和参数控件完整

## PRD M0 验收标准对照
- [x] 输入粗略想法后，Agent 能返回优化 Prompt
- [x] 优化 Prompt 能写回 Prompt 节点
- [x] 文本节点能选择 LLM 模型并返回文本内容
- [x] 文本节点返回内容能作为 Generate 节点 Prompt
- [x] 输入 Prompt 后能生成一张图
- [x] 图片保存到本地
- [x] 页面刷新后能重新看到工作流 <!-- 已修复：刷新后自动 loadFlow 最近工作流 -->
