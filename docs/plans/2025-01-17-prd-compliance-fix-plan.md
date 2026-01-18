# PRD 合规性修复计划

**创建日期**: 2025-01-17
**相关文档**: prds/v0.5.md
**代码仓库**: out/code-master/ai-note

## 概述

本文档详细说明了将 AI Note 插件代码与 PRD v0.5 对齐所需的修复工作。通过对比分析和需求澄清，识别出 6 个需要修复的问题，分为 P0（关键）和 P1（重要）两个优先级。

## 问题汇总

| ID | 优先级 | 问题 | 影响 |
|----|--------|------|------|
| P0-1 | 关键 | 代码中存在14天规则，与PRD不符 | 根目录最近14天的笔记不会被归档 |
| P0-2 | 关键 | 缺少隐藏目录过滤配置 | 无法自定义过滤目录 |
| P0-3 | 关键 | 待整理目录笔记不重新分类 | 低置信度笔记无法自动归档 |
| P1-1 | 重要 | 文件夹摘要更新逻辑不完整 | 摘要保持最多10个样本 |
| P1-2 | 重要 | 缺少启动补执行复盘逻辑 | 插件重启后可能漏掉复盘 |
| P1-3 | 重要 | 仓库概要模板未实现 | 首次运行无概要报告 |

---

## P0-1: 移除14天规则

### 问题描述

`main.ts:213-228` 中实现了14天过滤逻辑，与 PRD 要求不符。PRD 明确规定归档流程应该处理所有根目录笔记，没有时间限制。

### 当前代码

```typescript
// main.ts:213-229
const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

const rootFiles = files.filter(f => {
    const inRoot = !f.path.includes('/');
    const isRecent = this.obsidianHelper.getFileModificationTime(f) >= fourteenDaysAgo;
    return inRoot && !isRecent;  // 排除14天内的文件
});

const skippedFiles = files.filter(f => {
    const inRoot = !f.path.includes('/');
    const isRecent = this.obsidianHelper.getFileModificationTime(f) >= fourteenDaysAgo;
    return inRoot && isRecent;
});
```

### 修复方案

1. **移除时间过滤逻辑**
   - 删除 `fourteenDaysAgo` 计算
   - 删除 `isRecent` 检查
   - 只保留根目录检查：`!f.path.includes('/')`

2. **移除跳过文件逻辑**
   - 删除 `skippedFiles` 相关代码
   - 删除日志输出

3. **修改后的代码**
   ```typescript
   const rootFiles = files.filter(f => {
       return !f.path.includes('/');
   });
   ```

### 测试验证

- [ ] 创建根目录笔记（各种修改时间）
- [ ] 执行归档命令
- [ ] 验证所有根目录笔记都被处理

---

## P0-2: 添加隐藏目录过滤配置

### 问题描述

PRD 要求支持隐藏目录过滤配置，当前代码缺失此功能。需要：
1. 添加配置项到设置
2. 在文件扫描时应用过滤
3. 提供UI配置界面

### 修复方案

#### 1. 更新类型定义 (`src/types/config.ts`)

```typescript
export interface AiNoteSettings {
    // ... existing fields
    archiving: {
        hiddenDirectories: string[];  // 新增：隐藏目录列表
    };
}

export const DEFAULT_SETTINGS: AiNoteSettings = {
    // ... existing fields
    archiving: {
        hiddenDirectories: ['.obsidian', '.git']  // 默认过滤
    }
};
```

#### 2. 更新 PathManager (`src/services/pathManager.ts`)

添加过滤方法：

```typescript
isHiddenDirectory(path: string, hiddenDirs: string[]): boolean {
    const parts = path.split('/');
    for (const part of parts) {
        if (hiddenDirs.includes(part)) {
            return true;
        }
    }
    return false;
}
```

#### 3. 更新归档逻辑 (`src/main.ts`)

在 `executeArchive` 中应用过滤：

```typescript
const files = await this.obsidianHelper.getAllMarkdownFiles();
const rootFiles = files.filter(f => {
    const inRoot = !f.path.includes('/');
    const notHidden = !this.pathManager.isHiddenDirectory(
        f.path,
        this.settings.archiving.hiddenDirectories
    );
    return inRoot && notHidden;
});
```

#### 4. 添加设置UI (`src/main.ts` - AiNoteSettingTab)

