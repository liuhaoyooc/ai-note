import type { ChangeSummary, FileChangeType } from '../types/review';
import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';
import { PathManager } from './pathManager';
import { formatDate } from '../utils/dateHelper';
import { SnapshotCompressionService } from './snapshotCompression';
import * as diff from 'diff';

export class ReviewService {
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private apiClient: ApiClient;
    private pathManager: PathManager;
    private compression: SnapshotCompressionService;
    private maxDiffLines = 100;

    constructor(obsidianHelper: ObsidianHelper, storage: StorageService, apiClient: ApiClient, pathManager: PathManager) {
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.apiClient = apiClient;
        this.pathManager = pathManager;
        this.compression = new SnapshotCompressionService();
        console.log('[ReviewService] Initialized');
    }

    async generateDailyReview(maxDiffLines?: number): Promise<string> {
        console.log('[ReviewService] Generating daily review...');

        if (maxDiffLines) {
            this.maxDiffLines = maxDiffLines;
        }

        const changes = await this.detectChanges();

        if (changes.added.length === 0 && changes.modified.length === 0 && changes.deleted.length === 0) {
            console.log('[ReviewService] No changes detected, skipping review');
            return '';
        }

        const prompt = this.buildDailyReviewPrompt(changes);
        console.log('[ReviewService] Calling AI to generate review...');

        try {
            const reviewContent = await this.apiClient.chat(prompt, { expectJson: false });
            const reviewPath = await this.saveDailyReview(reviewContent);
            
            await this.updateSnapshots(changes);
            
            console.log(`[ReviewService] Daily review saved to: ${reviewPath}`);
            return reviewPath;
        } catch (error) {
            console.error('[ReviewService] Failed to generate review:', error);
            throw error;
        }
    }

    async generateWeeklyReview(): Promise<string> {
        console.log('[ReviewService] Generating weekly review...');

        const dailyReviews = await this.collectDailyReviewsForWeek();

        if (dailyReviews.length === 0) {
            console.log('[ReviewService] No daily reviews found for this week');
            return '';
        }

        const prompt = this.buildWeeklyReviewPrompt(dailyReviews);
        console.log('[ReviewService] Calling AI to generate weekly review...');

        try {
            const reviewContent = await this.apiClient.chat(prompt, { expectJson: false });
            const reviewPath = await this.saveWeeklyReview(reviewContent);
            
            console.log(`[ReviewService] Weekly review saved to: ${reviewPath}`);
            return reviewPath;
        } catch (error) {
            console.error('[ReviewService] Failed to generate weekly review:', error);
            throw error;
        }
    }

    private async detectChanges(): Promise<ChangeSummary> {
        console.log('[ReviewService] Detecting file changes...');

        const index = await this.readSnapshotIndex();
        const summary: ChangeSummary = {
            added: [],
            modified: [],
            deleted: []
        };

        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();

        if (!index || Object.keys(index.files).length === 0) {
            console.log('[ReviewService] First run, creating initial repository overview and snapshots');

            await this.createInitialSnapshots(allFiles);

            const overview = await this.generateRepositoryOverview(allFiles);
            await this.saveDailyReview(overview);

            return summary;
        }

        const existingFilePaths = new Set(Object.keys(index.files));

        for (const file of allFiles) {
            const relPath = this.obsidianHelper.getRelativePath(file, '');
            existingFilePaths.add(relPath);

            try {
                const content = await this.obsidianHelper.getFileContent(file);
                const hash = await this.calculateHash(content);
                const mtime = this.obsidianHelper.getFileModificationTime(file);

                const snapshotEntry = index.files[relPath];

                if (!snapshotEntry) {
                    summary.added.push({
                        path: relPath,
                        type: 'added' as FileChangeType,
                        newHash: hash
                    });
                } else if (snapshotEntry.hash !== hash) {
                    const oldContent = await this.readSnapshot(snapshotEntry.hash);
                    
                    if (oldContent !== null) {
                        const diffResult = this.calculateDiff(
                            oldContent,
                            content,
                            this.maxDiffLines
                        );

                        summary.modified.push({
                            path: relPath,
                            type: 'modified' as FileChangeType,
                            oldHash: snapshotEntry.hash,
                            newHash: hash,
                            diff: diffResult
                        });
                    }
                }
            } catch (error) {
                console.error(`[ReviewService] Error processing file ${relPath}:`, error);
            }
        }

        for (const filePath of Object.keys(index.files)) {
            if (!existingFilePaths.has(filePath)) {
                summary.deleted.push({
                    path: filePath,
                    type: 'deleted' as FileChangeType,
                    oldHash: index.files[filePath].hash
                });
            }
        }

        console.log(`[ReviewService] Changes detected: ${summary.added.length} added, ${summary.modified.length} modified, ${summary.deleted.length} deleted`);

        return summary;
    }

