import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  createTaskRecord,
  getDatabasePath,
  getDatabaseStats,
  getTask,
  getTaskDetail,
  listEvents,
  listTasks,
  recordEvent,
  updateTaskRecord,
  vacuumDatabase,
} from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const PORT = process.env.PORT || 8787;
const KIE_JOBS_BASE_URL = process.env.KIE_JOBS_BASE_URL || "https://api.kie.ai/api/v1/jobs";
const KIE_FILE_UPLOAD_URL = process.env.KIE_FILE_UPLOAD_URL || "https://kieai.redpandaai.co/api/file-stream-upload";
const KIE_FILE_URL_UPLOAD_URL = process.env.KIE_FILE_URL_UPLOAD_URL || "https://kieai.redpandaai.co/api/file-url-upload";
const APIMART_BASE_URL = process.env.APIMART_BASE_URL || "https://api.apimart.ai";
const IMAGE_URL_MAX_BYTES = 30 * 1024 * 1024;
const MAX_INPUT_URLS = 16;
const RUNTIME_ROOT = process.env.VERCEL ? path.join(os.tmpdir(), "gpt-image-2-studio") : path.resolve(__dirname, "..");
const LOG_DIR = path.join(RUNTIME_ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "image-requests.log");

const ALLOWED_ASPECT_RATIOS = new Set([
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "2:1",
  "1:2",
  "3:1",
  "1:3",
  "21:9",
  "9:21",
  "5:4",
  "4:5",
]);
const ALLOWED_RESOLUTIONS = new Set(["1K", "2K", "4K"]);
const PROVIDERS = new Set(["kie", "apimart"]);

app.use(express.json({ limit: "50mb" }));
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  req.localTaskId = req.get("x-local-task-id") || req.body?.localTaskId || req.query?.localTaskId || "";
  req.provider = normalizeProvider(req.get("x-provider") || req.body?.provider || req.query?.provider || "");
  next();
});

// 上游请求继续经后端代理转发，保持与本地一致的请求路径。

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      kie: { jobsBaseUrl: KIE_JOBS_BASE_URL, fileUploadHost: new URL(KIE_FILE_UPLOAD_URL).host },
      apimart: { baseUrl: APIMART_BASE_URL },
    },
  });
});

function apiMartUrl(endpoint) {
  const base = APIMART_BASE_URL.replace(/\/+$/, "");
  const versionedBase = /\/v1$/i.test(base) ? base : `${base}/v1`;
  return `${versionedBase}${endpoint}`;
}

app.get("/api/database/stats", (_req, res) => {
  res.json(getDatabaseStats());
});

// 测试当前 provider 的 API Key 是否有效，用一个最小请求直接打到上游。
app.post("/api/test-key", async (req, res, next) => {
  try {
    const provider = req.provider;
    const apiKey = getApiKey(req);
    if (!apiKey) throw createHttpError(`请先填写 ${provider === "apimart" ? "API Mart" : "KIE"} API Key。`, 400);

    if (provider === "apimart") {
      const model = req.body?.model || "gpt-image-2.5-flare";
      const response = await fetchWithRetry(
        apiMartUrl("/images/generations"),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: "ping", n: 1, size: "1:1", resolution: "1k", official_fallback: true }),
        },
        "apimart-test-key",
        req.requestId,
        req.localTaskId
      );
      const payload = await readJsonSafely(response);
      const ok = response.ok && payload?.code === 200;
      return res.json({
        provider,
        ok,
        httpStatus: response.status,
        upstream: normalizeUpstream(payload, response.status, "apimart"),
        message: ok ? "API Key 有效，已创建测试任务。" : "API Key 无效或被上游拒绝。",
      });
    }

    const model = req.body?.model || "gpt-image-2-5-flare-text-to-image";
    const response = await fetchWithRetry(
      `${KIE_JOBS_BASE_URL}/createTask`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: { prompt: "ping-key-validation", aspect_ratio: "auto", resolution: "1K" } }),
      },
      "kie-test-key",
      req.requestId,
      req.localTaskId
    );
    const payload = await readJsonSafely(response);
    const ok = response.ok && payload?.code === 200;
    return res.json({
      provider,
      ok,
      httpStatus: response.status,
      upstream: normalizeUpstream(payload, response.status, "kie"),
      message: ok ? "API Key 有效，已创建测试任务。" : "API Key 无效或被上游拒绝。",
      testTaskId: payload?.data?.taskId || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/database/export", (_req, res) => {
  res.download(getDatabasePath(), "gpt-image-2-studio.sqlite");
});

