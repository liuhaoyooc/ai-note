# Fix Status Bar Progress Display and Missing Method

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 添加 Status Bar 实时进度显示，修复缺失的 `buildFolderSummaryPrompt` 方法，移除所有 Notice 通知，使用 Status Bar 显示所有操作进度。

**Architecture:** 在 main.ts 中注册 Status Bar item，在关键操作中更新状态，在 summarizerService.ts 中添加缺失的文件夹摘要生成方法。

**Tech Stack:** TypeScript, Obsidian API, Status Bar API

---

## Task 1: 添加缺失的 `buildFolderSummaryPrompt` 方法

**Files:**
- Modify: `src/services/summarizerService.ts:462` (在 `getFolderFromPath` 方法之后添加)

**Step 1: 在 `getFolderFromPath` 方法后添加 `buildFolderSummaryPrompt` 方法**

```typescript
/**
 * 构建文件夹摘要提示词
 */
private buildFolderSummaryPrompt(folderPath: string, files: any[]): string {
    const filesText = files.map((f, i) => {
        const preview = f.content.substring(0, 200).replace(/\n/g, ' ');
        return `${i + 1}. ${f.basename}\n   预览: ${preview}...`;
    }).join('\n\n');

    return `请为文件夹 "${folderPath}" 生成摘要：

## 文件夹内容
${filesText}

## 输出格式
请以 JSON 格式返回：
{
  "theme": "文件夹主题",
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"]
}`;
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 3: Commit**

```bash
cd /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note
git add src/services/summarizerService.ts
git commit -m "fix: add missing buildFolderSummaryPrompt method"
```

---

## Task 2: 在 main.ts 中注册 Status Bar

**Files:**
- Modify: `src/main.ts` (多个位置)

**Step 1: 在类属性中声明 Status Bar item**

在 `export default class AiNotePlugin extends Plugin` 类中添加：

```typescript
export default class AiNotePlugin extends Plugin {
    settings: AiNoteSettings;
    // ... 其他属性 ...

