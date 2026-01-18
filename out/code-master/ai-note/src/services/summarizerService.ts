import { ApiClient } from './apiClient';
import type { FileSummary, SummaryStatistics, TimeBucket } from '../types/summary';
import { getTimeBucket, hashPathAndMtime } from '../utils/constants';
import { PathManager } from './pathManager';
import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';

interface FileInfo {
    path: string;
    relPath: string;
    fileId: string;
    timeBucket: TimeBucket;
    mtime: number;
}

interface ReadableFile extends FileInfo {
    content: string;
}

interface SummaryCache {
    [fileId: string]: FileSummary | null;
}

export class SummarizerService {
    private apiClient: ApiClient;
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private pathManager: PathManager;
    private batchSize = 10;
    private maxFileContentLength = 5000;

    constructor(apiClient: ApiClient, obsidianHelper: ObsidianHelper, storage: StorageService, pathManager: PathManager) {
        this.apiClient = apiClient;
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.pathManager = pathManager;
        console.log('[SummarizerService] Initialized');
    }

    async run(progressCallback?: (message: string) => void): Promise<{ summaryStats: SummaryStatistics }> {
        console.log('[SummarizerService] Starting summarization...');

        const cache = await this.loadCache();
        const filesToProcess: FileInfo[] = [];
        let cachedCount = 0;

        const allFileIds = await this.scanProject(cache, filesToProcess, { value: 0 });

        const corruptedCleaned = await this.cleanupCorrupted();
        const orphanedCleaned = await this.cleanupOrphans(allFileIds, cache);

        progressCallback?.('Generating new summaries...');

        const stats: SummaryStatistics = {
            total_files: Object.keys(cache).length,
            new_summaries: 0,
            updated_summaries: 0,
            skipped: cachedCount,
            failed: 0,
            corrupted_cleaned: corruptedCleaned,
            orphaned_cleaned: orphanedCleaned
        };

        for (let i = 0; i < filesToProcess.length; i += this.batchSize) {
            const batch = filesToProcess.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(filesToProcess.length / this.batchSize);
            progressCallback?.(`Processing batch ${batchNum}/${totalBatches} (${batch.length} files)`);

            const readableFiles = await this.readBatchContents(batch);
            if (readableFiles.length === 0) {
                console.error(`[SummarizerService] Batch ${batchNum}: No files readable`);
                stats.failed += batch.length;
                continue;
            }

            // 如果有文件无法读取，记录失败
            if (readableFiles.length < batch.length) {
                stats.failed += (batch.length - readableFiles.length);
            }

            const summaries = await this.generateSummaries(readableFiles);

            if (summaries.length === 0) {
                console.error(`[SummarizerService] Batch ${batchNum}: API returned no summaries`);
                stats.failed += readableFiles.length;
                continue;
            }

            // 使用 readableFiles 而不是 batch，因为只有成功读取的文件才有摘要
            for (let j = 0; j < readableFiles.length; j++) {
                const fileInfo = readableFiles[j];

                if (j < summaries.length && summaries[j]) {
                    const summary = summaries[j];
                    const summaryRecord: FileSummary = {
                        file_id: fileInfo.fileId,
                        file_path: fileInfo.relPath,
                        summary: summary.summary,
                        keywords: summary.keywords,
                        time_bucket: fileInfo.timeBucket,
                        generated_at: new Date().toISOString(),
                        file_mtime: fileInfo.mtime
                    };

                    await this.saveSummary(summaryRecord);
                    console.debug(`[SummarizerService] Summary saved: ${fileInfo.relPath}`);
                    stats.new_summaries++;
                } else {
                    console.error(`[SummarizerService] File ${fileInfo.relPath}: No summary returned (index ${j} out of ${summaries.length})`);
                    stats.failed++;
                }
            }
        }

        return { summaryStats: stats };
    }

