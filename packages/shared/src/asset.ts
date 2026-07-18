// 即梦 Flow 工作台 - Asset 数据模型
// 参考 PRD 11.2 节、第 8.5 节、第 10.4 节
// 描述本地工作区中的图片/视频资产及其元数据。
// 资产文件与同名 metadata JSON 一同存放在 workspace/outputs/yyyy-mm-dd/ 下。

/** 资产媒体类型 */
export type AssetType = 'image' | 'video'

/** 资产库自动分类。 */
export type AssetCategory = '角色' | '场景' | '道具'

/**
 * 一条本地资产记录。
 * 对应磁盘上两个文件：<id>.<ext>（媒体本体）与 <id>.json（本对象序列化）。
 */
export interface Asset {
  /** 资产 ID，形如 asset_<timestamp>_<random> */
  id: string
  /** 媒体类型 */
  type: AssetType
  /** 是否已通过节点右键“保存到资产库”收录。 */
  savedToLibrary?: boolean
  /** 资产库自动分类。 */
  category?: AssetCategory
  /** 相对 workspace 的路径，如 outputs/2026-07-04/asset_001.png */
  path: string
  /** 生成该资产所使用的提示词（可选） */
  prompt?: string
  /** 产出该资产的节点 ID（可选） */
  sourceNodeId?: string
  /** 生成该资产所参考的上游资产 ID 列表（可选） */
  inputAssetIds?: string[]
  /** 产出该资产的 provider，如 jimeng（可选） */
  provider?: string
  /** 生成参数快照（可选） */
  params?: Record<string, unknown>
  /** 是否展示在首页精选作品区（可选） */
  showcase?: boolean
  /** 创建时间 ISO 字符串 */
  createdAt: string
}
