import React, { useState } from "react";
import {
  Sparkles,
  History,
  Terminal,
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import TaskCard from "./TaskCard";
import HistoryViewer from "./HistoryViewer";
import LogViewer from "./LogViewer";

export default function ResultPanel({
  tasks,
  onRetryTask,
  provider,
}) {
  const [activeTab, setActiveTab] = useState("live"); // 'live' | 'history' | 'logs'
  const [lightboxData, setLightboxData] = useState(null); // { url, task }
  const [copied, setCopied] = useState(false);

  const totalTasks = tasks.length;
  const runningTasks = tasks.filter((t) => ["uploading", "creating", "waiting"].includes(t.status)).length;
  const successTasks = tasks.filter((t) => t.status === "success").length;
  const failedTasks = tasks.filter((t) => t.status === "fail").length;

  const handleOpenLightbox = (url, task) => {
    setLightboxData({ url, task });
    setCopied(false);
  };

  const handleCloseLightbox = () => {
    setLightboxData(null);
  };

  const handleCopyPrompt = () => {
    if (lightboxData?.task?.prompt) {
      navigator.clipboard.writeText(lightboxData.task.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="result-station" aria-label="生成结果与画廊">
      {/* Studio Showcase Header */}
      <div className="result-station-header">
        <div className="header-view-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "live"}
            className={`view-tab ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            <Sparkles size={14} />
            <span>实时画布</span>
            {runningTasks > 0 && <span className="tab-badge pulse">{runningTasks}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`view-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <History size={14} />
            <span>历史图库</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "logs"}
            className={`view-tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <Terminal size={14} />
            <span>日志</span>
          </button>
        </div>

        {/* Live Counters */}
        <div className="stats-indicator">
          {runningTasks > 0 && (
            <span className="stat-pill-running">
              <span className="stat-dot-pulse" />
              <span>{runningTasks} 任务生成中</span>
            </span>
          )}
          {totalTasks > 0 && (
            <span className="stat-summary-tag">
              共 {totalTasks} 组 · {successTasks} 成功
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="result-station-body">
        {activeTab === "live" && (
          <div className="live-feed-container">
            {tasks.length === 0 ? (
              <div className="studio-empty-state">
                <div className="empty-icon-shield">
                  <ImageIcon size={28} className="empty-icon" />
                </div>
                <h3 className="empty-title">画板准备就绪</h3>
                <p className="empty-desc">
                  配置左侧模型与提示词，点击「生成图片」或按快捷键即可实时出图
                </p>
                <div className="empty-shortcut-hint">
                  <kbd className="kbd-pill">Ctrl</kbd> + <kbd className="kbd-pill">Enter</kbd> 快捷生成
                </div>
              </div>
            ) : (
              <div className="task-cards-list">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpenLightbox={handleOpenLightbox}
                    onRetry={onRetryTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="history-tab-pane">
            <HistoryViewer onOpenLightbox={handleOpenLightbox} />
          </div>
        )}

        {activeTab === "logs" && (
          <div className="logs-tab-pane">
            <LogViewer />
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxData && (
        <div className="lightbox-backdrop" onClick={handleCloseLightbox}>
          <div
            className="lightbox-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="lightbox-header">
              <div className="lightbox-meta">
                <strong className="lightbox-title">
                  {lightboxData.task?.title || "图像大图"}
                </strong>
                <span className="lightbox-sub">
                  {lightboxData.task?.resolution} · {lightboxData.task?.aspectRatio} ·{" "}
                  {lightboxData.task?.model || "GPT Image 2.5"}
                </span>
              </div>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={handleCloseLightbox}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="lightbox-image-stage">
              <img
                src={lightboxData.url}
                alt="高清原图"
                className="lightbox-image"
              />
            </div>

            <div className="lightbox-footer">
              <p className="lightbox-prompt">
                <strong>提示词：</strong> {lightboxData.task?.prompt}
              </p>
              <div className="lightbox-actions">
                <button
                  type="button"
                  className="tactile-btn small"
                  onClick={handleCopyPrompt}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "已复制" : "复制提示词"}</span>
                </button>
                <a
                  href={lightboxData.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tactile-btn small"
                >
                  <ExternalLink size={13} />
                  <span>新窗口查看</span>
                </a>
                <a
                  href={`/api/download-image?url=${encodeURIComponent(lightboxData.url)}`}
                  download
                  className="tactile-btn small primary"
                >
                  <Download size={13} />
                  <span>下载原图</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
