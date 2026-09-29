# API Mart GPT Image 2.5 API 开发与调用规范

> 最新版本：2026 年 9 月标准规范  
> 适用模型：`gpt-image-2.5-flare`（极速通道）与 `gpt-image-2.5-sunburst`（极致细节）

---

## 1. 概述与核心能力

API Mart 提供高度兼容 OpenAI Images 标准协议的聚合中继接口。随着 2026 年 9 月 GPT Image 2.5 的发布，API Mart 同步上线两大分支模型，支持文生图、单图参考与最多 16 张多图参考融合。

| 模型名 (`model`) | 推荐定位 | 延迟表现 | 特性说明 |
| :--- | :--- | :--- | :--- |
| **`gpt-image-2.5-flare`** (默认) | 快速概念设计、日常创作、批量多图 | ~50% 延迟优化 | 响应速度最快，图像质感清透，文字构图稳固 |
| **`gpt-image-2.5-sunburst`** | 商业质感海报、微距材质、复杂多轮图生图 | 极致画质优先 | 光影拟真度极高，复杂构图与多图主体融合保持率卓越 |
| *`gpt-image-2`* (兼容) | 历史版本 | 标准耗时 | 供早期项目兼容过渡 |

---

## 2. 认证与端点配置

- **网关根地址**: `https://api.apimart.ai/v1`
- **鉴权方式**: HTTP Bearer Token
  ```http
  Authorization: Bearer YOUR_APIMART_API_KEY
  ```
- **核心接口**:
  - 创建任务：`POST https://api.apimart.ai/v1/images/generations`
  - 任务状态查询：`GET https://api.apimart.ai/v1/tasks/{taskId}`

---

## 3. 请求参数规范 (`/images/generations`)

### Body 字段定义

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | 是 | `gpt-image-2.5-flare` | 模型名称，填写 `gpt-image-2.5-flare` 或 `gpt-image-2.5-sunburst` |
| `prompt` | string | 是 | 无 | 图像描述提示词，上限 20,000 字符 |
| `size` | string | 否 | `1:1` | 画幅比例或像素尺寸。支持 `auto`、`1:1`、`16:9`、`9:16`、`4:3`、`3:4`、`3:2`、`2:3`、`21:9`、`9:21`、`2:1`、`1:2`、`5:4`、`4:5`、`3:1`、`1:3` 共 15 种标准比例（传 `auto` 时默认按 1:1） |
| `resolution` | string | 否 | `1k` | 渲染分辨率档位，可选 `1k`、`2k`、`4k`，由该字段精确控制像素采样量 |
| `image_urls` | array | 否 | `[]` | 图生图参考图列表（最多 16 张，单张最大 20MB，总量上限 256MB），支持公网 HTTP/HTTPS 直链或 Data URL（`data:image/...;base64,...`）混填 |
| `n` | integer | 否 | `1` | 单次出图数量（API Mart 任务级单次返回 1 张，多张由前端并发发起） |
| `official_fallback`| boolean | 否 | `true` | 上游节点异常时是否自动切换同源官方渠道兜底 |

> **字段兼容性特别提示**：  
> OpenAI 其他标准字段（如 `quality`、`style`、`response_format`）在 API Mart 服务端**不被支持并会被忽略**。请勿在请求中依赖 `quality` 参数，画面精细度统一通过 `resolution`（`1k` / `2k` / `4k`）进行阶梯控制。任务输出始终为直链 URL。

### 请求体示例

```json
{
  "model": "gpt-image-2.5-flare",
  "prompt": "一只佩戴复古黄铜飞行眼镜的柴犬宇航员，漂浮在微光尘埃星云中，虚幻引擎风格，柔和丁达尔光线",
  "n": 1,
  "size": "16:9",
  "resolution": "2k",
  "official_fallback": true
}
```

### 响应示例 (创建成功)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "task_id": "apimart-task-7df91ca4b",
    "status": "submitted"
  }
}
```

---

## 4. 任务状态轮询与结果解析 (`/tasks/{taskId}`)

- **方法**: `GET`
- **地址**: `https://api.apimart.ai/v1/tasks/{taskId}`

### 响应状态流转

`status` 字段代表任务生命周期：
- `submitted` / `processing`: 排队中或正在渲染中
- `completed`: 渲染完成
- `failed`: 失败

### 渲染完成响应示例

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": "apimart-task-7df91ca4b",
    "status": "completed",
    "result": {
      "images": [
        {
          "url": "https://img.apimart.ai/artifacts/2026/09/sample-flare-output.png"
        }
      ]
    }
  }
}
```

---

## 5. 多语言调用示例

### 5.1 JavaScript / Fetch (前端浏览器直连)

```javascript
const APIMART_BASE = "https://api.apimart.ai/v1";

async function generateImage({ apiKey, prompt, model = "gpt-image-2.5-flare", size = "16:9", resolution = "2k" }) {
  // 1. 创建任务
  const createRes = await fetch(`${APIMART_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, prompt, size, resolution, n: 1, official_fallback: true })
  });
  const createData = await createRes.json();
  const taskId = createData.data?.task_id || createData.data?.id;

  // 2. 轮询结果
  while (true) {
    await new Promise(r => setTimeout(r, 3000));
    const queryRes = await fetch(`${APIMART_BASE}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const info = await queryRes.json();
    if (info.data?.status === "completed") {
      return info.data.result.images[0].url;
    }
    if (info.data?.status === "failed") {
      throw new Error(info.data.error?.message || "生图失败");
    }
  }
}
```

### 5.2 Python (使用 requests)

```python
import time
import requests

API_KEY = "your_apimart_token"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

payload = {
    "model": "gpt-image-2.5-flare",
    "prompt": "晨雾弥漫的高山湖泊，水面如镜倒映秋日彩林，高画质摄影",
    "size": "16:9",
    "resolution": "2k",
    "n": 1,
}

resp = requests.post("https://api.apimart.ai/v1/images/generations", json=payload, headers=HEADERS)
task_id = resp.json()["data"]["task_id"]

while True:
    time.sleep(3)
    check = requests.get(f"https://api.apimart.ai/v1/tasks/{task_id}", headers=HEADERS).json()
    status = check["data"]["status"]
    if status == "completed":
        print("图片地址:", check["data"]["result"]["images"][0]["url"])
        break
    elif status == "failed":
        print("任务失败:", check["data"].get("error"))
        break
```
