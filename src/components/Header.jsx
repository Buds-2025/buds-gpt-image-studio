import React, { useState } from "react";
import { KeyRound, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Sun, Moon, ExternalLink } from "lucide-react";
import { testKey, MODEL_VARIANTS } from "../services/api";

export default function Header({
  provider,
  setProvider,
  kieApiKey,
  setKieApiKey,
  apiMartApiKey,
  setApiMartApiKey,
  modelVariant,
  theme = "dark",
  setTheme,
}) {
  const [showKeys, setShowKeys] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeModel = MODEL_VARIANTS.find((m) => m.id === modelVariant) || MODEL_VARIANTS[0];
  const activeKey = provider === "apimart" ? apiMartApiKey : kieApiKey;

  const handleTestKey = async () => {
    if (!activeKey?.trim()) {
      setTestResult({ ok: false, message: `请先输入 ${provider === "apimart" ? "API Mart" : "KIE"} 密钥` });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testKey(provider, activeKey.trim(), modelVariant);
      setTestResult({
        ok: res.ok,
        message: res.ok ? "密钥校验通过，连接正常" : res.message || "密钥未通过校验，请核对",
      });
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "测试请求失败" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <header className="studio-header">
      <div className="header-brand">
        <div className="brand-logo-mark">
          <Sparkles className="brand-icon" size={16} />
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <h1 className="brand-title">GPT Image 2.5</h1>
            <span className="brand-badge">Studio</span>
          </div>
          <p className="brand-tagline">双引擎专业图像创作工作台</p>
        </div>
      </div>

      <div className="header-controls">
        {/* Model Indicator Chip */}
        <div className="model-chip" title={activeModel.desc}>
          <span className="model-chip-dot" />
          <span className="model-chip-name">{activeModel.name.replace("GPT Image ", "")}</span>
        </div>

        {/* Upstream Provider Switcher */}
        <div className="provider-tabs" role="tablist" aria-label="上游服务商选择">
          <button
            type="button"
            role="tab"
            aria-selected={provider === "kie"}
            className={`provider-tab ${provider === "kie" ? "active" : ""}`}
            onClick={() => {
              setProvider("kie");
              setTestResult(null);
            }}
          >
            KIE.ai
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={provider === "apimart"}
            className={`provider-tab ${provider === "apimart" ? "active" : ""}`}
            onClick={() => {
              setProvider("apimart");
              setTestResult(null);
            }}
          >
            API Mart
          </button>
        </div>

        {/* Theme Toggle Button */}
        {setTheme && (
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "切换至浅色模式" : "切换至深色模式"}
            aria-label="切换明暗主题"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            <span className="theme-toggle-label">{theme === "dark" ? "浅色" : "深色"}</span>
          </button>
        )}

        {/* API Key Station */}
        <div className="key-station">
          <button
            type="button"
            className={`key-toggle-btn ${activeKey?.trim() ? "has-key" : "no-key"}`}
            onClick={() => setShowKeys(!showKeys)}
            aria-label="配置 API 密钥"
          >
            <KeyRound size={14} />
            <span>{activeKey?.trim() ? "Key 已就绪" : "配置 Key"}</span>
          </button>

          {showKeys && (
            <div className="key-popover">
              <div className="key-popover-header">
                <span className="popover-title">API 密钥配置</span>
                <button
                  type="button"
                  className="popover-close-btn"
                  onClick={() => setShowKeys(false)}
                >
                  ×
                </button>
              </div>

              <div className="key-input-group">
                <label className="key-label">
                  <span>KIE.ai Key</span>
                  <a
                    href="https://kie.ai/api-key"
                    target="_blank"
                    rel="noreferrer"
                    className="key-link"
                  >
                    获取 Key <ExternalLink size={10} />
                  </a>
                </label>
                <div className="key-input-wrapper">
                  <input
                    type="password"
                    className="tactile-input"
                    value={kieApiKey}
                    onChange={(e) => setKieApiKey(e.target.value)}
                    placeholder="kie_live_..."
                    autoComplete="off"
                  />
                  {kieApiKey && (
                    <button
                      type="button"
                      className="inline-clear-btn"
                      onClick={() => setKieApiKey("")}
                      title="清空"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              <div className="key-input-group">
                <label className="key-label">
                  <span>API Mart Token</span>
                  <a
                    href="https://apimart.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="key-link"
                  >
                    获取 Token <ExternalLink size={10} />
                  </a>
                </label>
                <div className="key-input-wrapper">
                  <input
                    type="password"
                    className="tactile-input"
                    value={apiMartApiKey}
                    onChange={(e) => setApiMartApiKey(e.target.value)}
                    placeholder="Bearer token..."
                    autoComplete="off"
                  />
                  {apiMartApiKey && (
                    <button
                      type="button"
                      className="inline-clear-btn"
                      onClick={() => setApiMartApiKey("")}
                      title="清空"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              <div className="key-popover-footer">
                <button
                  type="button"
                  className="test-ping-btn"
                  onClick={handleTestKey}
                  disabled={testing}
                >
                  <RefreshCw size={13} className={testing ? "spin" : ""} />
                  {testing ? "测试连通性..." : "测试连接"}
                </button>
              </div>

              {testResult && (
                <div className={`key-test-feedback ${testResult.ok ? "success" : "fail"}`}>
                  {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
