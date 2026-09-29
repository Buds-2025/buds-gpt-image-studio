# 修复 413 + 文生图/多图参考支持一次出多张 (历史架构计划归档)

> 归档日期：2026 年  
> 说明：本文件记录了早期针对 Vercel 4.5MB 限制所设计的「大图直传 + 前端多张并发」架构演进方案，现已归档至 docs/archive/。

## 背景与根因

部署到 Vercel 后，图生图/多图参考报 413「请求失败：413 / 错误来源：本地校验或网络预检」。

根因：Vercel serverless function 有 **4.5MB 请求/响应体硬限制**（`FUNCTION_PAYLOAD_TOO_LARGE`），平台层直接返回 413，不经过应用代码，故前端 `errorSource !== "upstream"`，落到兜底文案「本地校验或网络预检」。后端 `express.json({limit:"50mb"})` 在 Vercel 上无效，平台先于 Express 拒绝。

413 具体触发点：图生图/多图参考的**图片上传环节**。`ut()` 上传函数对 KIE 通道走 `POST /api/upload-image`（后端 multer memoryStorage 把整文件读进内存再转发到 `kieai.redpandaai.co`），单文件上限 30MB，远超 Vercel 4.5MB 限制。文生图无参考图、不经上传，故不报 413。

已验证（curl 预检 + 假 key POST）三个上游接口均支持浏览器 CORS 直连：
- `https://kieai.redpandaai.co/api/file-stream-upload` → `Access-Control-Allow-Origin: *`，允许 POST + Authorization + Content-Type
- `https://api.kie.ai/api/v1/jobs/createTask` → 假 key 返回业务 401（非 CORS 阻断），`access-control-allow-origin: *`
- `https://api.apimart.ai/v1/images/generations` → `Access-Control-Allow-Origin: *`

## 关键约束（已查证）

- **KIE 与 API Mart 的 API 本身每次只生成 1 张**：KIE 两份文档无 `n` 参数；API Mart 有 `n` 但文档明确「取值范围：1」。「一次出多张」只能靠前端并发创建 N 个独立任务。
- 现有 `mt(items, concurrency, worker)` 是通用并发执行器，batch 模式已用它；text/multi 多张可复用。

## 用户确认的决策

1. 架构：**保留后端**做日志/历史/下载代理；上游生图/上传/查询改**前端直连**。
2. 多张：**前端并发 N 个任务**，text 和 multi 模式新增「生成数量」控件；batch 保持现状并发。

---

## 历史实现要点

### 1. 后端 `server/index.js`
- 保留轻量管理接口：`/api/health`, `/api/tasks`, `/api/tasks/:taskId`, `/api/logs`, `/api/download-image`
- 保留本地开发转发能力

### 2. 前端直连与并发
- KIE 文件流直传: `https://kieai.redpandaai.co/api/file-stream-upload`
- KIE 任务创建与轮询: `https://api.kie.ai/api/v1/jobs/createTask` / `recordInfo`
- API Mart 直连: `https://api.apimart.ai/v1/images/generations` / `tasks/:id`
