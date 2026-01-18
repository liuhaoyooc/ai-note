# Auto-Generate Summaries for Research Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make summarization a shared foundation that always runs before archive/research features, leveraging built-in cache for efficiency.

**Architecture:** Archive and Research features always trigger SummarizerService first. SummarizerService handles cache internally - only generates summaries for new/changed files. This ensures all dependent features have fresh summary data without redundant work.

**Tech Stack:** TypeScript, Obsidian Plugin API, existing SummarizerService

---

## Problem Statement

**Current Behavior:**
- Research command requires summaries to exist (min 5 for identity analysis)
- User must manually run "Archive files" first to generate summaries
- Poor UX - research fails silently if no summaries

**Desired Behavior:**
- Research command always runs summarization first
- SummarizerService's cache ensures only new/changed files are processed
- Archive and Research both use this shared foundation

---

## Task 1: Modify generateResearch to Always Run Summarization

**Files:**
- Modify: `out/code-master/ai-note/src/main.ts`

**Step 1: Understand current SummarizerService.run() signature**

Check what `run()` returns and accepts:

```bash
grep -A 10 "async run(" /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note/src/services/summarizerService.ts
```

Expected return: `{ summaryStats: { new_summaries, updated_summaries, failed } }`

**Step 2: Modify generateResearch method**

Replace the entire `generateResearch()` method (lines 394-455) with:

```typescript
async generateResearch() {
    console.log('[AI Note] Research command executed');

    if (!this.settings.apiKey) {
        this.statusBarItems.summary?.setText('需要配置 API Key');
        setTimeout(() => {
            this.statusBarItems.summary?.setText('摘要');
        }, 3000);
        return;
    }

    try {
        // Step 1: Always generate summaries first (cache handles duplicates)
        this.statusBarItems.summary?.setText('扫描文件摘要...');
        const { summaryStats } = await this.summarizerService.run((message) => {
            this.statusBarItems.summary?.setText(message);
        });

        console.log(`[AI Note] Summary stats: ${summaryStats.new_summaries} new, ${summaryStats.updated_summaries} updated, ${summaryStats.failed} failed`);

        // Step 2: Generate folder summaries for better classification
        await this.summarizerService.generateFolderSummaries((message) => {
            this.statusBarItems.summary?.setText(message);
        });

        // Step 3: Check and auto-generate/update user identity
        let profile = await this.identityService.getProfile();
        const needsUpdate = await this.identityService.needsUpdate();

        if (!profile) {
            this.statusBarItems.summary?.setText('生成用户身份中...');
            profile = await this.identityService.analyzeAndUpdate();
            if (!profile) {
                this.statusBarItems.summary?.setText('身份生成失败-摘要不足');
                setTimeout(() => {
                    this.statusBarItems.summary?.setText('摘要');
                }, 3000);
                return;
            }
            this.statusBarItems.summary?.setText('身份已生成');
        } else if (needsUpdate) {
            this.statusBarItems.summary?.setText('更新用户身份...');
            profile = await this.identityService.analyzeAndUpdate();
            if (profile) {
                this.statusBarItems.summary?.setText('身份已更新');
            }
        }

        // Step 4: Generate research topics
        this.statusBarItems.summary?.setText('生成调研主题...');
        const topics = await this.researchService.generateTopics(profile);

        this.statusBarItems.summary?.setText(`生成 ${topics.length} 个调研报告`);

        // Step 5: Generate reports for top topics
        const selectedTopics = topics.slice(0, Math.min(3, topics.length));
        for (let i = 0; i < selectedTopics.length; i++) {
            this.statusBarItems.summary?.setText(`生成报告 ${i + 1}/${selectedTopics.length}`);
            await this.researchService.generateReport(selectedTopics[i], profile);
        }

        this.statusBarItems.summary?.setText('调研完成');
        setTimeout(() => {
            this.statusBarItems.summary?.setText('摘要');
        }, 3000);

    } catch (error) {
        console.error('[AI Note] Research error:', error);

        this.statusBarItems.summary?.setText('调研失败');
        setTimeout(() => {
            this.statusBarItems.summary?.setText('摘要');
        }, 3000);

        throw error;
    }
}
```

**Step 3: Rebuild and verify**

