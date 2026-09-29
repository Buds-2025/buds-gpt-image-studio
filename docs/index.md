# GPT Image 2.5 Studio 文档中心总索引

欢迎查阅 GPT Image 2.5 Studio 官方开发与操作文档。本项目已全面适配 2026 年 9 月发布的最新 **GPT Image 2.5** 模型架构（含 `Flare` 极速与 `Sunburst` 终极细节双分支），支持 **KIE.ai** 与 **API Mart** 双通道驱动，界面深度落地 Hallmark 工坊触感设计系统。

---

## 📚 核心规范与接口文档

1. **[GPT Image 2.5 选型指南与版本对比](api/model-comparison.md)**  
   全面剖析 2.5 相比 2.0 在文字渲染、主体一致性与次表面材质散射上的升级，深度横向对比 `Flare`（极速通道）与 `Sunburst`（终极细节）的选型建议与适用场景。

2. **[KIE.ai GPT Image 2.5 接口调用规范](api/kie-gpt-image-2.5-api.md)**  
   记载 KIE.ai 的 `gpt-image-2-5-flare-*` 和 `gpt-image-2-5-sunburst-*` 文生图与图生图参数、16 种比例与 1K/2K/4K 分辨率（含 2K/4K 比例限制说明）、文件流直传接口（支持单张 30MB）及异步查询与回调规范。

3. **[API Mart GPT Image 2.5 接口调用规范](api/apimart-gpt-image-2.5-api.md)**  
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
