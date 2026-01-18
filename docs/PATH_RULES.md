# 路径组装规则文档

> **Obsidian Plugin 路径处理完整规则**

---

## 核心原则

**Obsidian Filesystem Adapter 的路径规则：**

| 路径类型 | Obsidian adapter 需要的格式 | 示例 |
|---------|---------------------|------|
| 插件数据目录 (JSON 缓存) | **完整路径**，从 vault root 开始 | `.obsidian/plugins/ai-note/data/cache/summaries/xxx.json` |
| Markdown 文件 | **相对路径**，从 vault root 开始 | `复盘/2025-01-18.md` |

**关键区别：**
- 插件数据目录不在用户的 Markdown 文件系统中，需要完整路径
- Markdown 文件在用户 vault 中，使用相对路径

---

## PathResolver 统一路径处理

### 核心类：PathResolver

```typescript
import { PathResolver, PathType } from '../utils/pathResolver';

// 解析路径为正确的格式
const fullPath = PathResolver.resolvePath(path, PathType.PluginData, configDir);
```

### 路径类型

```typescript
enum PathType {
    PluginData,    // 插件数据目录文件
    Markdown,      // Markdown 文件（vault 相对路径）
}
```

### 使用示例

```typescript
// 插件数据文件 - 添加完整路径前缀
const cachePath = PathResolver.resolvePath('data/cache/summaries/abc.json', PathType.PluginData, 'ai-note');
// 结果: ".obsidian/plugins/ai-note/data/cache/summaries/abc.json"

// Markdown 文件 - 移除插件路径前缀
const mdPath = PathResolver.resolvePath('.obsidian/plugins/ai-note/复盘/2025-01-18.md', PathType.Markdown, 'ai-note');
// 结果: "复盘/2025-01-18.md"

// 处理重复前缀
const duplicatePath = PathResolver.resolvePath('.obsidian/plugins/.obsidian/plugins/ai-note/data/cache/summaries', PathType.PluginData, 'ai-note');
// 结果: ".obsidian/plugins/ai-note/data/cache/summaries"
```

---

## PathManager 返回值规范

### 1. 缓存目录路径（相对路径）

```typescript
// 返回格式：相对路径（不包含 .obsidian/plugins/ 前缀）
get summariesDir(): string
// 返回: "data/cache/summaries"

get folderSummariesDir(): string
// 返回: "data/cache/folder-summaries"

get snapshotsDir(): string
// 返回: "data/cache/snapshots"

get identityDir(): string
// 返回: "data/cache/identity"

get researchTopicsDir(): string
// 返回: "data/cache/research/topics"

get researchHistoryDir(): string
// 返回: "data/cache/research/history"
```

### 2. 缓存文件路径（相对路径）

```typescript
getSummaryPath(fileId: string): string
// 输入: "abc123"
// 返回: "data/cache/summaries/abc123.json"

getFolderSummaryPath(folderId: string): string
// 输入: "tech-notes"
// 返回: "data/cache/folder-summaries/tech-notes.json"

getSnapshotPath(hash: string): string
// 返回: "data/cache/snapshots/{hash}.sn"

getSnapshotIndexPath(): string
// 返回: "data/cache/snapshots/index.json"

getIdentityPath(): string
// 返回: "data/cache/identity/profile.json"

getResearchTopicsPath(date: string): string
// 返回: "data/cache/research/topics/{date}.json"

getResearchHistoryIndexPath(): string
// 返回: "data/cache/research/history/index.json"
```

### 3. Markdown 文件路径（相对路径）

```typescript
get reviewsDir(): string
// 返回: "复盘"

get dailyReviewsDir(): string
// 返回: "复盘/daily"

get weeklyReviewsDir(): string
// 返回: "复盘/weekly"

get researchReportsDir(): string
// 返回: "调研"

get unsortedDir(): string
// 返回: "待整理"

getDailyReviewPath(date: string): string
// 返回: "复盘/daily/{date}.md"

getWeeklyReviewPath(weekNumber: number, year: number): string
// 返回: "复盘/weekly/{year}-W{weekNumber}.md"

getResearchReportPath(date: string, slug: string): string
// 返回: "调研/{date}-{slug}.md"
```

---

## StorageService 路径处理

### 使用 PathResolver 统一处理

```typescript
// 所有路径处理都通过 PathResolver
async readJson(path: string): Promise<any> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    // ... 使用 fullPath
}

async writeJson(path: string, data: unknown): Promise<void> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    // ... 使用 fullPath
}

async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
    const targetDir = PathResolver.resolvePath(dir, PathType.PluginData, this.configDir);
    // ... 使用 targetDir
}

async exists(path: string): Promise<boolean> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    return await this.vault.adapter.exists(fullPath);
}

async delete(path: string): Promise<void> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    if (await this.vault.adapter.exists(fullPath)) {
        await this.vault.adapter.remove(fullPath);
    }
}

// Markdown 文件不需要路径转换
async writeMarkdown(dir: string, filePath: string, content: string): Promise<void> {
    // 直接使用 dir 和 filePath，不需要转换
}
```

