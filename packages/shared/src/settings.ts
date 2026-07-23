// 即梦 Flow 工作台 - Settings 数据模型
// 参考 PRD 11.3 节、第 8.6 节、第 7.1 节
// 本地工具，配置以明文 JSON 形式存储在 workspace/config/settings.json（已加入 .gitignore）。

/** 旧 HTTP 适配器鉴权方式（保留用于兼容已有配置） */
export type AuthMode = "apiKey" | "cookie" | "token";

export type ModelCapability = "chat" | "image" | "video";

export type ModelProvider =
  | "dreamina"
  | "codex"
  | "openai-compatible"
  | "kimi"
  | "kimi-coding"
  | "deepseek"
  | "custom";

/** 带来源和能力的模型配置，用于逐步替代旧的字符串数组模型列表。 */
export interface ModelConfig {
  id: string;
  label?: string;
  provider?: ModelProvider | string;
  capabilities: ModelCapability[];
  enabled?: boolean;
}

const MODEL_CAPABILITY_SET = new Set<ModelCapability>([
  "chat",
  "image",
  "video",
]);
const CODEX_IMAGE_MODEL_ID = "codex:gpt-5.5";

function normalizeCapabilities(value: unknown): ModelCapability[] {
  const raw = Array.isArray(value) ? value : [value];
  const capabilities = raw.filter(
    (item): item is ModelCapability =>
      typeof item === "string" &&
      MODEL_CAPABILITY_SET.has(item as ModelCapability),
  );
  return Array.from(new Set(capabilities));
}

export function normalizeModelConfigs(value: unknown): ModelConfig[] {
  if (!Array.isArray(value)) return [];

  const map = new Map<string, ModelConfig>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const rawId = typeof raw.id === "string" ? raw.id.trim() : "";
    const id = normalizeLegacyModelId(rawId);
    if (!id) continue;
    const legacyOpenAiCliId = !!rawId && id !== rawId;

    const capabilities = normalizeCapabilities(raw.capabilities);
    if (capabilities.length === 0) continue;

    const previous = map.get(id);
    const mergedCapabilities = previous
      ? Array.from(new Set([...previous.capabilities, ...capabilities]))
      : capabilities;
    const next: ModelConfig = {
      id,
      capabilities: mergedCapabilities,
    };

    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
    if (!legacyOpenAiCliId && (label || previous?.label)) {
      next.label = label || previous?.label;
    }
    if (provider || previous?.provider) next.provider = provider || previous?.provider;
    if (raw.enabled === false || previous?.enabled === false) next.enabled = false;

    map.set(id, next);
  }

  return Array.from(map.values());
}

export function getModelConfigsByCapability(
  modelConfigs: unknown,
  capability: ModelCapability,
): ModelConfig[] {
  return normalizeModelConfigs(modelConfigs).filter(
    (model) =>
      model.enabled !== false &&
      model.capabilities.includes(capability),
  );
}

function normalizeLegacyModelId(modelId: string): string {
  const id = modelId.trim();
  const normalized = id.toLowerCase();
  return normalized === "$imagegen" || normalized === "gpt-image-2"
    ? CODEX_IMAGE_MODEL_ID
    : id;
}

function uniqueLegacyModelIds(models: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => normalizeLegacyModelId(model ?? ""))
        .filter(Boolean),
    ),
  );
}

function isLikelyLegacyImageModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("image") ||
    id.includes("imagen") ||
    id.includes("banana") ||
    id.includes("gpt-image") ||
    id.includes("dall-e") ||
    id.includes("flux") ||
    id.includes("sdxl") ||
    id.includes("stable-diffusion") ||
    id.includes("seedream")
  );
}

function isLikelyLegacyVideoModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("video") ||
    id.includes("veo") ||
    id.includes("kling") ||
    id.includes("seedance") ||
    id.includes("runway") ||
    id.includes("pika") ||
    id.includes("luma") ||
    id.includes("hailuo")
  );
}