Run:
```bash
cd /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note
npm run build
```

Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: research always runs summarization first"
```

---

## Task 2: Simplify executeArchive (Remove Duplicate Summarizer Call)

**Files:**
- Modify: `out/code-master/ai-note/src/main.ts`

**Step 1: Analyze current executeArchive flow**

Current code (lines 204-322) has:
- Line 215: First `summarizerService.run()` call
- Line 222: `setTimeout` with more summarization inside

This is redundant - we only need one summarizer call at the start.

**Step 2: Simplify executeArchive method**

Replace entire `executeArchive()` method with:

```typescript
async executeArchive() {
    console.log('[AI Note] Archive command executed');

    if (!this.settings.apiKey) {
        new Notice('Please configure API Key in plugin settings first');
        return;
    }

    this.statusBarItems.archive?.setText('开始归档...');

    try {
        // Step 1: Always generate summaries first (shared foundation)
        const { summaryStats } = await this.summarizerService.run((message) => {
            this.statusBarItems.archive?.setText(message);
        });

        console.log('[AI Note] Summarization results:', `${summaryStats.new_summaries} new, ${summaryStats.updated_summaries} updated, ${summaryStats.failed} failed`);

        // Step 2: Generate folder summaries
        await this.summarizerService.generateFolderSummaries((message) => {
            this.statusBarItems.archive?.setText(message);
        });

        const folderSummaries = await this.summarizerService.getFolderSummaries();

        // Step 3: AI classify files for archiving
        this.statusBarItems.archive?.setText('AI 分类中...');

        const files = await this.obsidianHelper.getAllMarkdownFiles();

        const rootFiles = files.filter(f => {
            const inRoot = !f.path.includes('/');
            const notHidden = !this.pathManager.isHiddenDirectory(
                f.path,
                this.settings.archiving.hiddenDirectories
            );
            return inRoot && notHidden;
        });

        const unsortedDir = this.pathManager.unsortedDir;
        const unsortedFiles = files.filter(f => {
            return f.path.startsWith(unsortedDir + '/');
        });

        const filesToClassify = [...rootFiles, ...unsortedFiles];

        const { decisions } = await this.classifierService.classifyFiles(
            filesToClassify.map(f => f.path),
            folderSummaries,
            (message) => {
                this.statusBarItems.archive?.setText(message);
            }
        );

        // Step 4: Move confident files
        const confidentFiles = decisions.filter(d => !d.uncertain && d.confidence >= 0.7);
        if (confidentFiles.length > 0) {
            const movedFiles = confidentFiles.map(d => ({
                path: d.path,
                targetDir: d.targetDir
            }));

            const total = movedFiles.length;
            for (let i = 0; i < movedFiles.length; i++) {
                this.statusBarItems.archive?.setText(`归档中: ${i + 1}/${total}`);
                await this.handleManualArchive([movedFiles[i]]);
            }

            const movedFilesForUpdate = movedFiles.map(f => ({
                from: f.path,
                to: `${f.targetDir}/${f.path.split('/').pop()}`
            }));
            await this.summarizerService.updateFolderSummariesForMovedFiles(movedFilesForUpdate);

            this.statusBarItems.archive?.setText(`归档完成: ${total} 个文件`);
            setTimeout(() => {
                this.statusBarItems.archive?.setText('归档');
            }, 5000);
        }

        // Step 5: Move uncertain files to unsorted
        const uncertainFiles = decisions.filter(d => d.uncertain);

        if (uncertainFiles.length > 0) {
            const movedUncertainFiles = uncertainFiles.map(d => ({
                path: d.path,
                targetDir: unsortedDir
            }));

            const total = movedUncertainFiles.length;
            for (let i = 0; i < movedUncertainFiles.length; i++) {
                this.statusBarItems.archive?.setText(`移至待整理: ${i + 1}/${total}`);
                await this.handleManualArchive([movedUncertainFiles[i]]);
            }

            const movedFilesForUpdate = movedUncertainFiles.map(f => ({
                from: f.path,
                to: `${f.targetDir}/${f.path.split('/').pop()}`
            }));
            await this.summarizerService.updateFolderSummariesForMovedFiles(movedFilesForUpdate);

            this.statusBarItems.archive?.setText(`${total} 个文件已移至待整理`);
            setTimeout(() => {
                this.statusBarItems.archive?.setText('归档');
            }, 3000);
        }

    } catch (error) {
        console.error('[AI Note] Archive error:', error);
        this.statusBarItems.archive?.setText('归档失败');
        setTimeout(() => {
            this.statusBarItems.archive?.setText('归档');
        }, 3000);
    }
}
```

**Step 3: Rebuild and verify**

Run:
```bash
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor: simplify archive flow, remove duplicate summarizer call"
```

---

## Task 3: Update INSTALL.md Documentation

**Files:**
- Modify: `out/code-master/ai-note/INSTALL.md`

**Step 1: Update usage notes**

Add after the installation steps:

```markdown
## Usage Notes