### 转换示例

| PathManager 返回 | PathResolver.resolvePath() 后 | Obsidian adapter 使用 |
|----------------|----------------------|---------------------|
| `data/cache/summaries/abc.json` | `.obsidian/plugins/ai-note/data/cache/summaries/abc.json` | ✓ 正确 |
| `复盘/2025-01-18.md` | `复盘/2025-01-18.md` | ✓ 正确 |
| `.obsidian/plugins/ai-note/data/...` | `.obsidian/plugins/ai-note/data/...` | ✓ 正确（已包含前缀） |

---

## 各方法中的路径处理

### 1. readJson(path) / writeJson(path, data)

```typescript
// 使用 PathResolver 处理
async readJson(path: string): Promise<any> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    // fullPath 可直接用于 adapter.read()
}

// 调用示例
await this.storage.readJson(this.pathManager.getIdentityPath());
// PathManager 返回: "data/cache/identity/profile.json"
// PathResolver.resolvePath() 后: ".obsidian/plugins/ai-note/data/cache/identity/profile.json"
```

### 2. listCacheFiles(dir, extension)

```typescript
// 使用 PathResolver 处理
async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
    // PathResolver 自动处理重复前缀
    const targetDir = PathResolver.resolvePath(dir, PathType.PluginData, this.configDir);
    // 直接使用 targetDir 调用 adapter.list()
    const listedFiles = await adapter.list(targetDir);
}
```

### 3. exists(path) / delete(path)

```typescript
// 使用 PathResolver 处理
async exists(path: string): Promise<boolean> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    return await this.vault.adapter.exists(fullPath);
}

async delete(path: string): Promise<void> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    if (await this.vault.adapter.exists(fullPath)) {
        await this.vault.adapter.remove(fullPath);
    }
}
```

### 4. writeMarkdown(dir, filePath, content)

```typescript
// Markdown 文件不使用 PathResolver，直接使用相对路径
async writeMarkdown(dir: string, filePath: string, content: string): Promise<void> {
    const fullPath = this.pathManager.joinPaths(dir, filePath);
    // fullPath: "调研/2025-01-18-topic.md"
    // 直接用于 vault.create()
}
```

---

## 调用链路示例

### 示例 1：保存摘要

```typescript
// SummarizerService
const path = this.pathManager.getSummaryPath(fileId);
// 返回: "data/cache/summaries/abc123.json"

await this.storage.writeJson(path, summary);
// StorageService.writeJson() 调用 PathResolver.resolvePath()
// 转换为: ".obsidian/plugins/ai-note/data/cache/summaries/abc123.json"
// adapter.write() 使用完整路径
```

### 示例 2：读取身份

```typescript
// IdentityService
const profilePath = this.pathManager.getIdentityPath();
// 返回: "data/cache/identity/profile.json"

await this.storage.readJson(profilePath);
// StorageService.readJson() 调用 PathResolver.resolvePath()
// 转换为: ".obsidian/plugins/ai-note/data/cache/identity/profile.json"
// adapter.read() 使用完整路径
```

### 示例 3：列出摘要文件

```typescript
// IdentityService
const cachePath = this.pathManager.summariesDir;
// 返回: "data/cache/summaries"

await this.storage.listCacheFiles(cachePath, 'json');
// StorageService.listCacheFiles() 调用 PathResolver.resolvePath()
// 转换为: ".obsidian/plugins/ai-note/data/cache/summaries"
// adapter.list() 使用完整路径
```

### 示例 4：生成调研报告

```typescript
// ResearchService
const fullPath = this.pathManager.getResearchReportPath(today, slug);
// 返回: "调研/2025-01-18-topic.md"

await this.storage.writeMarkdown(this.pathManager.researchReportsDir, `/${today}-${slug}.md`, content);
// 直接使用相对路径，vault.create() 正常处理
```

---

## 总结

| 组件 | 职责 | 返回/使用格式 |
|------|------|--------------|
| **PathManager** | 定义所有路径 | 返回相对路径（缓存文件）或 vault 相对路径（Markdown） |
| **PathResolver** | 统一路径转换 | 根据路径类型自动添加或移除 `.obsidian/plugins/{configDir}/` 前缀 |
| **StorageService** | 使用 PathResolver | 所有方法使用 PathResolver.resolvePath() 处理路径 |
| **Obsidian adapter** | 底层文件系统操作 | 缓存文件需要完整路径，Markdown 文件使用相对路径 |

**关键规则：**
1. **PathManager 总是返回简洁的相对路径**
2. **PathResolver 负责路径类型转换和重复前缀处理**
3. **StorageService 统一使用 PathResolver，不再手动处理前缀**