    // Status Bar items
    private statusBarItems: {
        archive?: StatusBarBarItem;
        summary?: StatusBarBarItem;
    };
```

**Step 2: 在 `onload()` 方法中注册 Status Bar items**

在 `onload()` 方法中添加（在 addRibbonIcons 之后）：

```typescript
this.registerStatusBarItems();
```

**Step 3: 实现 `registerStatusBarItems()` 方法**

在 `addRibbonIcons()` 方法之后添加：

```typescript
registerStatusBarItems() {
    // 注册归档状态栏
    this.statusBarItems.archive = this.addStatusBarItem();
    this.statusBarItems.archive.setText('归档');

    // 注册摘要状态栏
    this.statusBarItems.summary = this.addStatusBarItem();
    this.statusBarItems.summary.setText('摘要');
}
```

**Step 4: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: add status bar items for progress display"
```

---

## Task 3: 更新 executeArchive 使用 Status Bar 进度

**Files:**
- Modify: `src/main.ts` - executeArchive 方法 (约 180-270 行范围)

**Step 1: 更新 generateFolderSummaries 调用，添加 Status Bar 进度

找到 `generateFolderSummaries` 调用位置，添加 progressCallback：

```typescript
// 原来:
await this.summarizerService.generateFolderSummaries((message) => new Notice(message));

// 改为:
await this.summarizerService.generateFolderSummaries((message) => {
    this.statusBarItems.summary.setText(message);
});
```

**Step 2: 更新归档分类调用，添加 Status Bar 进度

找到 classifyFiles 调用位置，添加进度：

```typescript
// 原来:
const { decisions } = await this.classifierService.classifyFiles(...);

// 改为:
this.statusBarItems.archive.setText('AI 分类中...');
const { decisions } = await this.classifierService.classifyFiles(...);
this.statusBarItems.archive.setText(`分类完成: ${decisions.length} 个文件`);
```

**Step 3: 更新手动归档处理，添加 Status Bar 进度

找到 handleManualArchive 调用位置，添加进度：

```typescript
// 在处理每个文件时更新进度
for (const decision of decisions) {
    this.statusBarItems.archive.setText(`归档中: ${processed}/${total}`);
    await this.handleManualArchive([decision]);
    processed++;
}
```

**Step 4: 更新完成后的状态

在所有操作完成后：

```typescript
this.statusBarItems.archive.setText(`归档完成: ${total} 个文件`);
setTimeout(() => {
    this.statusBarItems.archive.setText('归档');
}, 5000);
```

**Step 5: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: replace notices with status bar progress display"
```

---

## Task 4: 更新 generateDailyReview 使用 Status Bar

**Files:**
- Modify: `src/main.ts` - generateDailyReview 方法

**Step 1: 更新 generateDailyReview 方法，添加 Status Bar 进度**

找到 `generateDailyReview` 方法，添加状态更新：

```typescript
async generateDailyReview() {
    console.log('[AI Note] Daily review command executed');

    this.statusBarItems.summary.setText('开始复盘...');

    try {
        const reviewPath = await this.reviewService.generateDailyReview(this.settings.review.maxDiffLines);

        this.statusBarItems.summary.setText('复盘完成');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

        return reviewPath;
    } catch (error) {
        console.error('[AI Note] Daily review error:', error);

        this.statusBarItems.summary.setText('复盘失败');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

        throw error;
    }
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS with all updates compiled

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add status bar progress to daily review"
```

---

## Task 5: 更新 generateWeeklyReview 使用 Status Bar

**Files:**
- Modify: `src/main.ts` - generateWeeklyReview 方法

**Step 1: 更新 generateWeeklyReview 方法，添加 Status Bar 进度**

```typescript
async generateWeeklyReview() {
    console.log('[AI Note] Weekly review command executed');

    this.statusBarItems.summary.setText('开始周复盘...');

    try {
        const reviewPath = await this.reviewService.generateWeeklyReview();

        this.statusBarItems.summary.setText('周复盘完成');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

        return reviewPath;
    } catch (error) {
        console.error('[AI Note] Weekly review error:', error);

        this.statusBarItems.summary.setText('周复盘失败');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

        throw error;
    }
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add status bar progress to weekly review"
```

---

## Task 6: 更新 generateResearch 使用 Status Bar

**Files:**
- Modify: `src/main.ts` - generateResearch 方法

**Step 1: 更新 generateResearch 方法，添加 Status Bar 进度**

```typescript
async generateResearch() {
    console.log('[AI Note] Research command executed');

    if (!this.settings.apiKey) {
        this.statusBarItems.summary.setText('需要配置 API Key');
        return;
    }

    try {
        // 检查并自动生成/更新用户身份
        let profile = await this.identityService.getProfile();
        const needsUpdate = await this.identityService.needsUpdate();

        if (!profile) {
            this.statusBarItems.summary.setText('生成用户身份中...');
            profile = await this.identityService.analyzeAndUpdate();
            if (!profile) {
                this.statusBarItems.summary.setText('身份生成失败');
                setTimeout(() => {
                    this.statusBarItems.summary.setText('摘要');
                }, 3000);
                return;
            }
            this.statusBarItems.summary.setText('身份已生成');
        } else if (needsUpdate) {
            this.statusBarItems.summary.setText('更新用户身份...');
            profile = await this.identityService.analyzeAndUpdate();
            if (profile) {
                this.statusBarItems.summary.setText('身份已更新');
            }
        }

        this.statusBarItems.summary.setText('生成调研主题...');
        const topics = await this.researchService.generateTopics(profile);

        this.statusBarItems.summary.setText(`生成 ${topics.length} 个调研报告`);

        const selectedTopics = topics.slice(0, Math.min(3, topics.length));
        for (let i = 0; i < selectedTopics.length; i++) {
            this.statusBarItems.summary.setText(`生成报告 ${i + 1}/${selectedTopics.length}`);
            await this.researchService.generateReport(selectedTopics[i], profile);
        }

        this.statusBarItems.summary.setText('调研完成');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

    } catch (error) {
        console.error('[AI Note] Research error:', error);

        this.statusBarItems.summary.setText('调研失败');
        setTimeout(() => {
            this.statusBarItems.summary.setText('摘要');
        }, 3000);

        throw error;
    }
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add status bar progress to research function"
```

---

## Task 7: 移除所有 Notice 调用

**Files:**
- Modify: `src/main.ts` - 所有方法中的 Notice 调用

**Step 1: 移除 executeArchive 中的 Notice**

找到所有 `new Notice(...)` 调用并删除。

**Step 2: 移除 generateDailyReview 中的 Notice**

删除所有进度 Notice，保留错误处理。

**Step 3: 移除 generateWeeklyReview 中的 Notice**

删除所有进度 Notice，保留错误处理。

**Step 4: 移除 generateResearch 中的 Notice**

删除所有进度 Notice，保留错误处理。

**Step 5: 移除 executeArchive 中的错误 Notice**

保留错误处理 Notice，移除进度 Notice。

**Step 6: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 7: Commit**

```bash
git add src/main.ts
git commit -m "refactor: remove notice calls, use status bar for progress"
```

---

## Task 8: 更新 SchedulerService 使用 Status Bar

**Files:**
- Modify: `src/services/schedulerService.ts`

**Step 1: 添加 Status Bar 引用**

在 SchedulerService 类中添加 Status Bar 访问：

```typescript
constructor(plugin: any) {
    this.plugin = plugin;
    console.log('[SchedulerService] Initialized');
    this.statusBarItems = plugin.statusBarItems;
}
```

**Step 2: 更新 checkAndRunMissedReviews 使用 Status Bar

```typescript
async checkAndRunMissedReviews(): Promise<void> {
    this.statusBarItems.summary.setText('检查复盘状态...');
    await this.delay(10000);

    const now = moment();
    const dailyTime = moment(this.dailyReviewTime, 'HH:mm');
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'day').startOf('day');

    // ... 保持原有逻辑 ...
}
```

**Step 3: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/services/schedulerService.ts
git commit -m "feat: add status bar to scheduler service"
```

---

## Task 9: 测试所有功能

**Step 1: 编译插件**

Run: `npm run build`
Expected: SUCCESS with no errors or warnings

**Step 2: 安装插件**

```bash
cp -f main.js "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
```

**Step 3: 在 Obsidian 中重新加载插件**

1. 打开 Obsidian
2. 禁用并重新启用 AI Note 插件
3. 测试各个功能

**Step 4: 验证 Status Bar 显示**

- 检查 Obsidian 底部状态栏是否显示进度
- 验证完成后状态栏恢复原状态

**Step 5: 验证无 Notice 弹窗出现**

执行以下命令，确认没有弹出 Notice：
- 归档命令
- 每日复盘
- 每周复盘
- 调研生成

---

## Task 10: 最终验证和提交

**Step 1: 最终测试所有功能**

测试列表：
- [ ] 归档功能 - Status Bar 显示进度
- [ ] 每日复盘 - Status Bar 显示进度
- [ ] 每周复盘 - Status Bar 显示进度
- [ ] 调研功能 - Status Bar 显示进度
- [ ] 无任何 Notice 弹窗

**Step 2: 创建标签**

```bash
cd /Users/liuhao/Documents/persional/ai-note
git tag v1.1.0 -m "Add status bar progress, remove notices, fix buildFolderSummaryPrompt"
```

**Step 3: 提交所有更改**

```bash
git push origin main
```

---

## 验收标准

完成所有任务后，插件应该：

1. **无 Notice 弹窗** - 所有进度通过 Status Bar 显示
2. **实时进度更新** - 用户可以看到操作进度
3. **状态恢复** - 操作完成后状态栏恢复原状态
4. **无 `buildFolderSummaryPrompt` 错误** - 所有文件夹正常生成摘要
5. **功能完整** - 所有命令正常工作

---

## 技术说明

### Status Bar 工作原理

```typescript
// 注册 Status Bar Item
const item = this.addStatusBarItem();
item.setText('进度信息');

// 更新状态
item.setText('新状态');

// 清除状态
item.setText('');  // 恢复默认状态
```

### 状态类型

| 操作类型 | 状态显示 | 完成后行为 |
|---------|---------|-----------|
| 短时操作 | "进行中..." | 3秒后恢复 |
| 长时间操作 | "进度: 5/10" | 持续更新直到完成 |
| 完成状态 | "完成!" | 3-5秒后恢复 |

### 文件修改汇总

| 文件 | 修改内容 |
|------|---------|
| `src/main.ts` | 注册 Status Bar，更新所有方法使用 Status Bar |
| `src/services/summarizerService.ts` | 添加 `buildFolderSummaryPrompt` 方法 |
| `src/services/schedulerService.ts` | 添加 Status Bar 支持 |

---

## 回滚方案

如果出现问题，可以使用以下命令回滚：

```bash
git reset --hard HEAD~1  # 回退一个版本
git checkout -b <backup-branch>
```
