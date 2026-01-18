# AI Note for Obsidian

AI-powered intelligent note management plugin for Obsidian.

## Features

- **Auto Archive**: Automatically classify and organize notes using AI
- **Daily/Weekly Review**: Generate intelligent work summaries with change tracking
- **Research Generation**: AI-powered research topic generation based on your identity and content
- **Identity Management**: Understand your role and focus areas
- **Scheduled Tasks**: Automated daily research generation

## Installation

1. Download the latest release from the [Releases](../../releases) page
2. Unzip the downloaded file
3. Move the extracted folder to your vault's `.obsidian/plugins/` directory
4. Enable the plugin in Obsidian settings

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Configuration

### API 服务配置

插件支持两种使用方式：

#### 方式 1：自托管（免费）✅ 当前已支持
使用你自己的 OpenRouter API Key：
1. 访问 [OpenRouter.ai](https://openrouter.ai/) 获取 API Key
2. 在插件设置中配置 API Key
3. 选择你需要的基础模型（推荐 deepseek-v3.2，性价比高）

#### 方式 2：官方服务（订阅制）🚧 规划中
- **免费层**：每天 50 次请求，适合轻度使用
- **基础版**：¥29/月，每天 500 次请求 + GPT-4/Claude 支持
- **专业版**：¥99/月，无限请求 + 多模型 + 优先支持

### 其他配置

在 Obsidian 设置 > 社区插件 > AI Note 中配置：

- **Max Diff Lines**: Maximum diff lines in reviews (default: 1000)
- **Day Boundary**: Daily review time boundary (natural/rolling)
- **Scheduler**: Enable automatic research generation

## Data Storage

All plugin data is stored in your vault's `.ai-note/` directory:

- `summaries/`: File summary cache
- `folder-summaries/`: Folder theme cache
- `snapshots/`: File snapshots for review
- `identity/`: User identity profile
- `reviews/`: Daily and weekly review reports
- `research/`: Research topics and reports

## License

MIT

**开源说明**：本插件完全开源免费，你可以：
- ✅ 自由使用、修改、分发
- ✅ 用于个人或商业项目
- ✅ 提交修改回原项目

**后端服务**：AI 调用使用 OpenRouter API，用户需自行配置 API Key并遵守其服务条款。