```typescript
containerEl.createEl('h3', { text: '归档设置' });

new Setting(containerEl)
    .setName('隐藏目录')
    .setDesc('自动过滤的目录（以 . 开头，如 .obsidian）')
    .addText(text => text
        .setPlaceholder('.obsidian, .git')
        .setValue(this.plugin.settings.archiving.hiddenDirectories.join(', '))
        .onChange(async (value) => {
            this.plugin.settings.archiving.hiddenDirectories =
                value.split(',').map(s => s.trim()).filter(s => s);
            await this.plugin.saveSettings();
        }));
```

### 测试验证

- [ ] 添加 `.obsidian` 到隐藏目录
- [ ] 创建根目录和隐藏目录中的笔记
- [ ] 执行归档，验证隐藏目录笔记被过滤

---

## P0-3: 实现待整理目录重新分类

### 问题描述

PRD 要求"待整理重试：移入待整理目录的笔记会在下次归档时重新尝试分类"。当前代码没有扫描待整理目录的笔记。

### 修复方案

#### 1. 修改归档文件扫描 (`src/main.ts`)

在 `executeArchive` 中添加待整理目录扫描：

```typescript
// 扫描待整理目录的笔记
const unsortedDir = this.pathManager.unsortedDir;
const unsortedFiles = files.filter(f => {
    return f.path.startsWith(unsortedDir + '/');
});

// 合并根目录和待整理目录的笔记
const filesToClassify = [...rootFiles, ...unsortedFiles];
```

#### 2. 更新分类调用

```typescript
const { decisions } = await this.classifierService.classifyFiles(
    filesToClassify.map(f => f.path),  // 使用合并后的列表
    folderSummaries,
    (message) => new Notice(message)
);
```

#### 3. 处理移出待整理目录

当笔记从待整理目录成功归档时，确保文件名处理正确：

```typescript
async handleManualArchive(decisions: Array<{ path: string; targetDir: string }>): Promise<void> {
    for (const decision of decisions) {
        try {
            const fileObj = await this.obsidianHelper.findFile(decision.path);
            if (fileObj) {
                // 从待整理目录移出时，只使用 basename，不保留路径
                const basename = fileObj.basename;
                const newPath = `${decision.targetDir}/${basename}`;
                await this.obsidianHelper.createFolder(decision.targetDir);
                await this.obsidianHelper.moveFile(fileObj, newPath);
            }
        } catch (error) {
            console.error(`[AI Note] Failed to move ${decision.path}:`, error);
        }
    }
}
```

### 测试验证

- [ ] 手动将笔记移至待整理目录
- [ ] 执行归档命令
- [ ] 验证待整理目录的笔记被重新分类
- [ ] 验证成功归档的笔记移出待整理目录

---

## P1-1: 文件夹摘要更新逻辑

### 问题描述

PRD 要求"增量更新文件夹摘要（追加新文件名到 sampleNumbers，取最后 10 个）"。当前代码在 `generateFolderSummaries` 中每次都重新生成摘要，没有增量更新逻辑。

### 当前代码分析

`src/services/summarizerService.ts:308-362`
- 每次归档都调用 `generateFolderSummaries`
- 扫描所有文件夹并生成新摘要
- 没有检查现有摘要是否需要更新

### 修复方案

#### 1. 添加增量更新方法

在 `SummarizerService` 中添加：

```typescript
async updateFolderSummariesForMovedFiles(movedFiles: Array<{ from: string; to: string }>): Promise<void> {
    const affectedFolders = new Set<string>();

    // 收集受影响的文件夹
    for (const move of movedFiles) {
        const fromFolder = move.from.substring(0, move.from.lastIndexOf('/'));
        const toFolder = move.to.substring(0, move.to.lastIndexOf('/'));
        affectedFolders.add(fromFolder);
        affectedFolders.add(toFolder);
    }

    // 更新每个受影响的文件夹摘要
    for (const folderPath of affectedFolders) {
        await this.updateFolderSummary(folderPath);
    }
}

private async updateFolderSummary(folderPath: string): Promise<void> {
    const folderId = folderPath.replace(/\//g, '-');
    const existingSummary = await this.storage.readJson(
        this.pathManager.getFolderSummaryPath(folderId)
    );

    if (!existingSummary) {
        // 不存在则创建新摘要
        return this.generateFolderSummary(folderPath);
    }

    // 获取当前文件夹中的文件
    const allFiles = await this.obsidianHelper.getAllMarkdownFiles();
    const currentFiles = allFiles.filter(f => {
        const fileFolder = f.path.substring(0, f.path.lastIndexOf('/'));
        return fileFolder === folderPath;
    });

    // 追加新文件到 sampleNumbers，取最后10个
    const existingSamples = new Set(existingSummary.sampleNumbers || []);
    const newSamples = currentFiles
        .map(f => f.basename)
        .filter(name => !existingSamples.has(name));

    const updatedSamples = [
        ...(existingSummary.sampleNumbers || []),
        ...newSamples
    ].slice(-10);

    // 更新摘要
    existingSummary.sampleNumbers = updatedSamples;
    existingSummary.lastUpdated = new Date().toISOString();

    await this.storage.writeJson(
        this.pathManager.getFolderSummaryPath(folderId),
        existingSummary
    );
}
```

