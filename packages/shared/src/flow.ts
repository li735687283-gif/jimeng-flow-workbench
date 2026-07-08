// 即梦 Flow 工作台 - Flow 数据模型
// 参考 PRD 11.1 节、第 8.5 节（本地文件管理）、第 10.2 节（工作流 API）。
// 工作流以 JSON 文件形式存储在 workspace/flows/<id>.json。
//
// 说明：FlowNode / FlowEdge 仅声明与 @xyflow/react 的 Node / Edge
// 结构兼容的必要字段（id / position / data 等），其余可选字段
// （width / height / measured / sourceHandle …）在 JSON 持久化时
// 原样保留，运行时由 React Flow 自行消费。
// 这样 shared 包无需引入 @xyflow/react 依赖，
// 同时保证 Node[] ↔ FlowNode[] 双向赋值类型兼容。

/** 工作流节点（结构兼容 @xyflow/react 的 Node） */
export interface FlowNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/** 工作流连线（结构兼容 @xyflow/react 的 Edge） */
export interface FlowEdge {
  id: string
  source: string
  target: string
  type?: string
}

/** 完整工作流（对应 workspace/flows/<id>.json） */
export interface Flow {
  id: string
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** ISO 8601 创建时间 */
  createdAt: string
  /** ISO 8601 最后更新时间 */
  updatedAt: string
}

/** 工作流摘要（列表用，不含 nodes/edges） */
export interface FlowSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  /** 封面图 Asset ID（从节点中提取的第一张图片），无则为 null */
  coverAssetId: string | null
}

/** 创建工作流时的请求体 */
export interface CreateFlowRequest {
  name?: string
}

/** 复制工作流时的请求体 */
export interface DuplicateFlowRequest {
  name?: string
}

/** 更新工作流时的请求体（部分字段） */
export interface UpdateFlowRequest {
  name?: string
  nodes?: FlowNode[]
  edges?: FlowEdge[]
  deletedNodeIds?: string[]
}