    private async readSnapshotIndex(): Promise<any> {
        const indexFile = this.pathManager.getSnapshotIndexPath();
        return await this.storage.readJson<any>(indexFile);
    }

    private async writeSnapshotIndex(index: any): Promise<void> {
        const indexFile = this.pathManager.getSnapshotIndexPath();
        await this.storage.writeJson(indexFile, index);
    }

    private async readSnapshot(hash: string): Promise<string | null> {
        const snapshotPath = this.pathManager.getSnapshotPath(hash);
        try {
            const compressedData = await this.storage.readJson<string>(snapshotPath);
            if (!compressedData) {
                return null;
            }

            // 解压缩快照内容
            return this.compression.decompress(compressedData);
        } catch (error) {
            console.error(`[ReviewService] Failed to read snapshot ${hash}:`, error);
            return null;
        }
    }

    private async writeSnapshot(hash: string, content: string): Promise<void> {
        try {
            // 压缩快照内容
            const compressedData = this.compression.compress(content);

            // 存储压缩后的数据 (使用 JSON 格式存储字符串)
            await this.storage.writeJson(this.pathManager.getSnapshotPath(hash), compressedData);
        } catch (error) {
            console.error(`[ReviewService] Failed to write snapshot ${hash}:`, error);
            throw error;
        }
    }

    private async createInitialSnapshots(files: any[]): Promise<void> {
        console.log('[ReviewService] Creating initial snapshots...');

        const index: any = {
            lastSnapshotTime: new Date().toISOString(),
            files: {}
        };

        for (const file of files) {
            try {
                const relPath = this.obsidianHelper.getRelativePath(file, '');
                const content = await this.obsidianHelper.getFileContent(file);
                const hash = await this.calculateHash(content);
                const mtime = this.obsidianHelper.getFileModificationTime(file);

                index.files[relPath] = {
                    hash: hash,
                    snapshotFile: `${hash}.sn`,
                    modifiedTime: Math.floor(mtime / 1000)
                };

                await this.writeSnapshot(hash, content);
            } catch (error) {
                console.error(`[ReviewService] Error creating snapshot for ${file.path}:`, error);
            }
        }

        await this.writeSnapshotIndex(index);
        console.log(`[ReviewService] Created ${Object.keys(index.files).length} initial snapshots`);
    }

    private async updateSnapshots(changes: ChangeSummary): Promise<void> {
        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();
        const existingFilePaths = new Set<string>();

        for (const change of [...changes.added, ...changes.modified]) {
            existingFilePaths.add(change.path);
            try {
                const fullPath = await this.obsidianHelper.findFile(change.path);
                if (fullPath) {
                    const content = await this.obsidianHelper.getFileContent(fullPath);
                    const stat = await this.obsidianHelper.findFile(change.path);
                    const mtime = this.obsidianHelper.getFileModificationTime(fullPath);
                    const hash = await this.calculateHash(content);

                    await this.writeSnapshot(hash, content);
                    await this.updateSnapshotIndexEntry(change.path, hash, mtime);
                }
            } catch (error) {
                console.error(`[ReviewService] Error updating snapshot for ${change.path}:`, error);
            }
        }

        if (changes.deleted.length > 0) {
            const index = await this.readSnapshotIndex();
            if (index) {
                for (const change of changes.deleted) {
                    delete index.files[change.path];
                }
                await this.writeSnapshotIndex(index);
                console.log(`[ReviewService] Removed ${changes.deleted.length} snapshot entries`);
            }
        }
    }