    private async loadCache(): Promise<SummaryCache> {
        const cachePath = this.pathManager.summariesDir;
        const files = await this.storage.listCacheFiles(cachePath, 'json');
        const cache: SummaryCache = {};

        for (const file of files) {
            try {
                const fileId = file.split('/').pop()?.replace('.json', '') || '';
                const data = await this.storage.readJson(file) as FileSummary | null;
                if (data) {
                    cache[fileId] = data;
                }
            } catch (error) {
                console.error(`[SummarizerService] Error loading cache for ${file}:`, error);
            }
        }

        console.log(`[SummarizerService] Loaded ${Object.keys(cache).length} cached summaries`);
        return cache;
    }

    private async saveSummary(summary: FileSummary): Promise<void> {
        const path = this.pathManager.getSummaryPath(summary.file_id);
        await this.storage.writeJson(path, summary);
    }

    private async scanProject(
        cache: SummaryCache,
        filesToProcess: FileInfo[],
        cachedCount: { value: 0 },
        progressCallback?: (message: string) => void
    ): Promise<Set<string>> {
        console.log('[SummarizerService] Scanning project files...');

        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();
        const cacheFileIds = new Set(Object.keys(cache));

        for (const file of allFiles) {
            const relPath = this.obsidianHelper.getRelativePath(file, '');
            const mtime = this.obsidianHelper.getFileModificationTime(file);
            const mtimeSeconds = Math.floor(mtime / 1000);
            const fileId = await hashPathAndMtime(relPath, mtimeSeconds);
            const daysAgo = (Date.now() - mtime) / (1000 * 60 * 60 * 24);
            const timeBucket = getTimeBucket(Math.floor(daysAgo), Math.floor(Date.now() / 1000));

            cacheFileIds.add(fileId);

            const cachedSummary = cache[fileId];
            let needsSummary = !cachedSummary;

            if (cachedSummary && cachedSummary.time_bucket !== timeBucket) {
                console.log(`[SummarizerService] File time bucket changed: ${relPath} (${cachedSummary.time_bucket} -> ${timeBucket})`);
                needsSummary = true;
            }

            if (needsSummary) {
                filesToProcess.push({
                    path: file.path,
                    relPath: relPath,
                    fileId,
                    timeBucket,
                    mtime: mtimeSeconds
                });
            } else {
                cachedCount.value++;
            }
        }

        console.log(`[SummarizerService] Scan complete: ${cacheFileIds.size} total, ${filesToProcess.length} need summary, ${cachedCount.value} cached`);
        return cacheFileIds;
    }

    private async readBatchContents(files: FileInfo[]): Promise<ReadableFile[]> {
        const results: ReadableFile[] = [];

        for (const file of files) {
            try {
                const fileObj = await this.obsidianHelper.findFile(file.path);
                if (fileObj) {
                    const content = await this.obsidianHelper.getFileContent(fileObj);
                    const truncatedContent = content.substring(0, this.maxFileContentLength);

                    results.push({
                        ...file,
                        content: truncatedContent
                    });

                    if (content.length > this.maxFileContentLength) {
                        console.debug(`[SummarizerService] Content truncated: ${file.relPath} (${content.length} -> ${this.maxFileContentLength})`);
                    }
                } else {
                    console.warn(`[SummarizerService] File not found: ${file.path}`);
                }
            } catch (error) {
                console.error(`[SummarizerService] Error reading file ${file.path}:`, error);
            }
        }

        console.debug(`[SummarizerService] Read ${results.length}/${files.length} files`);
        return results;
    }

    private async generateSummaries(readableFiles: ReadableFile[]): Promise<Array<{ summary: string; keywords: string[] }>> {
        const prompt = this.buildSummaryPrompt(readableFiles);

        try {
            const response = await this.apiClient.chat(prompt, { expectJson: true });
            const summaries = this.parseSummaries(response);

            if (summaries.length === readableFiles.length) {
                return summaries;
            } else {
                console.warn(`[SummarizerService] API returned ${summaries.length} summaries for ${readableFiles.length} files`);
                return summaries;
            }
        } catch (error) {
            console.error(`[SummarizerService] API call failed:`, error);
            throw error;
        }
    }

