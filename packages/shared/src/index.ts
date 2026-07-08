// 即梦 Flow 工作台 - 共享类型定义入口
// 前后端公用类型集中在此包，避免重复定义。

export interface ApiHealthResponse {
  status: "ok" | "error";
  service?: string;
  timestamp?: number;
}

/** 节点类型枚举（占位示例，后续按 PRD 扩展） */
export type FlowNodeType =
  | "text"
  | "image"
  | "video"
  | "composer"
  | "custom";

export * from './settings'
export * from './video'
