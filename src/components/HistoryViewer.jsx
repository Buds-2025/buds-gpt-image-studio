import React, { useState, useEffect } from "react";
import {
  Search,
  History,
  ZoomIn,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Loader2,
  RefreshCw,
  Clock,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { fetchDbTasks, fetchDbTaskDetail } from "../services/api";

export default function HistoryViewer({ onOpenLightbox }) {
  const [historyList, setHistoryList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [queryError, setQueryError] = useState("");

  const loadHistory = async (q = queryText, status = statusFilter) => {
    setLoadingList(true);
    setQueryError("");
    try {
      const tasks = await fetchDbTasks({
        q: q.trim(),
        status: status === "all" ? "" : status,
        limit: 50,
      });
      setHistoryList(tasks);
      if (tasks.length > 0 && !selectedTask) {
        setSelectedTask(tasks[0]);
      }
    } catch (err) {
      setQueryError("读取历史任务失败：" + err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadHistory(queryText, statusFilter);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    loadHistory(queryText, statusFilter);
  };

  const handleSelectTask = async (task) => {
    setSelectedTask(task);
    try {
      const detail = await fetchDbTaskDetail(task.id);
      if (detail?.task) {
        setSelectedTask(detail.task);
      }
    } catch {
      // keep preview
    }
  };

  return (
    <div className="history-viewer-station">
      {/* Top Search and Filter Bar */}
      <div className="history-controls-strip">
        <form className="history-search-bar" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <History size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="搜索历史任务 ID、提示词或模型..."
            />
          </div>
          <button
            type="submit"
            className="search-btn"
            disabled={loadingList}
          >
            {loadingList ? <Loader2 className="spin" size={14} /> : <Search size={14} />}
            <span>搜索</span>
          </button>
        </form>

        <div className="history-filters-row">
          <div className="status-filter-group" role="tablist">
            {[
              { id: "all", label: "全部" },
              { id: "success", label: "已完成" },
              { id: "fail", label: "失败" },
              { id: "waiting", label: "生成中" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${statusFilter === f.id ? "active" : ""}`}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="log-refresh-btn"
            onClick={() => loadHistory(queryText, statusFilter)}
            disabled={loadingList}
            title="刷新历史记录"
          >
            <RefreshCw size={13} className={loadingList ? "spin" : ""} />
            <span>刷新库</span>
          </button>
        </div>
      </div>

      {queryError && (
        <div className="history-error-banner" role="alert">
          <AlertCircle size={15} />
          <span>{queryError}</span>
        </div>
      )}

      {/* Main Two-Pane View: Left Task List, Right Selected Detail */}
      <div className="history-layout-columns">
        {/* Left: History Items Master List */}
        <aside className="history-master-list" aria-label="往期任务列表">
          <div className="list-meta-header">
            <span>记录总数 ({historyList.length})</span>
            <span className="sub-hint">点击载入对应原图画廊</span>
          </div>

          {loadingList && historyList.length === 0 ? (
            <div className="history-loading-pane">
              <Loader2 size={20} className="spin" />
              <span>正在读取历史库...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="history-empty-list">
              <ImageIcon size={32} />
              <p>暂无符合条件的历史出图记录</p>
            </div>
          ) : (
            <div className="history-items-scroll">
              {historyList.map((item) => {
                const isSelected = selectedTask?.id === item.id;
                const hasImages = (item.result_urls?.length || 0) > 0;
                return (
                  <div
                    key={item.id}
                    className={`history-item-row ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectTask(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="item-row-top">
                      <span className="item-id-tag">{item.id.slice(0, 16)}...</span>
                      <span className={`item-status-dot ${item.status || "created"}`}>
                        {item.status === "success" ? "完成" : item.status === "fail" ? "失败" : "处理中"}
                      </span>
                    </div>

                    <p className="item-prompt-snippet" title={item.prompt}>
                      {item.prompt || "无提示词"}
                    </p>

                    <div className="item-row-meta">
                      <span className="meta-badge">{item.provider?.toUpperCase()}</span>
                      <span className="meta-badge">{item.model || "2.5"}</span>
                      <span className="meta-badge">{item.resolution || "1K"} · {item.aspect_ratio || "auto"}</span>
                      {hasImages && (
                        <span className="meta-badge has-img">
                          {item.result_urls.length} 图
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right: Selected Task Detail Stage */}
        <main className="history-detail-stage" aria-label="历史任务详情">
          {selectedTask ? (
            <div className="history-record-card">
              <div className="record-header">
                <div className="record-title-row">
                  <div className="title-left">
                    <strong className="record-id">本地编号：{selectedTask.id}</strong>
                    {selectedTask.remote_task_id && (
                      <span className="record-remote-id">
                        远程 ID：{selectedTask.remote_task_id}
                      </span>
                    )}
                  </div>
                  <span className={`record-status-badge ${selectedTask.status}`}>
                    {selectedTask.status === "success"
                      ? "生成成功"
                      : selectedTask.status === "fail"
                      ? "生成失败"
                      : "处理中"}
                  </span>
                </div>
                <p className="record-prompt">{selectedTask.prompt}</p>
              </div>

              <div className="record-meta-row">
                <span><strong>通道：</strong> {selectedTask.provider === "apimart" ? "API Mart" : "KIE.ai"}</span>
                <span><strong>模型：</strong> {selectedTask.model || "GPT Image 2.5"}</span>
                <span><strong>画幅比例：</strong> {selectedTask.aspect_ratio || "auto"}</span>
                <span><strong>分辨率：</strong> {selectedTask.resolution || "1K"}</span>
                {selectedTask.created_at && (
                  <span><strong>创建时间：</strong> {new Date(selectedTask.created_at).toLocaleString()}</span>
                )}
              </div>

              {selectedTask.result_urls?.length > 0 ? (
                <div className="record-images-grid">
                  {selectedTask.result_urls.map((url, i) => (
                    <figure key={i} className="record-image-item">
                      <div
                        className="record-thumb-container"
                        onClick={() => onOpenLightbox(url, selectedTask)}
                      >
                        <img
                          src={url}
                          alt={`历史原图 ${i + 1}`}
                          className="record-thumb"
                          loading="lazy"
                        />
                        <div className="thumb-hover-overlay">
                          <ZoomIn size={16} /> 点击大图预览
                        </div>
                      </div>
                      <figcaption className="record-img-actions">
                        <button
                          type="button"
                          className="record-action-btn"
                          onClick={() => onOpenLightbox(url, selectedTask)}
                        >
                          <ZoomIn size={12} /> 放大
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="record-action-btn"
                        >
                          <ExternalLink size={12} /> 原图直链
                        </a>
                        <a
                          href={`/api/download-image?url=${encodeURIComponent(url)}`}
                          download
                          className="record-action-btn primary"
                        >
                          <Download size={12} /> 下载
                        </a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : selectedTask.status === "fail" ? (
                <div className="record-fail-banner">
                  <AlertCircle size={20} />
                  <div>
                    <strong>此任务执行失败</strong>
                    <p>{selectedTask.error_message || selectedTask.fail_msg || "未返回可用图像结果"}</p>
                    {selectedTask.fail_code && <code>代码: {selectedTask.fail_code}</code>}
                  </div>
                </div>
              ) : (
                <div className="record-empty-images">
                  <Clock size={20} className="spin" />
                  <span>任务排队或渲染中，尚未生成结果图像。</span>
                </div>
              )}
            </div>
          ) : (
            <div className="history-empty-detail">
              <History size={40} className="empty-icon" />
              <h3>从左侧列表选择一项任务调取往期大图</h3>
              <p>系统已连接本地 SQLite 数据仓库，支持完整检索往期出图、提示词与渲染参数。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