#### 2. 在归档后调用更新

在 `main.ts` 的归档完成后调用：

```typescript
await this.handleManualArchive(confidentFiles.map(d => ({
    path: d.path,
    targetDir: d.targetDir
})));

// 更新受影响的文件夹摘要
const movedFiles = confidentFiles.map(d => ({
    from: d.path,
    to: `${d.targetDir}/${d.path.split('/').pop()}`
}));
await this.summarizerService.updateFolderSummariesForMovedFiles(movedFiles);
```

### 测试验证

- [ ] 归档笔记到文件夹
- [ ] 检查文件夹摘要的 sampleNumbers 字段
- [ ] 验证最多保留10个样本
- [ ] 验证新文件被追加到末尾

---

## P1-2: 启动补执行复盘

### 问题描述

PRD 要求"启动补执行：插件启动后延迟 10 秒检查，如果今天复盘时间已过但未执行 → 补执行今天的复盘；如果今天复盘时间未到 → 补执行昨天的复盘"。

### 当前代码分析

`src/services/schedulerService.ts` 只有定时检查逻辑，没有启动补执行。

### 修复方案

#### 1. 添加补执行检查方法

在 `SchedulerService` 中添加：

```typescript
/**
 * 启动时检查并补执行复盘
 */
async checkAndRunMissedReviews(): Promise<void> {
    console.log('[SchedulerService] Checking for missed reviews...');
    await this.delay(10000);  // 延迟10秒

    const now = moment();
    const dailyTime = moment(this.dailyReviewTime, 'HH:mm');
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'day').startOf('day');

    // 检查今天的复盘是否需要补执行
    const todayReviewPath = this.plugin.pathManager.getDailyReviewPath(
        today.format('YYYY-MM-DD')
    );
    const todayReviewExists = await this.plugin.storage.exists(todayReviewPath);

    if (now.isAfter(dailyTime) && !todayReviewExists) {
        // 今天时间已过且复盘不存在，补执行今天的复盘
        console.log('[SchedulerService] Running missed daily review for today');
        await this.plugin.generateDailyReview();
        return;
    }

    if (!todayReviewExists) {
        // 今天时间未到且复盘不存在，检查昨天的复盘
        const yesterdayReviewPath = this.plugin.pathManager.getDailyReviewPath(
            yesterday.format('YYYY-MM-DD')
        );
        const yesterdayReviewExists = await this.plugin.storage.exists(yesterdayReviewPath);

        if (!yesterdayReviewExists) {
            console.log('[SchedulerService] Running missed daily review for yesterday');
            await this.plugin.generateDailyReview();
        }
    }
}

private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### 2. 在插件启动时调用

在 `main.ts` 的 `onload` 中：

```typescript
// 启动定时任务
this.schedulerService.start();

// 延迟检查补执行
this.schedulerService.checkAndRunMissedReviews();
```

### 测试验证

- [ ] 关闭插件，删除今日复盘
- [ ] 重启插件，等待10秒
- [ ] 验证补执行今日复盘（如果时间已过）
- [ ] 验证补执行昨日复盘（如果时间未到）

---

## P1-3: 仓库概要模板

### 问题描述

PRD 要求"首次运行时扫描所有笔记，生成仓库概要，调用 AI 生成初始概要报告"。当前 `reviewService.ts:96-101` 中有 `generateRepositoryOverview` 方法调用，但该方法未实现。

### 当前代码分析

`src/services/reviewService.ts:96-101`
```typescript
if (!index || Object.keys(index.files).length === 0) {
    console.log('[ReviewService] First run, creating initial repository overview and snapshots');
    await this.createInitialSnapshots(allFiles);
    const overview = await this.generateRepositoryOverview(allFiles);  // 未实现
    await this.saveDailyReview(overview);
    return summary;
}
```

### 修复方案

#### 1. 实现 generateRepositoryOverview 方法

在 `ReviewService` 中添加：

```typescript
/**
 * 生成仓库概要（首次运行时使用）
 */
