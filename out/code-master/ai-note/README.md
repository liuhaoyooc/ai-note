<div align="center">

# AI Note

**AI 智能笔记助手 - 让 Obsidian 更智能**

[![Release](https://img.shields.io/github/v/release/liuhaoyooc/ai-note)](https://github.com/liuhaoyooc/ai-note/releases)
[![License](https://img.shields.io/github/license/liuhaoyooc/ai-note)](LICENSE)
[![Hits](https://hits.seeyoufarm.com/api/count/inc/badge.svg?url=https%3A%2F%2Fgithub.com%2Fliuhaoyooc%2Fai-note&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://github.com/liuhaoyooc/ai-note)

自动摘要归档 · 每日智能复盘 · 主题调研生成 · 身份识别分析

[English](#english) | [中文文档](#中文文档)

</div>

---

## 中文文档

### ✨ 功能特性

AI Note 是一款功能强大的 Obsidian 插件，通过 AI 技术让你的笔记管理更加智能高效：

| 功能 | 说明 |
|------|------|
| 🗃️ **自动归档** | AI 分析笔记内容，自动分类归档到对应目录 |
| 📊 **每日复盘** | 智能追踪笔记变更，生成每日工作总结 |
| 📈 **每周复盘** | 一周工作回顾，洞察你的知识产出趋势 |
| 🔍 **智能调研** | 基于你的笔记内容，自动生成技术研究主题 |
| 👤 **身份识别** | AI 分析你的笔记风格，识别你的角色和关注领域 |
| ⏰ **定时任务** | 每日自动生成调研报告，无需手动操作 |

---

### 🚀 快速开始

#### 安装方法

**方式 1：通过 Obsidian 社区插件安装（推荐）**

1. 打开 Obsidian 设置 > 社区插件
2. 浏览插件市场，搜索 "AI Note"
3. 点击安装并启用

**方式 2：手动安装**

1. 从 [Releases](../../releases) 页面下载最新版本
2. 解压文件到你的 vault 的 `.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用插件

---

### ⚙️ 配置说明

#### API 配置

插件需要配置 AI API 才能使用，支持以下方式：

##### 方式 1：自托管（免费）✅ 推荐

使用你自己的 OpenRouter API Key：

1. 访问 [OpenRouter.ai](https://openrouter.ai/) 注册并获取 API Key
2. 在插件设置中填入 API Key
3. 选择基础模型（推荐 `deepseek-v3.2`，性价比高）

**优势**：
- 完全免费控制
- 数据隐私安全
- 支持多种模型

##### 方式 2：官方服务（订阅制）🚧 规划中

| 套餐 | 价格 | 配额 |
|------|------|------|
| 免费层 | 免费 | 每天 50 次请求 |
| 基础版 | ¥29/月 | 每天 500 次请求 + GPT-4/Claude |
| 专业版 | ¥99/月 | 无限请求 + 多模型 + 优先支持 |

---

#### 插件设置

在 Obsidian 设置 > 社区插件 > AI Note 中配置：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| **Max Diff Lines** | 复盘中显示的最大差异行数 | 1000 |
| **Day Boundary** | 每日复盘的时间边界（自然日/滚动日） | natural |
| **Scheduler** | 是否启用定时调研生成 | 关闭 |
| **Research Time** | 每日调研生成时间 | 10:00 |

---

### 📂 数据存储

插件数据存储在你的 vault 的 `.ai-note/` 目录：

```
.ai-note/
├── summaries/           # 文件摘要缓存
├── folder-summaries/    # 文件夹主题缓存
├── snapshots/           # 文件快照（用于复盘）
├── identity/            # 用户身份档案
├── reviews/             # 每日/每周复盘报告
└── research/            # 调研主题和报告
```

---

### 🎯 使用指南

#### 自动归档

点击左侧工具栏的 📦 图标，或使用命令面板 (`Ctrl/Cmd + P`)：

1. 执行 `Archive files` 命令
2. 插件会自动：
   - 生成笔记摘要
   - 分析文件夹主题
   - AI 分类笔记
   - 移动到对应目录

#### 每日复盘

执行 `Generate daily review` 命令：

- 追踪今日所有笔记变更
- 智能总结工作内容
- 生成 Markdown 格式报告

#### 智能调研

执行 `Generate research` 命令：

1. 分析你的笔记内容
2. 识别你的关注领域
3. 生成技术研究主题
4. 自动生成调研报告

---

### 🔧 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test
```

---

### 📝 更新日志

**v1.0.0** (2025-01-18)
- ✨ 首次发布
- 🎉 自动归档、每日复盘、智能调研功能上线
- 🔧 提示词模板管理系统
- 📚 完整的测试覆盖

---

### 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

### 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

**开源说明**：本插件完全开源免费，你可以：
- ✅ 自由使用、修改、分发
- ✅ 用于个人或商业项目
- ✅ 提交修改回原项目

**后端服务**：AI 调用使用 OpenRouter API，用户需自行配置 API Key 并遵守其服务条款。

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star！**

Made with ❤️ by [liuhaoyooc](https://github.com/liuhaoyooc)

</div>

---

## English

### Features

AI Note is a powerful Obsidian plugin that makes your note management smarter and more efficient:

| Feature | Description |
|---------|-------------|
| 🗃️ **Auto Archive** | AI analyzes note content and automatically categorizes them |
| 📊 **Daily Review** | Track note changes and generate daily work summaries |
| 📈 **Weekly Review** | Weekly work review with insights into your knowledge trends |
| 🔍 **Smart Research** | Generate technical research topics based on your notes |
| 👤 **Identity Analysis** | AI recognizes your role and focus areas from your writing style |
| ⏰ **Scheduled Tasks** | Auto-generate daily research reports |

---

### Installation

**Method 1: Community Plugins (Recommended)**

1. Go to Settings > Community Plugins
2. Browse and search for "AI Note"
3. Click Install and Enable

**Method 2: Manual Installation**

1. Download from [Releases](../../releases)
2. Extract to your vault's `.obsidian/plugins/` directory
3. Enable in Obsidian settings

---

### Configuration

#### API Setup

**Self-hosted (Free)** ✅ Recommended

1. Get API Key from [OpenRouter.ai](https://openrouter.ai/)
2. Configure in plugin settings
3. Choose your model (recommend `deepseek-v3.2`)

---

### Usage

#### Commands

- `Archive files` - Auto-categorize and organize notes
- `Generate daily review` - Create daily work summary
- `Generate weekly review` - Create weekly review
- `Generate research` - Generate research topics and reports

---

### License

MIT License - See [LICENSE](LICENSE)

---

<div align="center">

**If you find this project helpful, please give it a ⭐ Star!**

Made with ❤️ by [liuhaoyooc](https://github.com/liuhaoyooc)

</div>
