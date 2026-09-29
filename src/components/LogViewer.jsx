import React, { useState, useEffect } from "react";
import { Terminal, RefreshCw, AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react";
import { fetchDbLogs } from "../services/api";

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchDbLogs(24);
      setLogs(data);
    } catch {
      // silently fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter === "all") return true;
    return log.level === levelFilter;
  });

  return (
    <div className="log-viewer-station">
      <div className="log-viewer-header">
        <div className="log-header-left">
          <Terminal size={15} />
          <strong>运行日志与状态流</strong>
          <span className="log-count">({filteredLogs.length} 条)</span>
        </div>

        <div className="log-header-actions">
          <div className="log-filter-tabs">
            {["all", "info", "warn", "error"].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`filter-chip ${levelFilter === lvl ? "active" : ""}`}
                onClick={() => setLevelFilter(lvl)}
              >
                {lvl === "all" ? "全部" : lvl.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="log-refresh-btn"
            onClick={loadLogs}
            disabled={loading}
            title="刷新日志"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      <div className="log-terminal-window">
        {filteredLogs.length === 0 ? (
          <div className="log-empty-state">
            <span>暂无运行日志条目</span>
          </div>
        ) : (
          <ul className="log-entry-list">
            {filteredLogs.map((entry, idx) => {
              const LevelIcon =
                entry.level === "error"
                  ? AlertCircle
                  : entry.level === "warn"
                  ? AlertTriangle
                  : Info;
              return (
                <li key={idx} className={`log-entry ${entry.level || "info"}`}>
                  <span className="entry-time">
                    {entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : "--:--:--"}
                  </span>
                  <span className={`entry-badge ${entry.level}`}>
                    <LevelIcon size={11} /> {entry.level || "INFO"}
                  </span>
                  {entry.taskId && (
                    <span className="entry-task-id">{entry.taskId.slice(0, 14)}</span>
                  )}
                  <span className="entry-message">
                    {entry.message || entry.status || "无详细描述"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