app.post("/api/database/vacuum", (_req, res) => {
  res.json(vacuumDatabase());
});

app.get("/api/tasks", (req, res) => {
  res.json({
    tasks: listTasks({
      q: String(req.query.q || "").trim(),
      status: String(req.query.status || "").trim(),
      limit: Number(req.query.limit || 50),
    }),
  });
});

app.post("/api/tasks", (req, res, next) => {
  try {
    const task = createTaskRecord(req.body || {});
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/:taskId", (req, res, next) => {
  try {
    const detail = getTaskDetail(req.params.taskId);
    if (!detail) throw createHttpError("没有找到这个任务 ID。", 404);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tasks/:taskId", (req, res, next) => {
  try {
    const task = updateTaskRecord(req.params.taskId, req.body || {});
    if (!task) throw createHttpError("没有找到这个任务 ID。", 404);
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/events", (req, res, next) => {
  try {
    recordEvent({
      taskId: req.params.taskId,
      requestId: req.body?.requestId || req.requestId,
      phase: req.body?.phase || "client",
      level: req.body?.level || "info",
      message: req.body?.message || "",
      data: req.body?.data || {},
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/logs", (req, res) => {
  const compact = String(req.query.compact || "") === "1";
  if (compact) {
    const tasks = listTasks({
      q: String(req.query.q || "").trim(),
      limit: Number(req.query.limit || 20),
    });
    res.json({ logs: tasks.map(toCompactLog) });
    return;
  }

  res.json({
    logs: listEvents({
      taskId: String(req.query.taskId || "").trim(),
      requestId: String(req.query.requestId || "").trim(),
      level: String(req.query.level || "").trim(),
      phase: String(req.query.phase || "").trim(),
      q: String(req.query.q || "").trim(),
      limit: Number(req.query.limit || 200),
    }),
  });
});

app.get("/api/download-image", async (req, res, next) => {
  try {
    const imageUrl = String(req.query.url || "").trim();
    assertHttpImageUrl(imageUrl);

    const response = await fetch(imageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw createHttpError(`原图下载失败，状态码 ${response.status}。`, 502);

    const contentType = response.headers.get("content-type") || "image/png";
    const fileName = filenameFromUrl(imageUrl).replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Cache-Control", "no-store");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    next(error);
  }
});

function normalizeProvider(provider) {
  const value = String(provider || "kie").toLowerCase();
  return PROVIDERS.has(value) ? value : "kie";
}

function getApiKey(req) {
  return req.get("x-api-key") || req.body?.apiKey || "";
}

function requireApiKey(apiKey, provider = "kie") {
  if (!String(apiKey || "").trim()) {
    throw createHttpError(`请先填写 ${provider === "apimart" ? "API Mart" : "KIE"} API Key。`, 400);
  }
}

function appendLog(entry) {
  const event = {
    taskId: entry.taskId || entry.localTaskId || "",
    requestId: entry.requestId || "",
    phase: entry.phase || "",
    level: entry.level || "info",
    message: entry.message || entry.phase || "",
    data: entry,
  };

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
  } catch (error) {
    console.warn(`Failed to write request log: ${error.message}`);
  }

  try {
    recordEvent(event);
  } catch (error) {
    console.warn(`Failed to write database event: ${error.message}`);
  }
}

function createHttpError(message, status = 500, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchWithRetry(url, options, label, requestId, taskId = "", maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === maxRetries) return response;

      appendLog({
        taskId,
        requestId,
        phase: label,
        level: "warn",
        message: "上游接口暂时不可用，自动重试",
        status: response.status,
        attempt,
      });
      await response.body?.cancel?.();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      appendLog({
        taskId,
        requestId,
        phase: label,
        level: "warn",
        message: "网络请求失败，自动重试",
        error: error.message,
        attempt,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 450 * 2 ** attempt));
  }

  throw createHttpError(`${label} 网络请求失败：${lastError?.message || "unknown error"}`, 502, {
    upstream: { msg: lastError?.message || "network request failed" },
  });
}

function normalizeKieError(status, payload) {
  if (!payload) return `KIE API 请求失败，状态码 ${status}`;
  if (typeof payload === "string") return payload;
  return payload.msg || payload.message || payload.error || `KIE API 请求失败，状态码 ${status}`;
}

function normalizeApiMartError(status, payload) {
  if (!payload) return `API Mart 请求失败，状态码 ${status}`;
  if (typeof payload === "string") return payload;
  return payload.message || payload.msg || payload.error?.message || payload.error || `API Mart 请求失败，状态码 ${status}`;
}

function normalizeUpstream(payload, httpStatus, provider) {
  const data = typeof payload === "object" && payload ? payload.data : null;
  return {
    provider,
    httpStatus,
    code: typeof payload === "object" && payload ? payload.code : null,
    msg: typeof payload === "object" && payload ? payload.msg || payload.message || payload.error?.message || null : String(payload || ""),
    taskId: data?.taskId || data?.task_id || data?.id || null,
    state: data?.state || data?.status || null,
    failCode: data?.failCode || null,
    failMsg: data?.failMsg || data?.error?.message || null,
  };
}

function analyzeGenerationInput(input = {}) {
  const prompt = String(input.prompt || "");
  const inputUrlCount = Array.isArray(input.input_urls) ? input.input_urls.length : 0;
  const flags = [];

  if (inputUrlCount > 1 && input.resolution === "4K") {
    flags.push("多图参考 + 4K 会增加供应商生成失败概率");
  }
  if (/\b8k\b|8K|超高清|超清晰|超高精度/.test(prompt) && input.resolution === "4K") {
    flags.push("提示词包含 8K/超高清描述，但接口最高选择为 4K");
  }
  if (prompt.length > 240) {
    flags.push("提示词较长，供应商生成端更容易返回内部错误");
  }
  if (/二维码|扫码|封面|不允许变动|不能变动|保持不变/.test(prompt) && inputUrlCount > 1) {
    flags.push("多参考图中包含严格保持不变的封面/二维码要求，生成难度较高");
  }

  return {
    promptLength: prompt.length,
    inputUrlCount,
    aspectRatio: input.aspect_ratio || "auto",
    resolution: input.resolution || "1K",
    flags,
  };
}

function diagnoseProviderFailure(task, remoteTaskId, payload, provider = "kie") {
  const input = {
    prompt: task?.prompt || "",
    input_urls: task?.input_urls || [],
    aspect_ratio: task?.aspect_ratio || "auto",
    resolution: task?.resolution || "1K",
  };
  const data = payload?.data || {};
  const errorMessage = data.failMsg || data.error?.message || data.message || payload?.message || "";
  return {
    source: "provider",
    provider,
    localPath: "本地请求成功，远程任务创建成功，轮询时供应商返回失败",
    remoteTaskId,
    failCode: data.failCode || data.error?.code || null,
    failMsg: errorMessage || null,
    localConclusion: errorMessage || "失败来自供应商生成端。",
    likelyFactors: analyzeGenerationInput(input).flags,
  };
}

function toCompactLog(task) {
  const ok = task.status === "success";
  const failed = task.status === "fail";
  return {
    id: task.id,
    taskId: task.id,
    remoteTaskId: task.remote_task_id || "",
    provider: task.provider || "kie",
    status: task.status,
    level: failed ? "error" : ok ? "success" : "info",
    message: ok ? "生成成功" : failed ? task.error_message || task.fail_msg || "生成失败" : task.active_step || "任务处理中",
    created_at: task.updated_at || task.created_at,
  };
}

function assertHttpImageUrl(url, index = 0) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw createHttpError(`第 ${index + 1} 张参考图 URL 无效。`, 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createHttpError(`第 ${index + 1} 张参考图 URL 必须是 http 或 https。`, 400);
  }

  return parsed;
}

function assertApiMartImageSource(value, index = 0) {
  if (String(value || "").startsWith("data:image/")) return;
  assertHttpImageUrl(value, index);
}

function looksLikeImageUrl(url) {
  try {
    return /\.(jpg|jpeg|png|webp)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function validateImageUrl(url, requestId, index = 0) {
  assertHttpImageUrl(url, index);

  const validateResponse = (response) => {
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);

    if (!response.ok) throw createHttpError(`第 ${index + 1} 张参考图 URL 无法访问，状态码 ${response.status}。`, 400);
    if (contentType && !contentType.toLowerCase().startsWith("image/") && !looksLikeImageUrl(url)) {
      throw createHttpError(`第 ${index + 1} 张参考图 URL 返回的不是图片类型。`, 400);
    }
    if (contentLength > IMAGE_URL_MAX_BYTES) throw createHttpError(`第 ${index + 1} 张参考图超过 30MB。`, 400);
  };

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    validateResponse(headResponse);
    return;
  } catch (error) {
    appendLog({
      requestId,
      phase: "image-url-preflight",
      level: "warn",
      message: "HEAD 预检失败，改用小范围 GET",
      urlHost: new URL(url).host,
      error: error.message,
    });
  }

  const getResponse = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { Range: "bytes=0-1023" },
    signal: AbortSignal.timeout(15000),
  });
  validateResponse(getResponse);
  await getResponse.body?.cancel?.();
}

function filenameFromUrl(fileUrl) {
  try {
    const pathname = new URL(fileUrl).pathname;
    const name = decodeURIComponent(path.basename(pathname));
    return name && /\.[a-z0-9]+$/i.test(name) ? name : `image-${Date.now()}.png`;
  } catch {
    return `image-${Date.now()}.png`;
  }
}

function validateGenerationInput(input, provider) {
  const prompt = String(input.prompt || "").trim();
  const aspectRatio = input.aspect_ratio || "auto";
  const resolution = String(input.resolution || "1K").toUpperCase();
  const modelVariant = String(input.modelVariant || input.model || "flare").toLowerCase();
  const inputUrls = Array.isArray(input.input_urls)
    ? input.input_urls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];

  if (!prompt) throw createHttpError("请输入生图提示词。", 400);
  if (prompt.length > 20000) throw createHttpError("提示词不能超过 20000 个字符。", 400);
  if (!ALLOWED_ASPECT_RATIOS.has(aspectRatio)) throw createHttpError("不支持的图片比例。", 400);
  if (!ALLOWED_RESOLUTIONS.has(resolution)) throw createHttpError("不支持的清晰度。", 400);
  const KIE_UNSUPPORTED_2K_4K_RATIOS = new Set(["5:4", "4:5", "3:1", "1:3", "9:21"]);
  if (provider === "kie" && (resolution === "2K" || resolution === "4K") && KIE_UNSUPPORTED_2K_4K_RATIOS.has(aspectRatio)) {
    throw createHttpError(`KIE 通道在 ${resolution} 分辨率下不支持 ${aspectRatio} 比例，请选择 1K 或改用其他比例（如 16:9、9:16、3:2 等）。`, 400);
  }
  if (inputUrls.length > MAX_INPUT_URLS) throw createHttpError(`一次任务最多支持 ${MAX_INPUT_URLS} 张参考图。`, 400);

  inputUrls.forEach((url, index) => {
    if (provider === "apimart") assertApiMartImageSource(url, index);
    else assertHttpImageUrl(url, index);
  });

  return {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    input_urls: inputUrls,
    modelVariant,
  };
}

function resolveKieModel(modelVariant, hasUrls) {
  const v = String(modelVariant || "").toLowerCase();
  if (v.includes("sunburst")) {
    return hasUrls ? "gpt-image-2-5-sunburst-image-to-image" : "gpt-image-2-5-sunburst-text-to-image";
  }
  if (v === "v2" || v.includes("gpt-image-2-") || v === "gpt-image-2") {
    return hasUrls ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image";
  }
  return hasUrls ? "gpt-image-2-5-flare-image-to-image" : "gpt-image-2-5-flare-text-to-image";
}

function resolveApiMartModel(modelVariant) {
  const v = String(modelVariant || "").toLowerCase();
  if (v.includes("sunburst")) return "gpt-image-2.5-sunburst";
  if (v === "v2" || v === "gpt-image-2") return "gpt-image-2";
  return "gpt-image-2.5-flare";
}

function extractKieResultUrls(payload) {
  try {
    const result = JSON.parse(payload?.data?.resultJson || "{}");
    return result.resultUrls || result.urls || [];
  } catch {
    return [];
  }
}

function extractApiMartResultUrls(payload) {
  const images = payload?.data?.result?.images || [];
  return images.flatMap((image) => {
    if (Array.isArray(image?.url)) return image.url;
    if (typeof image?.url === "string") return [image.url];
    return [];
  });
}

async function createKieTask({ apiKey, input, requestId, localTaskId }) {
  const model = resolveKieModel(input.modelVariant, input.input_urls.length > 0);
  for (const [index, url] of input.input_urls.entries()) await validateImageUrl(url, requestId, index);

  const requestBody = {
    model,
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspect_ratio,
      resolution: input.resolution,
    },
  };
  if (input.input_urls.length) requestBody.input.input_urls = input.input_urls;

  const response = await fetchWithRetry(
    `${KIE_JOBS_BASE_URL}/createTask`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
    "kie-create-task",
    requestId,
    localTaskId
  );
  const payload = await readJsonSafely(response);
  if (!response.ok || payload?.code !== 200) {
    throw createHttpError(normalizeKieError(response.status, payload), response.status || 502, {
      upstream: normalizeUpstream(payload, response.status, "kie"),
    });
  }

  return {
    responsePayload: payload,
    normalizedPayload: { ...payload, provider: "kie", requestId },
    remoteTaskId: payload?.data?.taskId || "",
    model,
  };
}

