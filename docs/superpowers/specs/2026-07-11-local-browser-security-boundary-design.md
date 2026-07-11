# 本机浏览器安全边界设计

状态：已批准  
日期：2026-07-11

## 目标

把 Fastify 后端从“局域网可达、任意网页 Origin 可调用”收紧为“仅本机浏览器和本机工具可调用”，同时保持当前 Vite 开发流程和相对 `/api` 请求不变。

## 已确认约束

- 工作台只在当前电脑的浏览器中使用。
- 不支持手机或其他电脑通过局域网访问。
- 本批不修改当前正在编辑的前端页面和节点文件。
- 不增加新的运行时依赖。
- 安全判断必须在进入业务路由前完成，不能只依赖浏览器执行 CORS。

## 威胁模型

本批处理以下风险：

1. 后端监听 `0.0.0.0`，导致同一局域网客户端可直接访问设置、上传和生成接口。
2. 恶意网页向本机服务发起跨站请求，触发读取配置、上传文件或生成任务。
3. CORS 只影响浏览器是否允许页面读取响应，不能作为业务路由的唯一访问控制。

本批暂不处理：

- 设置接口的密钥脱敏和 write-only 语义。
- `dreaminaPath`、`outputDir` 等高权限设置的能力隔离。
- Codex `danger-full-access` 沙箱收紧。
- OpenAI-compatible Provider 的 SSRF 和原始本地路径读取。
- 局域网模式、账号体系或多用户鉴权。

这些事项进入后续独立安全批次，避免一次修改多个协议面。

## 方案选择

采用“回环监听 + 服务端请求守卫 + CORS 白名单”。

未选择仅修改 CORS，因为跨站请求可能已经到达业务路由；未选择本地 Token/Cookie，因为当前只允许本机使用，Token 生成、共享和刷新会增加不必要的状态与部署复杂度。

## 模块设计

新增 `apps/server/src/security/localAccess.ts`，只负责本机访问策略，不依赖业务路由。

该模块提供：

```ts
export const LOCAL_BROWSER_ORIGINS: ReadonlySet<string>

export interface LocalRequestMetadata {
  origin?: string
  secFetchSite?: string
}

export function isAllowedLocalRequest(
  metadata: LocalRequestMetadata,
): boolean

export function installLocalAccessGuard(app: FastifyInstance): void
```

`isAllowedLocalRequest` 是无副作用的纯函数，规则如下：

1. `Sec-Fetch-Site` 等于 `cross-site` 时拒绝。
2. 存在 `Origin` 时，只允许：
   - `http://127.0.0.1:5174`
   - `http://localhost:5174`
3. 不存在 `Origin` 且不是 `cross-site` 时允许，以兼容本机测试、健康检查和命令行调用。

`installLocalAccessGuard` 在 Fastify 根实例安装 `onRequest` Hook。拒绝请求时返回：

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "仅允许本机浏览器访问"
}
```

## 启动与请求流程

`apps/server/src/index.ts` 的启动顺序调整为：

1. 创建 Fastify 实例。
2. 安装本机访问守卫。
3. 注册 CORS，Origin 判定复用同一白名单。
4. 注册 multipart 和业务路由。
5. 监听 `127.0.0.1:8787`。

数据流：

```text
浏览器 / 本机工具
  -> 127.0.0.1:8787
  -> localAccess onRequest
  -> CORS
  -> 业务路由
```

安全策略只维护一份 Origin 白名单，避免 Hook 和 CORS 规则漂移。

## 错误处理

- 非法 Origin 和 `cross-site` 请求统一返回 HTTP 403，不进入业务路由。
- 合法请求保持现有响应和错误语义。
- 服务器仍允许无 Origin 的本机 HTTP 客户端；进程级本地恶意软件不在本批浏览器边界的防护范围内。

## 测试设计

新增 `apps/server/test/localAccess.test.ts`，使用 Node test runner 和 Fastify `inject` 验证真实 Hook 行为：

1. 允许 `Origin: http://127.0.0.1:5174`。
2. 允许 `Origin: http://localhost:5174`。
3. 允许没有 Origin 的本机请求。
4. 拒绝未知 Origin。
5. 即使 Origin 合法，也拒绝 `Sec-Fetch-Site: cross-site`。
6. 拒绝请求时业务处理函数不执行。

测试采用红绿重构流程：先让测试因模块不存在或守卫缺失而失败，再实现最小代码使其通过。

## 验收标准

- 后端只监听 `127.0.0.1`。
- 当前 Vite 页面可以继续通过 `/api` 调用后端。
- 未知网页 Origin 无法进入任何业务路由。
- 本机无 Origin 测试和健康检查不受影响。
- 新增安全测试全部通过。
- Server TypeScript 检查除仓库已有错误外不新增错误。
- 不修改或覆盖用户现有前端工作树改动。

## 后续批次

完成本批后，安全重构按以下顺序继续：

1. Settings API 密钥脱敏及 write-only 更新协议。
2. CLI 可执行文件与输出目录从 HTTP 设置中剥离。
3. Codex 隔离工作目录和最小沙箱权限。
4. Provider URL、远程下载和本地输入路径策略统一化。