    private async updateSnapshotIndexEntry(filePath: string, hash: string, mtime: number): Promise<void> {
        const index = await this.readSnapshotIndex();
        if (index) {
            index.files[filePath] = {
                hash: hash,
                snapshotFile: `${hash}.sn`,
                modifiedTime: mtime
            };
            await this.writeSnapshotIndex(index);
        }
    }

    private calculateDiff(
        oldContent: string,
        newContent: string,
        maxLines: number
    ): string {
        const lines: string[] = [];
        let diffLines = 0;

        const changes = diff.diffLines(oldContent, newContent);

        for (const change of changes) {
            if (diffLines >= maxLines) {
                lines.push('... (differences exceed maximum line limit)');
                break;
            }

            if (change.added) {
                const textLines = change.value.split('\n');
                diffLines += textLines.length;
                for (const line of textLines) {
                    lines.push(`+ ${line}`);
                }
            } else if (change.removed) {
                const textLines = change.value.split('\n');
                diffLines += textLines.length;
                for (const line of textLines) {
                    lines.push(`- ${line}`);
                }
            }
        }

        return lines.join('\n');
    }

    private buildWeeklyReviewPrompt(dailyReviews: Array<{ date: string; content: string }>): string {
        const reviewsText = dailyReviews.map(r => `### ${r.date}\n${r.content}`).join('\n\n');

        return `请基于以下每日复盘生成每周复盘报告。

每日复盘内容：
${reviewsText}

请按照以下格式生成 Markdown 格式的每周复盘报告：

# 每周工作复盘 - {YEAR}-W{WEEK}

## 📋 本周概要
- 工作天数：${dailyReviews.length}
- 主要成就：
- 面临挑战：

## 📝 本周工作内容
基于每日复盘总结本周的主要工作：

1.
2.
3.

## 💡 关键收获
从本周的工作中总结的关键知识点、经验或收获：

1.
2.
3.

## 🎯 下周计划
基于本周的工作进度，规划下周的任务：

1.
2.
3.

## 📊 每日详情
${reviewsText}

---
*复盘生成时间：{DATETIME}*`;
    }

    private buildDailyReviewPrompt(changes: ChangeSummary): string {
        const changeSummary = this.buildChangeSummary(changes);
        const detailedChanges = this.buildDetailedChanges(changes);

        return `请基于以下文件变更信息生成每日复盘报告。

文件变更概要：
${changeSummary}

详细变更内容：
${detailedChanges}

请按照以下格式生成 Markdown 格式的复盘报告：

# 每日工作复盘 - {DATE}

## 📋 今日概要
- 变更文件总数：${changes.added.length + changes.modified.length + changes.deleted.length}
- 新增文件：${changes.added.length}
- 修改文件：${changes.modified.length}
- 删除文件：${changes.deleted.length}

## 📝 今日工作内容
基于文件变更总结今天的主要工作内容（每点一句话）：

1. 
2. 
3. 

## 💡 关键收获
从今天的工作中总结的关键知识点、经验或收获：

1. 
2. 
3. 

## 🎯 明日计划
基于今天的工作进度，规划明天的任务：

1. 
2. 
3. 

## 📊 变更详情
${detailedChanges}

---
*复盘生成时间：{DATETIME}*`;
    }

    private buildChangeSummary(changes: ChangeSummary): string {
        const sections: string[] = [];

        if (changes.added.length > 0) {
            sections.push(`### 新增文件 (${changes.added.length}个)`);
            for (const change of changes.added) {
                sections.push(`- ${change.path}`);
            }
        }

        if (changes.modified.length > 0) {
            sections.push(`\n### 修改文件 (${changes.modified.length}个)`);
            for (const change of changes.modified) {
                sections.push(`- ${change.path}`);
            }
        }

        if (changes.deleted.length > 0) {
            sections.push(`\n### 删除文件 (${changes.deleted.length}个)`);
            for (const change of changes.deleted) {
                sections.push(`- ${change.path}`);
            }
        }

        return sections.join('\n');
    }

