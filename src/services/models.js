export const DEFAULT_MODEL_VARIANT = "v26-flare";

export const MODEL_VERSIONS = [
  { id: "2.6", name: "GPT Image 2.6", tag: "最新" },
  { id: "2.5", name: "GPT Image 2.5", tag: "兼容" },
  { id: "2.0", name: "GPT Image 2.0", tag: "旧版" },
];

export const ASPECT_RATIOS = [
  "auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3",
  "21:9", "9:21", "2:1", "1:2", "5:4", "4:5", "3:1", "1:3",
];

export const RESOLUTIONS = ["1K", "2K", "4K"];
export const ECONOMY_ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:2", "2:3", "21:9", "4:3"];
export const LEGACY_KIE_HIGH_RES_UNSUPPORTED_RATIOS = ["5:4", "4:5", "3:1", "1:3", "9:21"];

export const MODEL_VARIANTS = [
  {
    id: "v26-flare",
    version: "2.6",
    family: "flare",
    name: "GPT Image 2.6 Flare",
    shortName: "Flare",
    tag: "极速迭代 · 推荐",
    shortTag: "极速",
    desc: "改进海报与商品图版式，适合快速探索构图与批量创作",
    providers: ["kie", "apimart"],
    kieText: "gpt-image-2-6/flare-text-to-image",
    kieImage: "gpt-image-2-6/flare-image-to-image",
    apimart: "gpt-image-2.6-flare",
  },
  {
    id: "v26-sunburst",
    version: "2.6",
    family: "sunburst",
    name: "GPT Image 2.6 Sunburst",
    shortName: "Sunburst",
    tag: "精细画质 · 一致重绘",
    shortTag: "精修",
    desc: "强化细节与多轮编辑一致性，适合商业精修和多参考图创作",
    providers: ["kie", "apimart"],
    kieText: "gpt-image-2-6/sunburst-text-to-image",
    kieImage: "gpt-image-2-6/sunburst-image-to-image",
    apimart: "gpt-image-2.6-sunburst",
  },
  {
    id: "v26-economy",
    version: "2.6",
    family: "economy",
    name: "GPT Image 2.6 Economy",
    shortName: "Economy",
    tag: "高性价比 · 仅 1K",
    shortTag: "经济",
    desc: "KIE 专属高性价比模型，仅支持 1K 与 8 种画幅，适合大批量出图",
    providers: ["kie"],
    kieText: "gpt-image-2-6/economy-text-to-image",
    kieImage: "gpt-image-2-6/economy-image-to-image",
    apimart: null,
  },
  {
    id: "flare",
    version: "2.5",
    family: "flare",
    name: "GPT Image 2.5 Flare",
    shortName: "Flare",
    tag: "前代极速",
    shortTag: "极速",
    desc: "2.5 快速模型，保留用于历史任务与版本对照",
    providers: ["kie", "apimart"],
    kieText: "gpt-image-2-5-flare-text-to-image",
    kieImage: "gpt-image-2-5-flare-image-to-image",
    apimart: "gpt-image-2.5-flare",
  },
  {
    id: "sunburst",
    version: "2.5",
    family: "sunburst",
    name: "GPT Image 2.5 Sunburst",
    shortName: "Sunburst",
    tag: "前代精修",
    shortTag: "精修",
    desc: "2.5 精细模型，保留用于历史任务与版本对照",
    providers: ["kie", "apimart"],
    kieText: "gpt-image-2-5-sunburst-text-to-image",
    kieImage: "gpt-image-2-5-sunburst-image-to-image",
    apimart: "gpt-image-2.5-sunburst",
  },
  {
    id: "v2",
    version: "2.0",
    family: "legacy",
    name: "GPT Image 2",
    shortName: "Classic",
    tag: "历史兼容",
    shortTag: "经典",
    desc: "2.0 版本经典模型，供历史任务与特定需求对照",
    providers: ["kie", "apimart"],
    kieText: "gpt-image-2-text-to-image",
    kieImage: "gpt-image-2-image-to-image",
    apimart: "gpt-image-2",
  },
];

export function findModelVariant(modelVariant) {
  const value = String(modelVariant || "").trim().toLowerCase();
  return MODEL_VARIANTS.find((model) =>
    [model.id, model.kieText, model.kieImage, model.apimart]
      .filter(Boolean)
      .some((identifier) => identifier.toLowerCase() === value)
  );
}

export function getModelVariant(modelVariant) {
  return findModelVariant(modelVariant) || findModelVariant(DEFAULT_MODEL_VARIANT);
}

export function getDefaultModelVariant(provider = "kie", version = "2.6") {
  return MODEL_VARIANTS.find((model) => model.version === version && model.providers.includes(provider))
    || MODEL_VARIANTS.find((model) => model.providers.includes(provider))
    || findModelVariant(DEFAULT_MODEL_VARIANT);
}

export function resolveProviderModel(modelVariant, provider, hasInputUrls = false) {
  const model = findModelVariant(modelVariant);
  if (!model || !model.providers.includes(provider)) return null;
  if (provider === "apimart") return model.apimart;
  return hasInputUrls ? model.kieImage : model.kieText;
}

export function validateModelOptions({ provider = "kie", modelVariant, aspectRatio = "auto", resolution = "1K" }) {
  const model = findModelVariant(modelVariant);
  if (!model) throw new Error("未识别的模型，请重新选择模型版本。");
  if (!model.providers.includes(provider)) {
    throw new Error(`${model.name} 目前仅支持 KIE.ai 通道，API Mart 请选择 Flare 或 Sunburst。`);
  }

  const normalizedResolution = String(resolution || "1K").toUpperCase();
  if (!ASPECT_RATIOS.includes(aspectRatio)) throw new Error("不支持的图片比例。");
  if (!RESOLUTIONS.includes(normalizedResolution)) throw new Error("不支持的清晰度。");

  if (model.family === "economy") {
    if (normalizedResolution !== "1K") throw new Error("GPT Image 2.6 Economy 仅支持 1K 分辨率。");
    if (!ECONOMY_ASPECT_RATIOS.includes(aspectRatio)) {
      throw new Error("Economy 仅支持 auto、1:1、16:9、9:16、3:2、2:3、21:9、4:3 画幅。");
    }
  } else if (
    provider === "kie" && model.version === "2.5" && normalizedResolution !== "1K"
    && LEGACY_KIE_HIGH_RES_UNSUPPORTED_RATIOS.includes(aspectRatio)
  ) {
    throw new Error(`KIE 的 GPT Image 2.5 在 ${normalizedResolution} 下不支持 ${aspectRatio}，请选择 1K、其他画幅或 GPT Image 2.6。`);
  }

  return { model, aspectRatio, resolution: normalizedResolution };
}

export function buildKieInput({ prompt, modelVariant, inputUrls = [], aspectRatio = "auto", resolution = "1K" }) {
  const options = validateModelOptions({ provider: "kie", modelVariant, aspectRatio, resolution });
  const input = { prompt, aspect_ratio: options.aspectRatio };
  if (options.model.family !== "economy") input.resolution = options.resolution;
  if (inputUrls.length) input.input_urls = inputUrls;
  return input;
}
