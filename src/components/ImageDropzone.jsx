import React, { useRef, useState } from "react";
import { UploadCloud, Link2, Trash2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { formatBytes, getProviderMaxFileSize } from "../services/api";

export default function ImageDropzone({
  images,
  setImages,
  disabled,
  provider = "kie",
  onError,
}) {
  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const maxBytes = getProviderMaxFileSize(provider);

  const handleFiles = (fileList) => {
    if (disabled) return;
    const newItems = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) {
        onError?.(`文件「${file.name}」不是图片格式，已过滤`);
        continue;
      }
      if (file.size > maxBytes) {
        onError?.(`文件「${file.name}」超过 ${formatBytes(maxBytes)} 限制，已跳过`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "file",
        file,
        name: file.name,
        size: file.size,
        previewUrl,
      });
    }

    if (newItems.length > 0) {
      setImages((prev) => [...prev, ...newItems]);
    }
  };

  const handleAddUrls = () => {
    if (disabled || !urlInput.trim()) return;
    const urls = urlInput
      .split(/\s+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

    if (urls.length === 0) {
      onError?.("请输入有效的 HTTP 或 HTTPS 图片网址");
      return;
    }

    const newItems = urls.map((u, i) => ({
      id: `url-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "url",
      remoteUrl: u,
      name: `参考图 URL (${i + 1})`,
      size: 0,
      previewUrl: u,
    }));

    setImages((prev) => [...prev, ...newItems]);
    setUrlInput("");
  };

  const handleRemove = (id) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  return (
    <div className={`dropzone-station ${disabled ? "is-disabled" : ""}`}>
      {/* File Drop Area */}
      <div
        className={`tactile-dropzone ${isDragOver ? "drag-over" : ""}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled && e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-disabled={disabled}
      >
        <UploadCloud size={20} className="dropzone-icon" />
        <div className="dropzone-text">
          <strong>{disabled ? "文生图无需参考图" : "拖拽图片至此，或点击上传"}</strong>
          <span>支持 JPG / PNG / WebP · 单张 ≤ {formatBytes(maxBytes)} · 最多 16 张</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* URL Import Row (Collapsible) */}
      {!disabled && (
        <div className="url-import-shelf">
          {showUrlInput ? (
            <div className="url-import-row">
              <div className="url-input-wrapper">
                <Link2 size={13} className="url-icon" />
                <input
                  type="text"
                  className="url-input"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUrls()}
                  placeholder="粘贴图片直链 (HTTP/HTTPS)..."
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="tactile-btn small"
                onClick={handleAddUrls}
                disabled={!urlInput.trim()}
              >
                导入
              </button>
              <button
                type="button"
                className="url-close-btn"
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlInput("");
                }}
                title="取消"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="url-expand-toggle"
              onClick={() => setShowUrlInput(true)}
            >
              <Link2 size={12} />
              <span>+ 导入网络图片直链</span>
            </button>
          )}
        </div>
      )}

      {/* Thumbnails list */}
      {images.length > 0 && (
        <div className="reference-gallery">
          <div className="gallery-header">
            <span className="gallery-title">已选参考图 ({images.length})</span>
            <button
              type="button"
              className="gallery-clear-all"
              onClick={() => {
                images.forEach((item) => {
                  if (item.previewUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(item.previewUrl);
                  }
                });
                setImages([]);
              }}
            >
              全部移除
            </button>
          </div>

          <div className="gallery-grid">
            {images.map((item, idx) => (
              <div key={item.id} className="reference-card">
                <div className="card-thumb-wrapper">
                  <img src={item.previewUrl} alt={item.name} className="card-thumb" />
                  <span className="card-index-badge">{idx + 1}</span>
                  <button
                    type="button"
                    className="card-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    title="移除图片"
                    aria-label="移除参考图"
                  >
                    ×
                  </button>
                </div>
                <div className="card-info">
                  <span className="card-name" title={item.name}>{item.name}</span>
                  <span className="card-size">
                    {item.kind === "file" ? formatBytes(item.size) : "网络直链"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