**All Features Auto-Generate Summaries:**

- Archive and Research features automatically run summarization first
- Summaries are cached - only new/changed files are processed
- No manual "Archive files" run needed before using research

**Feature Workflow:**
```
1. Research Command → Auto-summarize → Generate identity → Create reports
2. Archive Command  → Auto-summarize → Classify files → Move to folders
```
```

**Step 2: Remove outdated "What's Not Yet Implemented" warnings**

If there are warnings about needing to run archive first, remove them.

**Step 3: Commit**

```bash
git add INSTALL.md
git commit -m "docs: clarify auto-summarization behavior"
```

---

## Task 4: Verify SummarizerService Cache Works

**Files:**
- Read: `out/code-master/ai-note/src/services/summarizerService.ts`

**Step 1: Verify cache implementation**

Check that `run()` method checks for existing summaries:

```bash
grep -A 20 "async run(" /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note/src/services/summarizerService.ts
```

Expected behavior:
- Checks if summary cache exists for each file
- Skips files with unchanged content hash
- Only calls API for new/changed files

**Step 2: If cache is not implemented, add it**

If the cache logic is missing, add this to `SummarizerService`:

```typescript
// In the file processing loop, check cache first
private async shouldUpdateSummary(file: TFile, cachedSummary: any): Promise<boolean> {
    if (!cachedSummary) return true;

    const content = await this.obsidianHelper.readFile(file);
    const currentHash = this.hashContent(content);

    // Re-summarize if file changed
    return cachedSummary.contentHash !== currentHash;
}

private hashContent(content: string): string {
    // Simple hash for content comparison
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}
```

**Step 3: Commit if cache was added**

```bash
git add src/services/summarizerService.ts
git commit -m "feat: add content hash cache to avoid re-summarizing unchanged files"
```

---

## Task 5: Manual Testing

**Files:**
- No code changes, testing only

**Step 1: Clean slate test - remove all summaries**

Run:
```bash
rm -rf "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/data/cache/summaries/"*
```

**Step 2: Rebuild and install plugin**

Run:
```bash
cd /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note
npm run build
cp main.js manifest.json styles.css "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
```

**Step 3: Test research workflow**

1. Open Obsidian, reload plugin
2. Open Developer Console (Cmd+Option+I)
3. Run: `Cmd+P > "Generate research"`
4. Watch console for:
   - `[AI Note] Summary stats: X new, 0 updated, 0 failed`
   - Research completing successfully

**Step 4: Test cache - run research again**

1. Run: `Cmd+P > "Generate research"` (second time)
2. Watch console for:
   - `[AI Note] Summary stats: 0 new, 0 updated, 0 failed` (cache hit!)
   - Research completes faster (no API calls for summaries)

**Step 5: Test archive workflow**

1. Run: `Cmd+P > "Archive files"`
2. Verify it uses cached summaries (0 new, 0 updated)
3. Archive proceeds immediately to classification

**Step 6: Test with a new file**

1. Create a new note in Obsidian
2. Run research or archive
3. Verify: `1 new` summary generated
4. Run again: `0 new` (cached)

---

## Task 6: Add Status Message Clarity

**Files:**
- Modify: `out/code-master/ai-note/src/main.ts`

**Step 1: Improve status messages**

Update the summarization status message in both `generateResearch()` and `executeArchive()`:

Change from:
```typescript
this.statusBarItems.summary?.setText('扫描文件摘要...');
```

To:
```typescript
this.statusBarItems.summary?.setText('检查文件摘要(缓存)...');
```

After summarization completes, show cache stats:
```typescript
const cacheMsg = summaryStats.new_summaries === 0
    ? '摘要已缓存'
    : `已生成 ${summaryStats.new_summaries} 个新摘要`;
this.statusBarItems.summary?.setText(cacheMsg);
```

**Step 2: Rebuild**

Run:
```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "ux: show cache status in summary messages"
```

---

## Summary

This plan makes summarization a true shared foundation that always runs before dependent features. The cache ensures efficiency.

**Design Principle:**
> "Always summarize, let cache optimize"

**Files Modified:**
1. `src/main.ts` - Research/Archive always call summarizer first
2. `INSTALL.md` - Update documentation
3. `src/services/summarizerService.ts` - Verify/implement cache

**Benefits:**
- ✅ Research works standalone (no manual archive needed)
- ✅ Archive always has fresh summaries
- ✅ Cache prevents redundant work
- ✅ Simpler code flow (no conditional logic)
- ✅ Consistent behavior across features