    private buildDetailedChanges(changes: ChangeSummary): string {
        const sections: string[] = [];

        if (changes.modified.length > 0) {
            sections.push(`\n---\n## 详细变更内容`);
            for (const change of changes.modified) {
                if (change.diff) {
                    sections.push(`\n### ${change.path}\n${change.diff}`);
                }
            }
        }

        return sections.join('\n');
    }

    private async saveDailyReview(content: string): Promise<string> {
        const date = formatDate(new Date());
        const fileName = `${date}.md`;
        const fullPath = this.pathManager.getDailyReviewPath(date);

        await this.storage.writeMarkdown(this.pathManager.dailyReviewsDir, `/${fileName}`, content);
        return fullPath;
    }

    private async saveWeeklyReview(content: string): Promise<string> {
        const week = this.getWeekNumber(new Date());
        const year = new Date().getFullYear();
        const fullPath = this.pathManager.getWeeklyReviewPath(week, year);

        await this.storage.writeMarkdown(this.pathManager.weeklyReviewsDir, `/year-W${week}.md`, content);
        return fullPath;
    }

    private async collectDailyReviewsForWeek(): Promise<Array<{ date: string; content: string }>> {
        const result: Array<{ date: string; content: string }> = [];
        const dirPath = this.pathManager.dailyReviewsDir;

        try {
            const files = await this.storage.listFiles(dirPath, 'md');
            const mdFiles = files.filter(f => f.endsWith('.md'));

            const now = new Date();
            const weekStart = this.getWeekStart(now);

            for (const file of mdFiles) {
                const dateStr = file.replace('.md', '').replace(dirPath, '');
                
                try {
                    const fileDate = new Date(dateStr);
                    if (this.isThisWeek(fileDate)) {
                        const content = await this.obsidianHelper.readFile(file);
                        if (content) {
                            result.push({
                                date: dateStr,
                                content
                            });
                        }
                    }
                } catch (error) {
                    console.error(`[ReviewService] Error parsing date from ${file}:`, error);
                }
            }

            result.sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('[ReviewService] Error collecting daily reviews:', error);
        }

        return result;
    }

    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    private getWeekStart(date: Date): Date {
        const now = new Date();
        const nowDay = now.getDay() || 7;
        const nowDate = now.getDate();

        const weekStart = new Date(now);
        weekStart.setDate(nowDate - nowDay + 1);
        weekStart.setHours(0, 0, 0, 0);

        return weekStart;
    }

    private isThisWeek(date: Date): boolean {
        const now = new Date();
        const weekStart = this.getWeekStart(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return date >= weekStart && date <= weekEnd;
    }

    private async calculateHash(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * 生成仓库概要（首次运行时使用）
     */
    private async generateRepositoryOverview(allFiles: any[]): Promise<string> {
        console.log('[ReviewService] Generating repository overview...');

        // 统计信息
        const stats = {
            totalNotes: allFiles.length,
            totalFolders: new Set(allFiles.map((f: any) => f.path.split('/')[0])).size,
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

    private async countTotalTags(files: any[]): Promise<number> {
        const allTags = new Set<string>();
        for (const file of files) {
            const tags = this.obsidianHelper.metadataCacheHelper.getTags(file);
            tags.forEach((tag: string) => allTags.add(tag));
        }
        return allTags.size;
    }

    private async countTotalLinks(files: any[]): Promise<number> {
        let totalLinks = 0;
        for (const file of files) {
            const links = this.obsidianHelper.metadataCacheHelper.getLinks(file);
            totalLinks += links.length;
        }
        return totalLinks;
    }

    private groupFilesByFolder(files: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();
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
        folderGroups: Map<string, any[]>
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
}
