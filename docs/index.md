# GPT Image 2.6 Studio 文档中心总索引

本项目已接入 **GPT Image 2.6** 的 Flare、Sunburst、Economy 三个模型，并保留 2.5 与 2.0。Flare 和 Sunburst 支持 KIE.ai 与 API Mart 双通道；Economy 为 KIE.ai 专属。原有文生图、多图参考、批量修图、轮询、重试、历史记录与下载流程保持不变。

---

## 📚 核心规范与接口文档

1. **[GPT Image 2.6 模型接入与选型](api/model-comparison.md)**
   包含三个 2.6 模型的双通道标识、分辨率、画幅限制与旧版兼容规则。

2. **[KIE.ai GPT Image 2.5 接口调用规范（历史）](api/kie-gpt-image-2.5-api.md)**
   记载 KIE.ai 的 `gpt-image-2-5-flare-*` 和 `gpt-image-2-5-sunburst-*` 文生图与图生图参数、16 种比例与 1K/2K/4K 分辨率（含 2K/4K 比例限制说明）、文件流直传接口（支持单张 30MB）及异步查询与回调规范。

3. **[API Mart GPT Image 2.5 接口调用规范（历史）](api/apimart-gpt-image-2.5-api.md)**
   详述 API Mart 的 `gpt-image-2.5-flare` 和 `gpt-image-2.5-sunburst` 标准 OpenAI 兼容接口，涵盖 15 种标准比例与 auto 适配、单张 20MB / 总量 256MB 输入约束，附带 cURL / JS / Python 示例。

---

## 🏛️ 历史与归档文档

- **[早期大图直传与 413 架构演进计划](archive/direct-upload-fix-plan.md)**：早期针对 Vercel 4.5MB 限制所设计的「大图直传 + 前端多张并发」架构演进方案。
- **[原 KIE 文生图说明（2.0 归档）](legacy/kie-API调用说明-文生图.txt)**：初代 2.0 版本的接口参数原始文本。
- **[原 KIE 图生图说明（2.0 归档）](legacy/kie-API调用说明-图生图.txt)**：初代 2.0 版本图生图原始文本。
- **[原 API Mart 接口说明（2.0 归档）](legacy/API调用说明-API Mart.txt)**：API Mart 2.0 早期版本文本。

---

## 🎨 设计与审美规范

- **[Hallmark 反 AI-Slop 设计规范](../skill/hallmark/SKILL.md)**：遵循 05-Workbench 结构、OKLCH 调色体系、2+1 字体规范与 8 态触感交互。
