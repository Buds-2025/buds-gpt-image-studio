import initSqlJs from "sql.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const RUNTIME_ROOT = process.env.VERCEL ? path.join(os.tmpdir(), "gpt-image-2-studio") : ROOT_DIR;
const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "studio.sqlite");
const WASM_DIR = path.join(ROOT_DIR, "node_modules", "sql.js", "dist");

fs.mkdirSync(DATA_DIR, { recursive: true });

const SQL = await initSqlJs({
  locateFile: (file) => path.join(WASM_DIR, file),
});

const db = fs.existsSync(DB_PATH)
  ? new SQL.Database(fs.readFileSync(DB_PATH))
  : new SQL.Database();

function persist() {
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(db.export()));
  fs.renameSync(tmpPath, DB_PATH);
}

function now() {
  return Date.now();
}

function safeJson(value, fallback = []) {
  if (value == null) return JSON.stringify(fallback);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rows(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

function one(sql, params = []) {
  return rows(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function ensureColumn(table, column, definition) {
  const exists = rows(`PRAGMA table_info(${table})`).some((item) => item.name === column);
  if (!exists) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function initSchema() {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      mode TEXT,
      provider TEXT DEFAULT 'kie',
      status TEXT NOT NULL DEFAULT 'created',
      prompt TEXT,
      aspect_ratio TEXT,
      resolution TEXT,
      input_count INTEGER DEFAULT 0,
      input_previews TEXT DEFAULT '[]',
      input_urls TEXT DEFAULT '[]',
      result_urls TEXT DEFAULT '[]',
      remote_task_id TEXT,
      previous_task_ids TEXT DEFAULT '[]',
      request_ids TEXT DEFAULT '[]',
      retry_count INTEGER DEFAULT 0,
      active_step TEXT,
      error_source TEXT,
      error_message TEXT,
      fail_code TEXT,
      fail_msg TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      request_id TEXT,
      phase TEXT,
      level TEXT,
      message TEXT,
      data TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
  `);

  ensureColumn("tasks", "provider", "TEXT DEFAULT 'kie'");
  ensureColumn("tasks", "model", "TEXT DEFAULT 'gpt-image-2.5-flare'");
  db.run("UPDATE tasks SET provider = 'kie' WHERE provider IS NULL OR provider = ''");
  db.run("UPDATE tasks SET model = 'gpt-image-2.5-flare' WHERE model IS NULL OR model = ''");
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(provider);
    CREATE INDEX IF NOT EXISTS idx_tasks_model ON tasks(model);
    CREATE INDEX IF NOT EXISTS idx_tasks_remote_task_id ON tasks(remote_task_id);
    CREATE INDEX IF NOT EXISTS idx_events_task_id ON task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_request_id ON task_events(request_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON task_events(created_at DESC);
  `);
  persist();
}

initSchema();

function normalizeTask(row) {
  if (!row) return null;
  return {
    ...row,
    provider: row.provider || "kie",
    input_previews: parseJson(row.input_previews, []),
    input_urls: parseJson(row.input_urls, []),
    result_urls: parseJson(row.result_urls, []),
    previous_task_ids: parseJson(row.previous_task_ids, []),
    request_ids: parseJson(row.request_ids, []),
  };
}

function normalizeEvent(row) {
  if (!row) return null;
  return {
    ...row,
    data: parseJson(row.data, {}),
  };
}

export function generateTaskId() {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `IMG-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function createTaskRecord(input = {}) {
  const id = input.id || generateTaskId();
  const createdAt = now();
  const aspectRatio = input.aspect_ratio || input.aspectRatio || "auto";
  const resolution = input.resolution || "1K";
  const model = input.model || input.modelVariant || "gpt-image-2.5-flare";
  const inputCount = Number(input.input_count != null ? input.input_count : input.inputCount || 0);
  const inputPreviews = safeJson(input.input_previews || input.inputPreviews || []);
  const activeStep = input.active_step || input.activeStep || "任务已创建";

  run(
    `
      INSERT INTO tasks (
        id, title, mode, provider, model, status, prompt, aspect_ratio, resolution, input_count,
        input_previews, created_at, updated_at, active_step
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.title || id,
      input.mode || "text",
      input.provider || "kie",
      model,
      input.status || "created",
      input.prompt || "",
      aspectRatio,
      resolution,
      inputCount,
      inputPreviews,
      createdAt,
      createdAt,
      activeStep,
    ]
  );

  recordEvent({
    taskId: id,
    phase: "task-create",
    level: "info",
    message: "本地任务 ID 已生成并记录",
    data: { mode: input.mode, provider: input.provider || "kie", inputCount },
  });

  return getTask(id);
}

export function updateTaskRecord(taskId, patch = {}) {
  if (!taskId) return null;

  const allowed = {
    title: "title",
    mode: "mode",
    provider: "provider",
    model: "model",
    modelVariant: "model",
    status: "status",
    prompt: "prompt",
    aspect_ratio: "aspect_ratio",
    aspectRatio: "aspect_ratio",
    resolution: "resolution",
    input_count: "input_count",
    inputCount: "input_count",
    input_previews: "input_previews",
    inputPreviews: "input_previews",
    input_urls: "input_urls",
    inputUrls: "input_urls",
    result_urls: "result_urls",
    resultUrls: "result_urls",
    remote_task_id: "remote_task_id",
    remoteTaskId: "remote_task_id",
    previous_task_ids: "previous_task_ids",
    previousTaskIds: "previous_task_ids",
    request_ids: "request_ids",
    requestIds: "request_ids",
    retry_count: "retry_count",
    retryCount: "retry_count",
    active_step: "active_step",
    activeStep: "active_step",
    error_source: "error_source",
    errorSource: "error_source",
    error_message: "error_message",
    errorMessage: "error_message",
    fail_code: "fail_code",
    failCode: "fail_code",
    fail_msg: "fail_msg",
    failMsg: "fail_msg",
    finished_at: "finished_at",
    finishedAt: "finished_at",
  };

  const sets = [];
  const params = [];
  const handledColumns = new Set();

  for (const [key, column] of Object.entries(allowed)) {
    if (!(key in patch)) continue;
    if (handledColumns.has(column)) continue;
    handledColumns.add(column);
    sets.push(`${column} = ?`);
    const value = patch[key];
    params.push(Array.isArray(value) || (value && typeof value === "object") ? safeJson(value) : value);
  }

  if (!sets.length) return getTask(taskId);

  sets.push("updated_at = ?");
  params.push(now(), taskId);
  run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, params);
  return getTask(taskId);
}

export function getTask(taskId) {
  const value = String(taskId || "").trim();
  if (!value) return null;
  return normalizeTask(one("SELECT * FROM tasks WHERE id = ? OR remote_task_id = ? ORDER BY created_at DESC LIMIT 1", [value, value]));
}

export function getTaskDetail(taskId) {
  const task = getTask(taskId);
  if (!task) return null;
  return {
    task,
    events: listEvents({ taskId: task.id, limit: 200 }),
  };
}

export function listTasks({ q = "", status = "", limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (q) {
    clauses.push("(id LIKE ? OR remote_task_id LIKE ? OR prompt LIKE ? OR error_message LIKE ? OR provider LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(Math.max(1, Math.min(Number(limit) || 50, 300)));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return rows(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ?`, params).map(normalizeTask);
}

export function recordEvent({ taskId = "", requestId = "", phase = "", level = "info", message = "", data = {} }) {
  run(
    `
      INSERT INTO task_events (task_id, request_id, phase, level, message, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [taskId || "", requestId || "", phase || "", level || "info", message || "", safeJson(data || {}), now()]
  );

  if (taskId) {
    db.run("UPDATE tasks SET updated_at = ? WHERE id = ?", [now(), taskId]);
    persist();
  }
}

export function listEvents({ taskId = "", requestId = "", level = "", phase = "", q = "", limit = 200 } = {}) {
  const clauses = [];
  const params = [];
  if (taskId) {
    clauses.push("task_id = ?");
    params.push(taskId);
  }
  if (requestId) {
    clauses.push("request_id = ?");
    params.push(requestId);
  }
  if (level) {
    clauses.push("level = ?");
    params.push(level);
  }
  if (phase) {
    clauses.push("phase = ?");
    params.push(phase);
  }
  if (q) {
    clauses.push("(task_id LIKE ? OR request_id LIKE ? OR phase LIKE ? OR message LIKE ? OR data LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(Math.max(1, Math.min(Number(limit) || 200, 1000)));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return rows(`SELECT * FROM task_events ${where} ORDER BY created_at DESC LIMIT ?`, params).map(normalizeEvent);
}

export function getDatabaseStats() {
  const statusRows = rows("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status");
  return {
    dbPath: DB_PATH,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    taskCount: one("SELECT COUNT(*) AS count FROM tasks")?.count || 0,
    eventCount: one("SELECT COUNT(*) AS count FROM task_events")?.count || 0,
    statuses: Object.fromEntries(statusRows.map((row) => [row.status || "unknown", row.count])),
  };
}

export function vacuumDatabase() {
  db.run("VACUUM");
  persist();
  return getDatabaseStats();
}

export function getDatabasePath() {
  persist();
  return DB_PATH;
}