    private buildSummaryPrompt(files: ReadableFile[]): string {
        const filesText = files.map((f, i) => {
            const preview = f.content.substring(0, 200).replace(/\n/g, ' ');
            return `${i + 1}. ${f.relPath}\n   预览: ${preview}...`;
        }).join('\n\n');

        return `请为以下文件生成摘要，每个摘要包含：
- 一句话概括文件内容
- 3-5 个关键词

文件列表：
${filesText}

请以 JSON 数组格式返回，每个元素包含：
{
  "summary": "文件摘要",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`;
    }

    private parseSummaries(response: string): Array<{ summary: string; keywords: string[] }> {
        try {
            // 记录原始响应用于调试
            console.debug('[SummarizerService] API response (first 500 chars):', response.substring(0, 500));

            const parsed = JSON.parse(response);
            if (Array.isArray(parsed)) {
                console.log(`[SummarizerService] Successfully parsed ${parsed.length} summaries`);
                return parsed;
            }
            console.warn('[SummarizerService] API response is not an array');
            return [];
        } catch (error) {
            console.error('[SummarizerService] Failed to parse API response:', error);
            console.error('[SummarizerService] Response that failed to parse:', response);
            return [];
        }
    }

    private async cleanupCorrupted(): Promise<number> {
        const cachePath = this.pathManager.summariesDir;
        const files = await this.storage.listCacheFiles(cachePath, 'json');
        let cleaned = 0;

        for (const file of files) {
            try {
                const data = await this.storage.readJson(file);
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                console.error(`[SummarizerService] Corrupted cache file: ${file}`, error);
                await this.storage.delete(file);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[SummarizerService] Cleaned up ${cleaned} corrupted cache file(s)`);
        }

        return cleaned;
    }

    private async cleanupOrphans(allFileIds: Set<string>, cache: SummaryCache): Promise<number> {
        const currentFileIds = allFileIds;
        let cleaned = 0;

        for (const [fileId, summary] of Object.entries(cache)) {
            if (!currentFileIds.has(fileId)) {
                const path = this.pathManager.getSummaryPath(fileId);
                try {
                    await this.storage.delete(path);
                    cleaned++;
                } catch (error) {
                    console.error(`[SummarizerService] Error deleting orphan ${path}:`, error);
                }
            }
        }

        if (cleaned > 0) {
            console.log(`[SummarizerService] Cleaned up ${cleaned} orphaned summaries`);
        }

        return cleaned;
    }

    async generateFolderSummaries(progressCallback?: (message: string) => void): Promise<void> {
        console.log('[SummarizerService] Generating folder summaries...');
        progressCallback?.('Scanning folders...');

        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();
        const folderGroups = new Map<string, any[]>();

        for (const file of allFiles) {
            const pathParts = file.path.split('/');
            if (pathParts.length <= 1) continue;

            const folderPath = pathParts.slice(0, -1).join('/');
            if (!folderGroups.has(folderPath)) {
                folderGroups.set(folderPath, []);
            }

            const files = folderGroups.get(folderPath)!;
            if (files.length < 10) {
                files.push(file);
            }
        }

        progressCallback?.(`Found ${folderGroups.size} folders`);

        let processed = 0;
        for (const [folderPath, files] of folderGroups.entries()) {
            try {
                const prompt = this.buildFolderSummaryPrompt(folderPath, files);
                const summary = await this.apiClient.chat(prompt, { expectJson: true });
                const summaryData = JSON.parse(summary);

                const folderId = folderPath.replace(/\//g, '-');
                const folderSummary = {
                    path: folderPath,
                    theme: summaryData.theme || '',
                    keywords: summaryData.keywords || [],
                    lastUpdated: new Date().toISOString(),
                    sampleFiles: files.map(f => f.basename)
                };

                await this.storage.writeJson(
                    this.pathManager.getFolderSummaryPath(folderId),
                    folderSummary
                );
                processed++;
                if (processed % 5 === 0) {
                    progressCallback?.(`Processed ${processed}/${folderGroups.size} folders`);
                }
            } catch (error) {
                console.error(`[SummarizerService] Failed to summarize folder ${folderPath}:`, error);
            }
        }

        console.log(`[SummarizerService] Generated summaries for ${folderGroups.size} folders`);
    }

    async getFolderSummaries(): Promise<Map<string, { path: string; theme: string; keywords: string[] }>> {
        const summariesDir = this.pathManager.folderSummariesDir;
        const summaries: Map<string, any> = new Map();

        try {
            const files = await this.storage.listCacheFiles(summariesDir, 'json');
            for (const file of files) {
                try {
                    const data = await this.storage.readJson(file);
                    if (data) {
                        const folderId = file.split('/').pop()?.replace('.json', '') || '';
                        summaries.set(folderId, data);
                    }
                } catch (error) {
                    console.error(`[SummarizerService] Error loading folder summary: ${file}`, error);
                }
            }
        } catch (error) {
            console.error('[SummarizerService] Error loading folder summaries:', error);
        }

        return summaries;
    }

    /**
     * 增量更新文件夹摘要（归档后调用）
     */
    async updateFolderSummariesForMovedFiles(movedFiles: Array<{ from: string; to: string }>): Promise<void> {
        const affectedFolders = new Set<string>();

        // 收集受影响的文件夹
        for (const move of movedFiles) {
            const fromFolder = this.getFolderFromPath(move.from);
            const toFolder = this.getFolderFromPath(move.to);
            if (fromFolder) affectedFolders.add(fromFolder);
            if (toFolder) affectedFolders.add(toFolder);
        }

        // 更新每个受影响的文件夹摘要
        for (const folderPath of affectedFolders) {
            await this.updateFolderSummary(folderPath);
        }
    }

    /**
     * 增量更新单个文件夹摘要
     */
    private async updateFolderSummary(folderPath: string): Promise<void> {
        const folderId = folderPath.replace(/\//g, '-');
        const existingSummary = await this.storage.readJson(
            this.pathManager.getFolderSummaryPath(folderId)
        );

        if (!existingSummary) {
            // 不存在则创建新摘要（不应该发生，因为归档前已生成）
            console.log(`[SummarizerService] No existing summary for ${folderPath}, skipping update`);
            return;
        }

        // 获取当前文件夹中的文件
        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();
        const currentFiles = allFiles.filter(f => {
            const fileFolder = this.getFolderFromPath(f.path);
            return fileFolder === folderPath;
        });

        // 追加新文件到 sampleFiles，取最后10个
        const existingSamples = new Set(existingSummary.sampleFiles || []);
        const newSamples = currentFiles
            .map(f => f.basename)
            .filter(name => !existingSamples.has(name));

        const updatedSamples = [
            ...(existingSummary.sampleFiles || []),
            ...newSamples
        ].slice(-10);

        // 更新摘要
        existingSummary.sampleFiles = updatedSamples;
        existingSummary.lastUpdated = new Date().toISOString();

        await this.storage.writeJson(
            this.pathManager.getFolderSummaryPath(folderId),
            existingSummary
        );

        console.log(`[SummarizerService] Updated summary for ${folderPath}: ${updatedSamples.length} samples`);
    }

    /**
     * 从文件路径获取文件夹路径
     */
    private getFolderFromPath(filePath: string): string | null {
        const pathParts = filePath.split('/');
        if (pathParts.length <= 1) {
            return null;
        }
        return pathParts.slice(0, -1).join('/');
    }

    /**
     * 构建文件夹摘要提示词
     */
    private buildFolderSummaryPrompt(folderPath: string, files: any[]): string {
        const filesText = files.map((f, i) => {
            const preview = f.content ? f.content.substring(0, 200).replace(/\n/g, ' ') : f.basename;
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
}