async function createApiMartTask({ apiKey, input, requestId, localTaskId }) {
  const model = resolveApiMartModel(input.modelVariant);
  const requestBody = {
    model,
    prompt: input.prompt,
    n: 1,
    size: input.aspect_ratio,
    resolution: input.resolution.toLowerCase(),
    official_fallback: true,
  };
  if (input.input_urls.length) requestBody.image_urls = input.input_urls;

  const response = await fetchWithRetry(
    apiMartUrl("/images/generations"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
    "apimart-create-task",
    requestId,
    localTaskId
  );
  const payload = await readJsonSafely(response);
  const firstTask = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const remoteTaskId = firstTask?.task_id || firstTask?.id || "";

  if (!response.ok || payload?.code !== 200 || !remoteTaskId) {
    throw createHttpError(normalizeApiMartError(response.status, payload), response.status || 502, {
      upstream: normalizeUpstream(payload, response.status, "apimart"),
    });
  }

  return {
    responsePayload: payload,
    normalizedPayload: {
      code: 200,
      msg: "success",
      provider: "apimart",
      requestId,
      data: {
        taskId: remoteTaskId,
        state: "waiting",
        rawStatus: firstTask?.status || "submitted",
      },
    },
    remoteTaskId,
    model,
  };
}

async function getKieTaskInfo({ apiKey, taskId, requestId, localTaskId }) {
  const response = await fetchWithRetry(
    `${KIE_JOBS_BASE_URL}/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    "kie-task-info",
    requestId,
    localTaskId
  );
  const payload = await readJsonSafely(response);
  if (!response.ok || payload?.code !== 200) {
    throw createHttpError(normalizeKieError(response.status, payload), response.status || 502, {
      upstream: normalizeUpstream(payload, response.status, "kie"),
    });
  }
  return { rawPayload: payload, normalizedPayload: { ...payload, provider: "kie", requestId } };
}

async function getApiMartTaskInfo({ apiKey, taskId, requestId, localTaskId }) {
  const response = await fetchWithRetry(
    apiMartUrl(`/tasks/${encodeURIComponent(taskId)}`),
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    "apimart-task-info",
    requestId,
    localTaskId
  );
  const payload = await readJsonSafely(response);
  if (!response.ok || payload?.code !== 200) {
    throw createHttpError(normalizeApiMartError(response.status, payload), response.status || 502, {
      upstream: normalizeUpstream(payload, response.status, "apimart"),
    });
  }

  const status = payload?.data?.status || "submitted";
  const stateMap = {
    submitted: "waiting",
    processing: "waiting",
    completed: "success",
    failed: "fail",
  };
  const resultUrls = extractApiMartResultUrls(payload);
  const failMsg = payload?.data?.error?.message || payload?.data?.error || "";
  return {
    rawPayload: payload,
    normalizedPayload: {
      code: 200,
      msg: "success",
      provider: "apimart",
      requestId,
      data: {
        taskId,
        state: stateMap[status] || "waiting",
        rawStatus: status,
        failCode: payload?.data?.error?.code || "",
        failMsg,
        resultJson: JSON.stringify({ resultUrls }),
      },
    },
  };
}

app.post("/api/upload-image", upload.single("file"), async (req, res, next) => {
  try {
    const apiKey = getApiKey(req);
    requireApiKey(apiKey, "kie");

    if (!req.file) throw createHttpError("没有收到图片文件。", 400);
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(req.file.mimetype)) {
      throw createHttpError("仅支持 JPG、PNG、WEBP 图片。", 400);
    }

    const safeName = req.file.originalname.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
    const formData = new FormData();
    formData.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), safeName);
    formData.append("uploadPath", "gpt-image-2-studio");
    formData.append("fileName", `${Date.now()}-${safeName}`);

    const response = await fetchWithRetry(
      KIE_FILE_UPLOAD_URL,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      },
      "kie-file-upload",
      req.requestId,
      req.localTaskId
    );
    const payload = await readJsonSafely(response);
    if (!response.ok || (payload?.code && payload.code !== 200)) {
      throw createHttpError(normalizeKieError(response.status, payload), response.status || 502, {
        upstream: normalizeUpstream(payload, response.status, "kie"),
      });
    }

    const data = payload?.data || payload || {};
    const url = data.downloadUrl || data.fileUrl || data.url || data?.result?.downloadUrl || data?.result?.url;
    if (!url) {
      throw createHttpError("图片上传成功，但没有返回可用 URL。", 502, {
        upstream: normalizeUpstream(payload, response.status, "kie"),
      });
    }

    await validateImageUrl(url, req.requestId);
    appendLog({
      taskId: req.localTaskId,
      requestId: req.requestId,
      provider: "kie",
      phase: "file-upload",
      level: "info",
      message: "参考图上传成功",
      downloadHost: new URL(url).host,
    });

    res.json({ url, data, requestId: req.requestId, provider: "kie" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/import-image-url", async (req, res, next) => {
  try {
    const apiKey = getApiKey(req);
    requireApiKey(apiKey, "kie");
    const fileUrl = String(req.body?.fileUrl || "").trim();
    assertHttpImageUrl(fileUrl);
    await validateImageUrl(fileUrl, req.requestId);

    const response = await fetchWithRetry(
      KIE_FILE_URL_UPLOAD_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl,
          uploadPath: "gpt-image-2-studio",
          fileName: `${Date.now()}-${filenameFromUrl(fileUrl).replace(/[^\w.\-]/g, "_")}`,
        }),
      },
      "kie-url-import",
      req.requestId,
      req.localTaskId
    );
    const payload = await readJsonSafely(response);
    if (!response.ok || (payload?.code && payload.code !== 200)) {
      throw createHttpError(normalizeKieError(response.status, payload), response.status || 502, {
        upstream: normalizeUpstream(payload, response.status, "kie"),
      });
    }

    const data = payload?.data || payload || {};
    const url = data.downloadUrl || data.fileUrl || data.url || data?.result?.downloadUrl || data?.result?.url;
    if (!url) {
      throw createHttpError("图片 URL 导入成功，但没有返回可用 downloadUrl。", 502, {
        upstream: normalizeUpstream(payload, response.status, "kie"),
      });
    }

    await validateImageUrl(url, req.requestId);
    appendLog({
      taskId: req.localTaskId,
      requestId: req.requestId,
      provider: "kie",
      phase: "url-import",
      level: "info",
      message: "参考图 URL 导入成功",
      sourceHost: new URL(fileUrl).host,
      downloadHost: new URL(url).host,
    });

    res.json({ url, data, requestId: req.requestId, provider: "kie" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/create-task", async (req, res, next) => {
  try {
    const provider = req.provider;
    const apiKey = getApiKey(req);
    requireApiKey(apiKey, provider);
    const input = validateGenerationInput(req.body || {}, provider);

    const created =
      provider === "apimart"
        ? await createApiMartTask({ apiKey, input, requestId: req.requestId, localTaskId: req.localTaskId })
        : await createKieTask({ apiKey, input, requestId: req.requestId, localTaskId: req.localTaskId });

    appendLog({
      taskId: req.localTaskId,
      requestId: req.requestId,
      provider,
      phase: "create-task",
      level: "info",
      message: "远程任务已创建",
      model: created.model,
      remoteTaskId: created.remoteTaskId,
      promptLength: input.prompt.length,
      inputUrlCount: input.input_urls.length,
      aspectRatio: input.aspect_ratio,
      resolution: input.resolution,
      diagnostics: analyzeGenerationInput(input),
    });

    if (req.localTaskId) {
      updateTaskRecord(req.localTaskId, {
        provider,
        model: created.model,
        status: "waiting",
        remote_task_id: created.remoteTaskId,
        error_source: "",
        error_message: "",
        fail_code: "",
        fail_msg: "",
        finished_at: null,
        active_step: "远程任务已创建",
      });
    }

    res.json(created.normalizedPayload);
  } catch (error) {
    next(error);
  }
});

app.post("/api/task-info", async (req, res, next) => {
  try {
    const provider = req.provider;
    const apiKey = getApiKey(req);
    requireApiKey(apiKey, provider);
    const taskId = String(req.body?.taskId || "").trim();
    if (!taskId) throw createHttpError("缺少 taskId。", 400);

    const result =
      provider === "apimart"
        ? await getApiMartTaskInfo({ apiKey, taskId, requestId: req.requestId, localTaskId: req.localTaskId })
        : await getKieTaskInfo({ apiKey, taskId, requestId: req.requestId, localTaskId: req.localTaskId });

    const payload = result.normalizedPayload;
    const state = payload?.data?.state || "waiting";
    const providerDiagnosis =
      state === "fail" && req.localTaskId ? diagnoseProviderFailure(getTask(req.localTaskId), taskId, payload, provider) : null;

    appendLog({
      taskId: req.localTaskId,
      requestId: req.requestId,
      provider,
      phase: "task-info",
      level: state === "fail" ? "error" : "info",
      message: state === "fail" ? payload?.data?.failMsg || "远程任务失败" : `远程状态：${state}`,
      remoteTaskId: taskId,
      state,
      failCode: payload?.data?.failCode || null,
      failMsg: payload?.data?.failMsg || null,
      diagnostics: providerDiagnosis,
    });

    if (req.localTaskId) {
      const update = {
        provider,
        status: state,
        remote_task_id: taskId,
        active_step: state === "success" ? "已完成" : state === "fail" ? "远程任务失败" : "生成中",
      };

      if (state !== "fail") {
        update.error_source = "";
        update.error_message = "";
        update.fail_code = "";
        update.fail_msg = "";
      }

      if (state !== "success" && state !== "fail") update.finished_at = null;

      if (state === "success") {
        update.result_urls = provider === "apimart" ? extractApiMartResultUrls(result.rawPayload) : extractKieResultUrls(result.rawPayload);
        update.finished_at = Date.now();
      }

      if (state === "fail") {
        update.error_source = "provider";
        update.error_message = payload?.data?.failMsg || payload?.data?.failCode || "远程任务失败。";
        update.fail_code = payload?.data?.failCode || "";
        update.fail_msg = payload?.data?.failMsg || "";
        update.finished_at = Date.now();
      }

      updateTaskRecord(req.localTaskId, update);
    }

    res.json({ ...payload, requestId: req.requestId, diagnostics: providerDiagnosis });
  } catch (error) {
    next(error);
  }
});

const distPath = path.resolve(__dirname, "../dist");

if (!process.env.VERCEL && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error, req, res, _next) => {
  const status = error.status || 500;
  appendLog({
    taskId: req.localTaskId,
    requestId: req.requestId,
    provider: req.provider,
    phase: "error",
    level: status >= 500 ? "error" : "warn",
    status,
    message: error.message,
    upstream: error.upstream || null,
  });
  res.status(status).json({
    error: error.message || "服务请求失败。",
    requestId: req.requestId,
    upstream: error.upstream || null,
  });
});

let server = null;

if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`GPT Image 2 Studio proxy is running at http://127.0.0.1:${PORT}`);
  });
}

export { app, server };
