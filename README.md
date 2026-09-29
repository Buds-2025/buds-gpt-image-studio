# buds-gpt-image-studio · 专业图像生成工作台

[![GPT Image 2.5 Ready](https://img.shields.io/badge/Model-GPT%20Image%202.5-amber.svg)](docs/api/model-comparison.md)
[![Channels](https://img.shields.io/badge/Engines-KIE.ai%20%7C%20API%20Mart-blue.svg)](docs/index.md)
[![Design Skill](https://img.shields.io/badge/Aesthetics-Hallmark%20Workbench-emerald.svg)](skill/hallmark/SKILL.md)

本项目是一个高保真 AI 图像生成与设计工作台，已全面适配 2026 年 9 月发布的最新 **GPT Image 2.5** 模型架构（含 `Flare` 极速高精与 `Sunburst` 终极细节双分支），支持 **KIE.ai** 与 **API Mart** 双通道驱动。前端界面遵循 Hallmark 触感反 AI-slop 设计哲学重构，提供专业工坊级的排版与交互体验。

---

## 🌟 核心特性与架构升级

### 1. 全面支持 GPT Image 2.5 模型分支
- **⚡ GPT Image 2.5 Flare（极速高精 · 推荐）**：出图耗时缩减 50%（约 6~12 秒），在保持高保真画质的同时大幅提升日常创作与批量生成效率。
  - KIE 标识：`gpt-image-2-5-flare-text-to-image` / `gpt-image-2-5-flare-image-to-image`
  - API Mart 标识：`gpt-image-2.5-flare`
- **✨ GPT Image 2.5 Sunburst（终极细节 · 精修）**：专注于极端微距材质还原、物理漫反射光影与复杂多图融合。
  - KIE 标识：`gpt-image-2-5-sunburst-text-to-image` / `gpt-image-2-5-sunburst-image-to-image`
  - API Mart 标识：`gpt-image-2.5-sunburst`
- **🏛️ GPT Image 2（兼容历史）**：保留对 2.0 经典版本的向下兼容能力。

### 2. 双通道上游无缝切换
- **KIE.ai 通道**：支持单张 30MB 级高分辨率图片直传，提供精确到阶段的重试与状态流。
- **API Mart 通道**：标准 OpenAI Images 协议，全面支持 URL 直链与 Base64 格式混填。
- **密钥独立管理与连通性自检**：页面顶部提供双通道凭证快速切换与一键 Ping 连通性测试。

### 3. 三大专业任务工作流
- **文生图 (Text-to-Image)**：支持单次并发生成 1 ~ 8 个独立构图方案。
- **多图参考 (Multi-Image Reference)**：合并多张参考图（最多 16 张）输入单个任务，融合特征创作新图像。
- **批量独立修图 (Batch Generation)**：为选中的每张参考图建立独立并发任务，支持 1 ~ 8 并发调节。

### 4. 精细化审美优化与装修 (Hallmark Skill)
- **Macrostructure: 05-Workbench**：遵循 Hallmark 工作台布局，去伪求真，严禁虚假渐变与无意义外壳（Card-in-card、伪浏览器栏）。
- **Obsidian Ochre 调色系统**：全站采用 OKLCH 色彩体系，杜绝纯黑（`#000`）与纯白（`#fff`），以暖黑黑曜石为底，点缀 3% 内的琥珀信号色。
- **2+1 字体规范**：标题采用古典沉稳的 Newsreader Roman 衬线，正文搭配 Plus Jakarta Sans，技术参数使用 JetBrains Mono。
- **全状态触感反馈 (8 Interactive States)**：所有控制件严格实现 Default、Hover、Focus-Visible、Active、Disabled、Loading、Error、Success。
- **全端响应式**：严格适配 320px、375px、414px、768px 及宽屏工坊。

---

## 📁 项目目录结构

```text
├── docs/                        # 项目与 API 开发文档中心
│   ├── api/
│   │   ├── kie-gpt-image-2.5-api.md       # KIE GPT Image 2.5 接口调用规范
│   │   ├── apimart-gpt-image-2.5-api.md   # API Mart GPT Image 2.5 规范
│   │   └── model-comparison.md            # 2.5 vs 2.0 及 Flare vs Sunburst 对比
│   ├── archive/                 # 架构演进与历史计划归档
│   │   └── direct-upload-fix-plan.md      # 早期大图直传与 413 架构演进说明
│   ├── legacy/                  # 历史 2.0 文档归档目录
│   └── index.md                 # 文档总索引
├── src/                         # 前端模块化源码 (React 19 + Vite)
│   ├── components/
│   │   ├── Header.jsx           # 顶部导航、通道切换与 API Key 管理
│   │   ├── ControlPanel.jsx     # 模型架构、模式选择、提示词与输出参数
│   │   ├── ImageDropzone.jsx    # 拖拽上传、URL 导入与参考图画廊
│   │   ├── ResultPanel.jsx      # 实时画布、历史原图库、全屏灯箱与日志
│   │   ├── TaskCard.jsx         # 任务卡片、多阶段进度与诊断详情
│   │   ├── HistoryViewer.jsx    # SQLite 历史原图查询组件
│   │   └── LogViewer.jsx        # 实时终端流日志组件
│   ├── services/
│   │   └── api.js               # 双通道请求抽象、文件上传、轮询与 SQLite 状态同步
│   ├── App.jsx                  # 根控制器与全局键盘快捷键 (Ctrl+Enter)
│   ├── main.jsx                 # 应用挂载入口
│   └── styles.css               # Hallmark Obsidian Ochre 触感设计样式规范
├── server/                      # 本地代理与 SQLite 数据存储服务
│   ├── database.js              # sql.js (SQLite WASM) 任务与事件持久化
│   └── index.js                 # Express 路由服务、代理回退与下载端点
├── skill/hallmark/              # Hallmark Anti-AI-slop 设计技能库
├── logs/                        # 运行与请求诊断日志
├── data/                        # SQLite 数据库文件 (studio.sqlite)
├── package.json                 # 项目配置 (gpt-image-2-5-studio v2.5.0)
└── vite.config.js               # Vite 8 开发构建与代理配置
```

---

## 🚀 快速启动

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装与运行

```bash
# 1. 安装依赖包
npm install

# 2. 启动全功能工作台 (包含本地代理/持久化后端与 Vite 前端)
npm start
```

启动完成后，浏览器访问：
```text
http://127.0.0.1:5173
```

在右上角点击「配置 API 密钥」，输入您的 **KIE.ai API Key** 或 **API Mart Token**，点击「测试当前通道」验证无误后即可投入创作！

### 快捷键指南
- `Ctrl + Enter` 或 `Cmd + Enter`：在任何输入状态下一键提交生图任务。
- `Esc`：关闭大图预览灯箱。

---

## 🛠️ 本地服务与 API 接口说明

后端服务默认运行在 `8787` 端口：

| 接口地址 | 方法 | 功能说明 |
| :--- | :--- | :--- |
| `POST /api/test-key` | POST | 校验当前通道 API Key 连通性 |
| `POST /api/create-task` | POST | 创建 2.5 异步生图任务 (本地代理回退) |
| `POST /api/task-info` | POST | 查询任务进度与生成结果 |
| `GET /api/download-image` | GET | 代理下载高清大图，规避浏览器跨域限制 |
| `GET /api/tasks` | GET | 分页检索 SQLite 任务记录 |
| `GET /api/tasks/:taskId` | GET | 读取单个任务详情与生命周期日志 |
| `GET /api/logs` | GET | 读取系统调试诊断事件流 |
| `GET /api/database/export` | GET | 导出本地 SQLite 数据库备份 |

---

## 📖 相关文档链接

- [GPT Image 2.5 Studio 文档总索引](docs/index.md)
- [GPT Image 2.5 选型指南与性能对比](docs/api/model-comparison.md)
- [KIE.ai 接口文档 (最新 2.5)](docs/api/kie-gpt-image-2.5-api.md)
- [API Mart 接口文档 (最新 2.5)](docs/api/apimart-gpt-image-2.5-api.md)
- [Hallmark 设计哲学与工程规范](skill/hallmark/SKILL.md)
