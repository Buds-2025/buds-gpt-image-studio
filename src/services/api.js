/**
 * Unified API client for KIE.ai and API Mart.
 * Model identifiers and provider-specific constraints live in models.js.
 */
import {
  buildKieInput,
  resolveProviderModel,
  validateModelOptions,
} from "./models";

export * from "./models";

export const KIE_JOBS_BASE = "https://api.kie.ai/api/v1/jobs";
export const KIE_FILE_UPLOAD = "https://kieai.redpandaai.co/api/file-stream-upload";
export const KIE_FILE_URL_UPLOAD = "https://kieai.redpandaai.co/api/file-url-upload";
export const APIMART_BASE = "https://api.apimart.ai/v1";

export const MAX_FILE_SIZE = 30 * 1024 * 1024;
export const APIMART_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const POLL_INTERVAL_MS = 3500;
export const MAX_POLL_ATTEMPTS = 160;

export function getProviderMaxFileSize(provider) {
  return provider === "apimart" ? APIMART_MAX_FILE_SIZE : MAX_FILE_SIZE;
}

/**
 * Format bytes to readable string
 */
export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read File as Data URL (Base64)
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取本地图片失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generic safe fetch
 */
async function safeFetch(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    const error = new Error(`网络连接失败：${err.message}`);
    error.status = 0;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      data?.msg ||
      data?.message ||
      `请求失败（HTTP ${response.status}）`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Direct KIE file upload
 */
export async function kieUploadFile(file, apiKey) {
  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("uploadPath", "gpt-image-2-5-studio");
  formData.append("fileName", `${Date.now()}-${safeName}`);

  const res = await safeFetch(KIE_FILE_UPLOAD, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (res?.code && res.code !== 200 && res.code !== 0) {
    throw new Error(`KIE 上传失败：${res?.msg || res?.message || `code=${res.code}`}。请检查 API Key 状态。`);
  }

  const url =
    res?.data?.downloadUrl ||
    res?.data?.url ||
    res?.data?.fileUrl ||
    res?.downloadUrl ||
    res?.url ||
    (Array.isArray(res?.data?.files) ? res.data.files[0]?.url : "");

  if (!url) {
    throw new Error(`KIE 上传响应未包含下载链接：${JSON.stringify(res).slice(0, 160)}`);
  }

  return url;
}

/**
 * Direct KIE URL import
 */
export async function kieImportUrl(fileUrl, apiKey) {
  let baseName = "image.png";
  try {
    const p = new URL(fileUrl).pathname;
    baseName = (decodeURIComponent(p.split("/").pop()) || "image.png").replace(/[^\w.\-]/g, "_");
  } catch {}

  const res = await safeFetch(KIE_FILE_URL_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileUrl,
      uploadPath: "gpt-image-2-5-studio",
      fileName: `${Date.now()}-${baseName}`,
    }),
  });

  if (res?.code && res.code !== 200 && res.code !== 0) {
    throw new Error(`KIE URL 转存失败：${res?.msg || res?.message || `code=${res.code}`}。`);
  }

  const url =
    res?.data?.downloadUrl ||
    res?.data?.url ||
    res?.data?.fileUrl ||
    res?.downloadUrl ||
    res?.url;

  if (!url) {
    throw new Error(`KIE 转存响应未包含可用 URL：${JSON.stringify(res).slice(0, 160)}`);
  }

  return url;
}

/**
 * Direct KIE Create Task
 */
