# QA Bug 清单

测试日期：2026-07-22
项目：墨K画布
范围：静态代码审查、自动化质量检查、Server/Web 运行态接口验证

## 总览

| 编号 | 级别 | 状态 | 问题摘要 |
| --- | --- | --- | --- |
| BUG-001 | P1 功能错误 | 待修复 | 普通 OpenAI-compatible 图片供应商忽略 1K/2K/4K 分辨率选择 |
| BUG-002 | P1 功能错误 | 待修复 | 非法 MIME 类型文件上传被接受并被错误识别为图片 |
| BUG-003 | P1 安全/功能错误 | 待修复 | 生成输入图片路径允许绝对路径和目录穿越路径 |
| BUG-004 | P2 边界问题 | 待修复 | 缺少 nodes/edges 的旧格式或损坏项目可能导致生成状态写回崩溃 |

## BUG-001：普通 OpenAI-compatible 图片路径忽略分辨率设置

- 级别：P1 功能错误
- 代码位置：
  - `apps/server/src/services/openaiImage.ts:327`
  - 同一文件编辑图片请求组装逻辑约 `apps/server/src/services/openaiImage.ts:300-313`
- 触发条件：选择普通 OpenAI-compatible 图片供应商，并分别选择 1K、2K、4K 后发起文生图或图生图请求。
- 实际证据：直接调用 `getOpenAiCompatibleImageSize` 得到以下结果：

  ```text
  1024x576  -> 1536x1024
  2048x1152 -> 1536x1024
  4096x2304 -> 1536x1024
  ```

- 问题描述：该路径的尺寸归一化逻辑只按宽高比选择固定尺寸，没有使用用户选择的目标长边。因此 2K/4K 选择不会真正传递给普通 OpenAI-compatible 图片接口；编辑图片路径复用同一 helper，也会受到影响。
- 影响：用户界面显示的分辨率与实际请求尺寸不一致，可能导致输出清晰度、成本和耗时均不符合预期。
- 修复建议：统一使用 1K/2K/4K 到长边 `1024/2048/4096` 的映射，再按供应商/模型约束归一化宽高；编辑图片与生成图片共用同一套经过测试的尺寸转换逻辑。

## BUG-002：非法 MIME 类型上传成功并被识别为图片

- 级别：P1 功能错误
- 代码位置：
  - `apps/server/src/routes/assets.ts:261`
  - `apps/server/src/routes/assets.ts:289`
  - `apps/server/src/services/assets.ts:37`
- 触发条件：通过素材上传接口上传一个内容类型为 `application/pdf` 的文件，例如 `codex-qa-illegal.pdf`。
- 实际证据：运行态请求返回：

  ```text
  HTTP 201
  type=image
  ```

- 问题描述：上传路由取得 multipart 的 MIME 类型后，素材服务的 `deriveAssetType` 对无法识别的类型回退为 `image`，导致 PDF 等不支持的文件被接受并进入图片素材流程。
- 影响：非法素材可能污染素材库；后续缩略图、图片解析或模型输入阶段才失败，错误位置远离上传操作，用户难以判断原因。
- 修复建议：在上传边界同时校验 MIME 类型和扩展名，只允许文档明确支持的图片/视频类型；不支持的类型返回 4xx 和可操作的错误信息。必要时增加文件魔数校验，避免仅信任客户端 MIME。

## BUG-003：生成输入图片路径允许绝对路径和目录穿越

- 级别：P1 安全/功能错误
- 代码位置：
  - `apps/server/src/config/index.ts:59-65`
  - `apps/server/src/services/jimeng/index.ts:279-295`
  - `apps/server/src/services/openaiVideo.ts:107-123`
  - `apps/server/src/services/generations.ts:875-885`
- 触发条件：向生成任务请求的 `inputImages` 传入非素材 ID 的本地路径，例如：

  ```text
  ../outside-secret.txt
  C:/Windows/win.ini
  ```

- 实际证据：直接调用当前路径解析逻辑得到：

  ```text
  ../outside-secret.txt -> F:\AI\Codex\outside-secret.txt
  C:/Windows/win.ini    -> C:/Windows/win.ini
  ```

- 问题描述：`resolveRuntimePath` 接受绝对路径和包含 `..` 的相对路径；即梦和视频供应商路径会对非 Asset 输入调用该解析逻辑。生成任务创建处只校验 prompt 和 nodeId，没有对 `inputImages` 做 workspace 范围校验。
- 影响：服务端可能读取并上传 workspace 之外的本地文件给外部模型供应商，形成目录穿越和本地文件外传风险。
- 修复建议：生成接口只接受已验证的 Asset ID、数据 URL 或 workspace 内经校验的文件引用；拒绝任意绝对路径和目录穿越输入。对所有供应商统一在 service 边界校验最终解析路径必须位于已解析的 workspace 目录内，并补充 Windows 路径、UNC 路径和大小写路径测试。

## BUG-004：缺少 nodes/edges 的项目可能导致生成状态写回崩溃

- 级别：P2 边界问题
- 代码位置：
  - `apps/server/src/services/flows.ts:281`
  - `apps/server/src/services/generations.ts:174-178`
  - `apps/server/src/services/generations.ts:201`
  - `apps/web/src/state/flowStore.ts:348-349`
  - `apps/web/src/state/flowStore.ts:660` 附近
- 触发条件：加载一个旧格式或损坏的 flow JSON，其中缺少 `nodes` 或 `edges` 字段，然后触发生成任务并等待服务端写回项目状态。
- 实际证据：对缺少 `nodes/edges` 的临时项目执行生成失败写回时，服务端日志出现：

  ```text
  TypeError: Cannot read properties of undefined (reading 'map')
  at apps/server/src/services/generations.ts:201
  ```

- 问题描述：`getFlow` 直接 `JSON.parse` 后返回数据，没有把旧格式或缺失字段归一化为空数组；前端加载和服务端生成写回都直接调用 `flow.nodes`、`flow.edges` 的数组方法。
- 影响：特定旧项目可能在加载、生成结果写回或错误状态持久化阶段崩溃。标准 API 创建的空项目可正常保存生成失败状态，因此该问题主要影响旧格式/损坏数据，不代表所有空项目都会失败。
- 修复建议：在 server 的 flow 读取边界增加 schema 归一化和版本迁移：缺失的 `nodes`、`edges`、Agent 对话等字段填充为默认值；类型不正确时返回明确的项目损坏错误。前端加载时也应对数组字段做防御性归一化，并增加旧格式兼容测试。

## 质量检查背景

本清单只收录有代码位置或运行证据支撑的问题。对应质量命令结果如下：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过；有 11 条 warning，无 error |
| `npm test` | 通过；465 个测试通过 |
| `npm run build` | 通过 |

已运行态验证的正常范围包括 Web/Server 健康检查、项目列表/创建/加载/保存、素材上传与查询、SSE 建立、非法项目 ID、非法 Origin、未配置 API Key 的错误响应等。真实模型供应商调用、桌面 Electron 交互和需要人工操作的完整 UI 流程未纳入上述 Bug 的通过判定。
