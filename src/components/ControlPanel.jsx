import React, { useState } from "react";
import {
  Zap,
  Sun,
  Layers,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ImageDropzone from "./ImageDropzone";
import { MODEL_VARIANTS, ASPECT_RATIOS, RESOLUTIONS } from "../services/api";

const PROMPT_ENHANCEMENT_TAGS = [
  "电影级光影",
  "自然柔光",
  "8K超清",
  "商业静物",
  "大师水彩",
  "虚幻5渲染",
  "极简美学",
  "复古胶片",
];

const MODES = [
  { id: "text", name: "文生图" },
  { id: "multi", name: "多图参考" },
  { id: "batch", name: "批量独立" },
];

const PRIMARY_RATIOS = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const EXTENDED_RATIOS = ["21:9", "9:21", "2:1", "1:2", "5:4", "4:5", "3:1", "1:3"];

export default function ControlPanel({
  provider = "kie",
  modelVariant,
  setModelVariant,
  mode,
  setMode,
  prompt,
  setPrompt,
  images,
  setImages,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  generationCount,
  setGenerationCount,
  batchConcurrency,
  setBatchConcurrency,
  isGenerating,
  onGenerate,
  errorMessage,
  setErrorMessage,
}) {
  const isImageMode = mode !== "text";
  const [showMoreRatios, setShowMoreRatios] = useState(() => EXTENDED_RATIOS.includes(aspectRatio));

  const handleAppendTag = (tag) => {
    if (!prompt.includes(tag)) {
      setPrompt((prev) => (prev ? `${prev}，${tag}` : tag));
    }
  };

  const renderRatioButton = (ratio) => {
    const isUnsupported =
      provider === "kie" &&
      (resolution === "2K" || resolution === "4K") &&
      ["5:4", "4:5", "3:1", "1:3", "9:21"].includes(ratio);
    const isSelected = aspectRatio === ratio;
    return (
      <button
        key={ratio}
        type="button"
        disabled={isUnsupported}
        title={isUnsupported ? "KIE 在 2K/4K 下暂不支持此比例" : ratio}
        className={`ratio-chip ${isSelected ? "selected" : ""} ${isUnsupported ? "unsupported" : ""}`}
        onClick={() => !isUnsupported && setAspectRatio(ratio)}
      >
        {ratio}
      </button>
    );
  };

  return (
    <aside className="control-station" aria-label="控制面板">
      <div className="control-station-scroll">
        {/* Section 1: Model Selection */}
        <section className="station-section">
          <div className="section-title-row">
            <h2 className="section-title">模型版本</h2>
          </div>

          <div className="model-segmented-shelf" role="radiogroup" aria-label="模型版本选择">
            {MODEL_VARIANTS.map((m) => {
              const isSelected = modelVariant === m.id;
              const Icon = m.id === "flare" ? Zap : m.id === "sunburst" ? Sun : Layers;
              const tagLabel = m.id === "flare" ? "极速" : m.id === "sunburst" ? "旗舰" : "经典";

              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  title={m.desc}
                  className={`model-option-pill ${isSelected ? "selected" : ""}`}
                  onClick={() => setModelVariant(m.id)}
                >
                  <Icon size={13} className="model-pill-icon" />
                  <span className="model-pill-name">{m.name.replace("GPT Image ", "")}</span>
                  <span className="model-pill-tag">{tagLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Task Mode Tabs */}
        <section className="station-section">
          <div className="section-title-row">
            <h2 className="section-title">创作模式</h2>
          </div>

          <div className="mode-segmented" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={`mode-tab ${mode === m.id ? "active" : ""}`}
                onClick={() => {
                  setMode(m.id);
                  setErrorMessage("");
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </section>

        {/* Section 3: Prompt Studio */}
        <section className="station-section">
          <div className="section-title-row">
            <h2 className="section-title">提示词</h2>
            <span className="char-counter">{prompt.length} 字</span>
          </div>

          <div className="prompt-wrapper">
            <textarea
              className="tactile-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述画面主体、构图、光影细节与风格..."
              rows={3}
              maxLength={20000}
            />
            {prompt && (
              <button
                type="button"
                className="prompt-clear-btn"
                onClick={() => setPrompt("")}
                title="清空提示词"
              >
                清空
              </button>
            )}
          </div>

          {/* Quick aesthetic enhancement tags */}
          <div className="prompt-tags-shelf">
            <span className="tags-label">灵感</span>
            <div className="tags-scroll">
              {PROMPT_ENHANCEMENT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="prompt-tag-chip"
                  onClick={() => handleAppendTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Reference Images (Shown conditionally when in image-based mode) */}
        {isImageMode ? (
          <section className="station-section">
            <div className="section-title-row">
              <h2 className="section-title">参考图像</h2>
              <span className="section-hint">
                {images.length > 0 ? `已选 ${images.length} 张` : "支持多张参考"}
              </span>
            </div>

            <ImageDropzone
              images={images}
              setImages={setImages}
              disabled={false}
              provider={provider}
              onError={(msg) => setErrorMessage(msg)}
            />
          </section>
        ) : (
          <div className="text-mode-ref-shortcut" onClick={() => setMode("multi")}>
            <span>需要垫图或参考图？点击切换至「多图参考」</span>
          </div>
        )}

        {/* Section 5: Output Specifications */}
        <section className="station-section">
          <div className="section-title-row">
            <h2 className="section-title">画幅与规格</h2>
          </div>

          <div className="settings-stack">
            {/* Aspect ratio chips */}
            <div className="setting-block">
              <div className="setting-label-row">
                <label className="setting-label">画幅比例</label>
                {provider === "kie" && (resolution === "2K" || resolution === "4K") && (
                  <span className="setting-subhint">灰显为当前分辨率暂不支持</span>
                )}
              </div>

              {/* Primary 4-column ratio grid */}
              <div className="ratio-chip-grid">
                {PRIMARY_RATIOS.map(renderRatioButton)}
              </div>

              {/* Extended ratio dropdown/toggle */}
              <button
                type="button"
                className="ratio-expand-btn"
                onClick={() => setShowMoreRatios(!showMoreRatios)}
              >
                <span>{showMoreRatios ? "收起扩展比例" : "更多比例 (21:9, 5:4, 3:1...)"}</span>
                {showMoreRatios ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showMoreRatios && (
                <div className="ratio-chip-grid extended">
                  {EXTENDED_RATIOS.map(renderRatioButton)}
                </div>
              )}
            </div>

            {/* Resolution & Count row */}
            <div className="setting-row">
              <div className="setting-col">
                <label className="setting-label">分辨率</label>
                <div className="resolution-segmented">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res}
                      type="button"
                      className={`res-btn ${resolution === res ? "selected" : ""}`}
                      onClick={() => setResolution(res)}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "batch" ? (
                <div className="setting-col">
                  <label className="setting-label">批量并发</label>
                  <div className="number-stepper">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setBatchConcurrency(Math.max(1, batchConcurrency - 1))}
                      disabled={batchConcurrency <= 1}
                      aria-label="减少并发数"
                    >
                      -
                    </button>
                    <span className="stepper-val">{batchConcurrency}</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setBatchConcurrency(Math.min(8, batchConcurrency + 1))}
                      disabled={batchConcurrency >= 8}
                      aria-label="增加并发数"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="setting-col">
                  <label className="setting-label">生成数量</label>
                  <div className="number-stepper">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setGenerationCount(Math.max(1, generationCount - 1))}
                      disabled={generationCount <= 1}
                      aria-label="减少生成数量"
                    >
                      -
                    </button>
                    <span className="stepper-val">{generationCount} 张</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setGenerationCount(Math.min(8, generationCount + 1))}
                      disabled={generationCount >= 8}
                      aria-label="增加生成数量"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Primary Action Station */}
      <div className="station-action-bar">
        {errorMessage && (
          <div className="action-error-banner" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="button"
          className={`primary-generate-btn ${isGenerating ? "loading" : ""}`}
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="spin" size={17} />
              <span>正在渲染生成中...</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>生成图片</span>
              <kbd className="shortcut-kbd">Ctrl+↵</kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