function inferProviderForModel(
  modelId: string,
  capability: ModelCapability,
): ModelProvider {
  const id = modelId.toLowerCase();
  if (capability === "chat") {
    if (id.startsWith("codex:")) return "codex";
    if (id === "k3" || id.startsWith("kimi-for-coding")) return "kimi-coding";
    if (id.startsWith("kimi-")) return "kimi";
    if (id.startsWith("deepseek-")) return "deepseek";
  }
  if (capability === "image") {
    if (id === "gpt-image-2" || id.startsWith("codex:")) return "codex";
    if (id.startsWith("jimeng")) return "dreamina";
  }
  if (capability === "video") {
    if (id.includes("seedance") || id.startsWith("jimeng")) return "dreamina";
  }
  return "openai-compatible";
}

function addModelConfig(
  map: Map<string, ModelConfig>,
  modelId: string,
  capability: ModelCapability,
  provider: ModelProvider,
): void {
  const id = normalizeLegacyModelId(modelId);
  if (!id) return;
  const previous = map.get(id);
  const capabilities = previous
    ? Array.from(new Set([...previous.capabilities, capability]))
    : [capability];
  map.set(id, {
    id,
    label: previous?.label,
    provider: previous?.provider || provider,
    capabilities,
    ...(previous?.enabled === false ? { enabled: false } : {}),
  });
}

export function buildModelConfigsFromSettings(
  settings: Partial<Settings>,
): ModelConfig[] {
  const map = new Map<string, ModelConfig>();

  for (const model of normalizeModelConfigs(settings.modelConfigs)) {
    map.set(model.id, model);
  }

  const chatModelIds = uniqueLegacyModelIds([
    ...(settings.llmModels ?? []),
    settings.llmModel,
  ]).filter(
    (modelId) =>
      !isLikelyLegacyImageModel(modelId) &&
      !isLikelyLegacyVideoModel(modelId),
  );
  for (const modelId of chatModelIds) {
    addModelConfig(map, modelId, "chat", inferProviderForModel(modelId, "chat"));
  }

  const imageModelIds = uniqueLegacyModelIds([
    ...(settings.imageModels ?? []),
    settings.defaultModel,
  ]);
  for (const modelId of imageModelIds) {
    addModelConfig(
      map,
      modelId,
      "image",
      inferProviderForModel(modelId, "image"),
    );
  }

  const videoModelIds = uniqueLegacyModelIds([
    ...(settings.videoModels ?? []),
    settings.defaultVideoModel,
  ]);
  for (const modelId of videoModelIds) {
    addModelConfig(
      map,
      modelId,
      "video",
      inferProviderForModel(modelId, "video"),
    );
  }

  return Array.from(map.values());
}

/** 可在设置中实时切换并持久化的全局皮肤。 */
export const CANVAS_THEMES = [
  "dark",
  "light",
  "starry-night",
  "turner-mist",
  "hokusai-indigo",
  "monet-lilac",
] as const;

export type CanvasTheme = (typeof CANVAS_THEMES)[number];

export function normalizeCanvasTheme(value: unknown): CanvasTheme {
  return typeof value === "string" &&
    (CANVAS_THEMES as readonly string[]).includes(value)
    ? (value as CanvasTheme)
    : "dark";
}

/** 全局 Settings 配置 */
export interface Settings {
  /** 旧 HTTP 适配器服务地址（保留用于兼容已有配置） */
  jimengBaseUrl: string;
  /** 鉴权方式 */
  authMode: AuthMode;
  /** 旧 HTTP 适配器 API key / cookie / token 明文（本地工具） */
  apiKey: string;
  /** 即梦官方 CLI 可执行文件路径；默认通过 PATH 查找 dreamina */
  dreaminaPath: string;

  /** 中转站或 OpenAI-compatible LLM 服务地址 */
  llmBaseUrl: string;
  /** 默认 LLM 模型 */
  llmModel: string;
  /** 常用 LLM 模型列表；用于从中转站模型池中筛选日常可选项 */
  llmModels: string[];
  /** LLM API key */
  llmApiKey: string;

