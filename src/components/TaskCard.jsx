import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  Download,
  ZoomIn,
  RefreshCw,
} from "lucide-react";

export default function TaskCard({ task, onOpenLightbox, onRetry }) {
  const isSuccess = task.status === "success";
  const isFail = task.status === "fail";
  const isLoading = ["uploading", "creating", "waiting"].includes(task.status);

  const getStatusBadge = () => {
    switch (task.status) {
      case "success":
        return { label: "渲染完成", icon: CheckCircle2, className: "status-success" };
      case "fail":
        return { label: "生成失败", icon: AlertCircle, className: "status-fail" };
      case "uploading":
        return { label: "准备参考图", icon: Loader2, className: "status-loading" };
      case "creating":
        return { label: "提交任务", icon: Loader2, className: "status-loading" };
      case "waiting":
        return { label: "渲染中", icon: Loader2, className: "status-loading" };
      default:
        return { label: "排队中", icon: Clock, className: "status-queued" };
    }
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  const modelBadgeText = () => {
    const m = String(task.model || "").toLowerCase();
    if (m.includes("sunburst")) return "2.5 Sunburst";
    if (m.includes("flare") || m.includes("2-5")) return "2.5 Flare";
    return "2.0 Legacy";
  };

  return (
    <article className={`task-card ${task.status}${isLoading ? " is-loading" : ""}`}>
      {/* Subtle progress shimmer indicator */}
      {isLoading && <div className="task-card-progress-bar" />}

      {/* Card Header */}
      <div className="task-card-header">
        <div className="card-header-left">
          <p className="card-prompt" title={task.prompt}>
            {task.sourceName ? `[${task.sourceName}] ` : ""}
            {task.prompt}
          </p>

          <div className="card-tag-strip">
            <span className="badge-pill model-badge">{modelBadgeText()}</span>
            <span className="badge-pill">{task.aspectRatio || "auto"}</span>
            <span className="badge-pill">{task.resolution || "1K"}</span>
            <span className="badge-pill provider-badge">
              {task.provider === "apimart" ? "API Mart" : "KIE"}
            </span>
            {task.taskId && (
              <span className="badge-pill id-badge" title={task.taskId}>
                #{task.taskId.slice(-6)}
              </span>
            )}
            {task.retryCount > 0 && (
              <span className="badge-pill retry-badge">重试 {task.retryCount}</span>
            )}
          </div>
        </div>

        <div className={`status-pill ${statusInfo.className}`}>
          <StatusIcon size={13} className={isLoading ? "spin" : ""} />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Input Reference Previews (if any) */}
      {task.inputPreviews?.length > 0 && (
        <div className="task-input-strip">
          <span className="strip-label">参考图</span>
          <div className="strip-images">
            {task.inputPreviews.slice(0, 8).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`参考图 ${i + 1}`}
                className="input-strip-thumb"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ))}
            {task.inputPreviews.length > 8 && (
              <span className="strip-more">+{task.inputPreviews.length - 8}</span>
            )}
          </div>
        </div>
      )}

      {/* Result Images or Loading Placeholder */}
      <div className="task-content-body">
        {isSuccess && task.resultUrls?.length > 0 ? (
          <div className="results-grid">
            {task.resultUrls.map((imgUrl, idx) => (
              <figure key={idx} className="result-figure">
                <div
                  className="figure-img-container"
                  onClick={() => onOpenLightbox(imgUrl, task)}
                >
                  <img src={imgUrl} alt={`生成图 ${idx + 1}`} className="result-img" loading="lazy" />
                  <div className="figure-hover-overlay">
                    <span className="zoom-hint">
                      <ZoomIn size={15} /> 查看大图
                    </span>
                  </div>
                </div>
                <figcaption className="figure-actions">
                  <button
                    type="button"
                    className="action-link-btn"
                    onClick={() => onOpenLightbox(imgUrl, task)}
                  >
                    <ZoomIn size={13} /> 预览
                  </button>
                  <a
                    href={imgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="action-link-btn"
                  >
                    <ExternalLink size={13} /> 原图
                  </a>
                  <a
                    href={`/api/download-image?url=${encodeURIComponent(imgUrl)}`}
                    download
                    className="action-link-btn primary"
                  >
                    <Download size={13} /> 保存
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : isFail ? (
          <div className="task-failure-box">
            <AlertCircle size={20} className="fail-icon" />
            <div className="fail-content">
              <strong className="fail-title">任务生成失败</strong>
              <p className="fail-desc">{task.error || "远程服务返回异常，请检查网络或稍后重试。"}</p>
              {task.failCode && (
                <code className="fail-code">错误码: {task.failCode}</code>
              )}
            </div>
            {onRetry && (
              <button
                type="button"
                className="retry-task-btn"
                onClick={() => onRetry(task)}
              >
                <RefreshCw size={12} /> 重新提交
              </button>
            )}
          </div>
        ) : (
          <div className="task-loading-box">
            <Loader2 size={24} className="spin loading-spinner" />
            <strong className="loading-step-text">
              {task.activeStep || "已提交至渲染集群，等待出图中..."}
            </strong>
            <span className="loading-sub-text">
              2.5 Flare 预计 6~12 秒 · Sunburst 预计 18~30 秒
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
