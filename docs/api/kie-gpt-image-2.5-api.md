# KIE.ai GPT Image 2.5 API 开发与调用规范

> 最新版本：2026 年 9 月标准规范  
> 适用模型：`gpt-image-2-5-flare`（极速高精）与 `gpt-image-2-5-sunburst`（终极细节）

---

## 1. 概述与核心能力

GPT Image 2.5 是 OpenAI 于 2026 年 9 月发布的最新一代图像生成与重绘大模型，在主体一致性、多语言文字渲染排版、自然光影物理质感以及多轮图生图控制上均较前代实现跨越式升级。

KIE.ai 作为上游接口供应商，提供异步任务流驱动的 GPT Image 2.5 图像生成服务，分为两大模型分支与四种能力接口：

| 模型分类 | 文生图模型标识 (model) | 图生图模型标识 (model) | 特性与适用场景 |
| :--- | :--- | :--- | :--- |
| **GPT Image 2.5 Flare** (推荐) | `gpt-image-2-5-flare-text-to-image` | `gpt-image-2-5-flare-image-to-image` | **生成速度提升约 50%**，出图快、画质优秀，推荐日常创作、海报原型、高并发场景 |
| **GPT Image 2.5 Sunburst** | `gpt-image-2-5-sunburst-text-to-image` | `gpt-image-2-5-sunburst-image-to-image` | **高精度光影、材质与精细重绘**，适合商业精修、长流程一致性角色与多参考图融合 |
| *GPT Image 2 (兼容)* | `gpt-image-2-text-to-image` | `gpt-image-2-image-to-image` | 历史兼容模型，建议迁移至 2.5 版本 |

---

## 2. 认证与基础地址

所有接口均需在 HTTP Header 中携带 Bearer Token：

```http
Authorization: Bearer YOUR_KIE_API_KEY
```

- **任务管理网关 (Jobs API)**: `https://api.kie.ai/api/v1/jobs`
- **文件流直传网关**: `https://kieai.redpandaai.co/api/file-stream-upload`
- **网络图片转存网关**: `https://kieai.redpandaai.co/api/file-url-upload`

---

## 3. 标准生成流程

完整的调用流程包含三个主要环节：
1. **参考图准备**（图生图）：通过文件流直传或 URL 导入取得可访问的 `downloadUrl`。
2. **创建异步生图任务**：向 `createTask` 提交提示词与生成参数，获取 `taskId`。
3. **轮询或回调结果**：通过 `recordInfo` 查询任务执行状态，成功后取得 `resultUrls`。

```
[客户端] ──(1. 上传图片)──> [KIE 文件网关]
   │                          │
   │ <── downloadUrl ─────────┘
   │
   ├──(2. createTask)───────> [KIE 任务服务]
   │ <── taskId ──────────────┘
   │
   └──(3. 轮询 recordInfo)───> [KIE 任务服务]
     <── resultUrls ──────────┘
```

---

## 4. 接口详细说明

### 4.1 任务创建 (`createTask`)

- **方法**: `POST`
- **地址**: `https://api.kie.ai/api/v1/jobs/createTask`
- **Content-Type**: `application/json`

#### 请求参数 (Body)

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `model` | string | 是 | 模型名称，严格匹配 2.5 模型命名。 |
| `input` | object | 是 | 核心生图参数对象，见下表。 |
| `callBackUrl` | string | 否 | 任务完成后的 HTTP POST Webhook 回调地址。 |

#### `input` 对象参数

| 字段名 | 类型 | 必填 | 默认值 | 详细说明 |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | 是 | 无 | 图像生成/重绘提示词，支持中英文，最大 20,000 字符。 |
| `aspect_ratio`| string | 否 | `auto` | 画幅比例。可选值：`auto`, `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`, `9:21`, `2:1`, `1:2`, `5:4`, `4:5`, `3:1`, `1:3`。<br>*注：2K/4K 下暂不支持 5:4, 4:5, 3:1, 1:3, 9:21。* |
| `resolution` | string | 否 | `1K` | 分辨率档位。支持 `1K`、`2K`、`4K`。 |
| `input_urls` | array | 条件 | `[]` | 图生图模式下的参考图公网 URL 列表，最多支持 16 张。文生图模式请留空或不传。 |

#### 请求示例 (文生图)

```json
{
  "model": "gpt-image-2-5-flare-text-to-image",
  "input": {
    "prompt": "赛博朋克风格未来雨夜街道，霓虹倒影，高细节电影画质，8k resolution",
    "aspect_ratio": "16:9",
    "resolution": "2K"
  }
}
```

#### 请求示例 (图生图)

```json
{
  "model": "gpt-image-2-5-sunburst-image-to-image",
  "input": {
    "prompt": "保持人物主体五官与发型不变，将背景替换为北欧雪山木屋，柔和日暮自然光感",
    "aspect_ratio": "3:4",
    "resolution": "4K",
    "input_urls": [
      "https://file.kie.ai/gpt-image-2-studio/1727600000000_portrait.png"
    ]
  }
}
```

#### 响应结构

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "c1f7a0709f6b4904b77f805a8b7dd558"
  }
}
```

---

### 4.2 任务状态与结果查询 (`recordInfo`)

- **方法**: `GET`
- **地址**: `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={taskId}`

#### 响应结构 (成功完成)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "c1f7a0709f6b4904b77f805a8b7dd558",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://file.kie.ai/outputs/sample-2-5-result.png\"]}",
    "failCode": null,
    "failMsg": null
  }
}
```

#### `state` 状态说明

- `waiting`：排队中或正在渲染计算中（继续轮询，建议间隔 3.5 秒）。
- `success`：生成成功，解析 `resultJson` 得到 `resultUrls` 数组。
- `fail`：生成失败，错误原因见 `failCode` 与 `failMsg`。

---

### 4.3 文件上传接口 (`file-stream-upload`)

针对浏览器本地选择的文件，上传到 KIE 专用存储桶并换取直链：

- **方法**: `POST`
- **地址**: `https://kieai.redpandaai.co/api/file-stream-upload`
- **Content-Type**: `multipart/form-data`

#### 表单字段

- `file`: 二进制图片文件（支持 JPG / PNG / WEBP，单张 ≤ 30MB）
- `uploadPath`: 目录隔离标识，如 `gpt-image-2-5-studio`
- `fileName`: 规范化文件名，如 `1727600000000_asset.png`

#### 响应结果

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "downloadUrl": "https://file.kie.ai/gpt-image-2-5-studio/1727600000000_asset.png"
  }
}
```

---

## 5. 错误代码与重试策略指南

| 错误特征 | 可能原因 | 应对策略 |
| :--- | :--- | :--- |
| `code: 401 / 403` | API Key 错误、欠费或权限受限 | 校验 Key 配置与账户余额 |
| `failCode: sensitive / safety` | 提示词或输入图触发上游安全合规风控 | 软化敏感词汇后重试 |
| `failCode: timeout / server_error` | 上游算力排队或并发超时 | 采用指数退避重试（5s / 12s），最多 3 次 |
| `state: waiting 持续超 5 分钟` | 上游节点负载极高 | 记录 taskId，客户端支持随时按 ID 调取恢复 |