  /** Kimi 开放平台（按量付费）OpenAI-compatible 地址与密钥 */
  kimiBaseUrl: string;
  kimiApiKey: string;
  /** Kimi Coding Plan（会员权益）独立地址与密钥 */
  kimiCodingBaseUrl: string;
  kimiCodingApiKey: string;
  /** DeepSeek 开放平台地址与密钥 */
  deepseekBaseUrl: string;
  deepseekApiKey: string;

  /** 输出目录，相对项目根 */
  outputDir: string;
  /** 首页、画布、节点、面板和设置共用的全局皮肤 */
  canvasTheme: CanvasTheme;
  /** 首页封面背景图片 URL；留空时使用前端内置背景 */
  homeHeroImagePath?: string;
  /** 首页主图（MOK猫）URL；留空时使用前端内置默认图 */
  homeMokHeroImagePath?: string;
  /** 首页主图缩放比例 (0.4 - 1.6)，默认 1 */
  homeMokHeroScale?: number;
  /** 首页主图垂直偏移（像素，正数向下），默认 0 */
  homeMokHeroOffsetY?: number;
  /** 首页主图水平偏移（像素，正数向右），默认 0 */
  homeMokHeroOffsetX?: number;
  /** 首页主图上边距（像素），默认 4 */
  homeMokHeroMarginTop?: number;

  /** 旧版默认图片模型；保留字段兼容，前端不再用它决定新建节点默认值 */
  defaultModel: string;
  /** 常用图片模型列表；图片节点只显示这些常用即梦图片模型 */
  imageModels: string[];
  /** 默认图片尺寸，例如 1024x1024 */
  defaultSize: string;

  /** 旧版默认视频模型；保留字段兼容，前端不再用它决定新建节点默认值 */
  defaultVideoModel: string;
  /** 常用视频模型列表；视频节点和 Agent 视频生成只显示这些常用模型 */
  videoModels: string[];
  /** 默认视频比例，例如 16:9 */
  defaultVideoAspectRatio: string;
  /** 默认视频分辨率，例如 720P */
  defaultVideoResolution: string;
  /** 默认视频清晰度，例如 standard */
  defaultVideoQuality: string;
  /** 默认视频时长（秒） */
  defaultVideoDurationSeconds: number;
  /** 默认视频生成数量 */
  defaultVideoCount: number;
  /** 默认视频是否生成音频 */
  defaultVideoGenerateAudio: boolean;

  /** 结构化模型配置：逐步表达 provider + capability，兼容旧字符串数组。 */
  modelConfigs: ModelConfig[];
}

/** 默认 Settings 值（参考 PRD 11.3 与任务说明） */
export const DEFAULT_SETTINGS: Settings = {
  jimengBaseUrl: "",
  authMode: "apiKey",
  apiKey: "",
  dreaminaPath: "dreamina",

  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4o-mini",
  llmModels: ["gpt-4o-mini"],
  llmApiKey: "",
  kimiBaseUrl: "https://api.moonshot.cn/v1",
  kimiApiKey: "",
  kimiCodingBaseUrl: "https://api.kimi.com/coding/v1",
  kimiCodingApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekApiKey: "",

  outputDir: "./workspace/outputs",
  canvasTheme: "dark",
  homeHeroImagePath: "",
  homeMokHeroImagePath: "",
  homeMokHeroScale: 1,
  homeMokHeroOffsetX: 0,
  homeMokHeroOffsetY: 0,
  homeMokHeroMarginTop: 0,

  defaultModel: "",
  imageModels: ["jimeng"],
  defaultSize: "1024x1024",

  defaultVideoModel: "",
  videoModels: ["seedance-2.0"],
  defaultVideoAspectRatio: "16:9",
  defaultVideoResolution: "720P",
  defaultVideoQuality: "standard",
  defaultVideoDurationSeconds: 5,
  defaultVideoCount: 1,
  defaultVideoGenerateAudio: true,
  modelConfigs: [],
};