private async generateRepositoryOverview(allFiles: TFile[]): Promise<string> {
    console.log('[ReviewService] Generating repository overview...');

    // 统计信息
    const stats = {
        totalNotes: allFiles.length,
        totalFolders: new Set(allFiles.map(f => f.path.split('/')[0])).size,
        totalTags: await this.countTotalTags(allFiles),
        totalLinks: await this.countTotalLinks(allFiles)
    };

    // 按文件夹分组
    const folderGroups = this.groupFilesByFolder(allFiles);

    // 构建提示词
    const prompt = this.buildRepositoryOverviewPrompt(stats, folderGroups);

    // 调用 AI 生成概要
    const overview = await this.apiClient.chat(prompt, { expectJson: false });

    return overview;
}

private async countTotalTags(files: TFile[]): Promise<number> {
    const allTags = new Set<string>();
    for (const file of files) {
        const tags = this.obsidianHelper.metadataCacheHelper.getTags(file);
        tags.forEach(tag => allTags.add(tag));
    }
    return allTags.size;
}

private async countTotalLinks(files: TFile[]): Promise<number> {
    let totalLinks = 0;
    for (const file of files) {
        const links = this.obsidianHelper.metadataCacheHelper.getLinks(file);
        totalLinks += links.length;
    }
    return totalLinks;
}

private groupFilesByFolder(files: TFile[]): Map<string, TFile[]> {
    const groups = new Map<string, TFile[]>();
    for (const file of files) {
        const folder = file.path.includes('/') ?
            file.path.split('/')[0] : 'root';
        if (!groups.has(folder)) {
            groups.set(folder, []);
        }
        groups.get(folder)!.push(file);
    }
    return groups;
}

private buildRepositoryOverviewPrompt(
    stats: { totalNotes: number; totalFolders: number; totalTags: number; totalLinks: number },
    folderGroups: Map<string, TFile[]>
): string {
    const folderList = Array.from(folderGroups.entries())
        .map(([folder, files]) => `- ${folder}: ${files.length} 个笔记`)
        .join('\n');

    return `你是我的知识管理助手。这是我第一次使用 AI Note 插件，请帮我生成一个仓库概要报告。

## 仓库统计

- 总笔记数: ${stats.totalNotes}
- 总文件夹数: ${stats.totalFolders}
- 总标签数: ${stats.totalTags}
- 总链接数: ${stats.totalLinks}

## 文件夹结构

${folderList}

## 任务

请生成一份仓库概要报告，包含：
1. 仓库规模评估（大/中/小型知识库）
2. 主要内容领域分析（基于文件夹结构）
3. 组织结构建议（是否有需要整理的内容）
4. 知识管理建议

请用中文、友好、专业的语调撰写报告。`;
}
```

### 测试验证

- [ ] 删除快照索引文件
- [ ] 手动触发每日复盘
- [ ] 验证生成仓库概要报告
- [ ] 验证报告包含统计数据和建议

---

## 实施顺序

建议按以下顺序实施修复：

1. **P0-1** (移除14天规则) - 最简单，无依赖
2. **P0-2** (隐藏目录配置) - 独立功能
3. **P0-3** (待整理重试) - 依赖 P0-2
4. **P1-1** (文件夹摘要更新) - 独立功能
5. **P1-2** (启动补执行) - 独立功能
6. **P1-3** (仓库概要) - 独立功能

## 验收标准

所有修复完成后，应满足：

- [ ] 归档命令处理所有根目录笔记（无时间限制）
- [ ] 可配置隐藏目录过滤列表
- [ ] 待整理目录笔记自动重新分类
- [ ] 文件夹摘要增量更新，最多保留10个样本
- [ ] 插件启动后自动补执行复盘
- [ ] 首次运行生成仓库概要报告

## 风险与注意事项

1. **文件夹摘要数据迁移**：现有摘要可能缺少 `sampleNumbers` 字段，需要兼容处理
2. **待整理目录路径处理**：移出待整理目录时需要正确处理文件名
3. **启动补执行时机**：确保不影响插件正常启动性能
4. **仓库概要AI成本**：首次运行可能消耗较多token