export async function kieCreateTask({ apiKey, prompt, modelVariant, inputUrls = [], aspectRatio = "auto", resolution = "1K" }) {
  const model = resolveProviderModel(modelVariant, "kie", inputUrls.length > 0);
  if (!model) throw new Error("当前模型不支持 KIE.ai 通道，请重新选择。");
  const requestBody = {
    model,
    input: buildKieInput({ prompt, modelVariant, inputUrls, aspectRatio, resolution }),
  };

  const res = await safeFetch(`${KIE_JOBS_BASE}/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (res?.code !== 200 || !res?.data?.taskId) {
    const msg = res?.msg || res?.message || "KIE 创建任务未返回有效的 taskId";
    const err = new Error(msg);
    err.provider = "kie";
    err.failCode = res?.code;
    err.failMsg = msg;
    throw err;
  }

  return {
    taskId: res.data.taskId,
    model,
    provider: "kie",
    payload: res,
  };
}

/**
 * Direct KIE Task Info Query
 */
export async function kieTaskInfo(apiKey, taskId) {
  const res = await safeFetch(`${KIE_JOBS_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res?.code !== 200) {
    const err = new Error(res?.msg || "KIE 查询任务失败");
    err.provider = "kie";
    err.failCode = res?.code;
    err.failMsg = res?.msg;
    throw err;
  }

  const data = res?.data || {};
  let resultUrls = [];
  if (data.resultJson) {
    try {
      const parsed = typeof data.resultJson === "string" ? JSON.parse(data.resultJson) : data.resultJson;
      resultUrls = parsed.resultUrls || parsed.urls || [];
    } catch {}
  }

  return {
    provider: "kie",
    taskId,
    state: data.state || "waiting", // waiting | success | fail
    resultUrls,
    failCode: data.failCode,
    failMsg: data.failMsg,
    raw: res,
  };
}

/**
 * Direct APIMart Create Task
 */
export async function apimartCreateTask({ apiKey, prompt, modelVariant, inputUrls = [], aspectRatio = "auto", resolution = "1K" }) {
  const { model: variant, resolution: normalizedResolution } = validateModelOptions({
    provider: "apimart", modelVariant, aspectRatio, resolution,
  });
  const model = variant.apimart;
  const requestBody = {
    model,
    prompt,
    n: 1,
    size: aspectRatio || "auto",
    resolution: normalizedResolution.toLowerCase(),
    official_fallback: true,
  };
  if (inputUrls.length > 0) {
    requestBody.image_urls = inputUrls;
  }

  const res = await safeFetch(`${APIMART_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const firstTask = Array.isArray(res?.data) ? res.data[0] : res?.data;
  const taskId = firstTask?.task_id || firstTask?.id;

  if (res?.code !== 200 || !taskId) {
    const msg = res?.error?.message || res?.msg || "API Mart 创建任务失败";
    const err = new Error(msg);
    err.provider = "apimart";
    err.failCode = res?.code;
    err.failMsg = msg;
    throw err;
  }

  return {
    taskId,
    model,
    provider: "apimart",
    payload: res,
  };
}

/**
 * Direct APIMart Task Info Query
 */
export async function apimartTaskInfo(apiKey, taskId) {
  const res = await safeFetch(`${APIMART_BASE}/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res?.code !== 200) {
    const err = new Error(res?.error?.message || res?.msg || "API Mart 查询失败");
    err.provider = "apimart";
    err.failCode = res?.code;
    err.failMsg = res?.error?.message || res?.msg;
    throw err;
  }

  const taskData = res?.data || {};
  const status = taskData.status || "submitted";
  const stateMap = {
    submitted: "waiting",
    processing: "waiting",
    completed: "success",
    failed: "fail",
  };

  const images = taskData.result?.images || [];
  const resultUrls = images.flatMap((img) => {
    if (Array.isArray(img?.url)) return img.url;
    if (typeof img?.url === "string") return [img.url];
    return [];
  });

  return {
    provider: "apimart",
    taskId,
    state: stateMap[status] || "waiting",
    resultUrls,
    failCode: taskData.error?.code || (status === "failed" ? "task_failed" : null),
    failMsg: taskData.error?.message || taskData.error || (status === "failed" ? "生成未成功完成" : null),
    raw: res,
  };
}

/**
 * Ping / Test Key
 */
export async function testKey(provider, apiKey, modelVariant) {
  const model = resolveProviderModel(modelVariant, provider, false);
  if (!model) throw new Error("当前模型不支持此通道，请重新选择。");
  try {
    const res = await safeFetch("/api/test-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-provider": provider,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ provider, model }),
    });
    return res;
  } catch {
    // If backend /api/test-key is not reachable (e.g. pure static hosting), test direct
    if (provider === "apimart") {
      const res = await safeFetch(`${APIMART_BASE}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: "ping",
          n: 1,
          size: "1:1",
          resolution: "1k",
          official_fallback: true,
        }),
      });
      return { ok: res?.code === 200, message: res?.code === 200 ? "API Key 校验通过" : "校验失败" };
    }
    const res = await safeFetch(`${KIE_JOBS_BASE}/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: buildKieInput({ prompt: "ping-key-test", modelVariant }),
      }),
    });
    return { ok: res?.code === 200, message: res?.code === 200 ? "API Key 校验通过" : "校验失败" };
  }
}

/**
 * Database Task Synchronization (Local Backend SQLite)
 */
export async function createDbTask(taskData) {
  try {
    const res = await safeFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });
    return res?.task;
  } catch (err) {
    console.warn("Local DB createTask sync skipped:", err.message);
    return null;
  }
}

export async function updateDbTask(taskId, patch) {
  if (!taskId) return null;
  try {
    const res = await safeFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res?.task;
  } catch (err) {
    console.warn("Local DB updateTask sync skipped:", err.message);
    return null;
  }
}

export async function recordDbEvent(taskId, eventData) {
  if (!taskId) return;
  try {
    await safeFetch(`/api/tasks/${encodeURIComponent(taskId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
  } catch (err) {
    console.warn("Local DB recordEvent sync skipped:", err.message);
  }
}

export async function fetchDbLogs(limit = 16) {
  try {
    const res = await safeFetch(`/api/logs?compact=1&limit=${limit}`);
    return res?.logs || [];
  } catch {
    return [];
  }
}

export async function fetchDbTaskDetail(taskId) {
  return await safeFetch(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export async function fetchDbTasks(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.limit) query.set("limit", String(params.limit));
    const res = await safeFetch(`/api/tasks?${query.toString()}`);
    return res?.tasks || [];
  } catch (err) {
    console.warn("Local DB fetchDbTasks sync skipped:", err.message);
    return [];
  }
}
