import { StorageService } from './storageService';
import type { FileSummary } from '../types/summary';

export class SummaryStore {
    private storage: StorageService;
    private cache: Record<string, FileSummary> = {};
    private cachePath = '.ai-note/summaries/';

    constructor(storage: StorageService) {
        this.storage = storage;
        console.log('[SummaryStore] Initialized');
    }

    async read(fileId: string): Promise<FileSummary | null> {
        const path = `${this.cachePath}${fileId}.json`;
        return await this.storage.readJson<FileSummary>(path);
    }

    async write(summary: FileSummary): Promise<void> {
        const path = `${this.cachePath}${summary.file_id}.json`;
        await this.storage.writeJson(path, summary);
        this.cache[summary.file_id] = summary;
    }

    async loadCache(): Promise<void> {
        const files = await this.storage.listFiles(this.cachePath, 'json');
        this.cache = {};

        for (const file of files) {
            try {
                const fileId = file.replace('.json', '').replace(this.cachePath, '');
                const data = await this.storage.readJson<FileSummary>(file);
                if (data) {
                    this.cache[fileId] = data;
                }
            } catch (error) {
                console.error(`[SummaryStore] Error loading cache for ${file}:`, error);
            }
        }

        console.log(`[SummaryStore] Loaded ${Object.keys(this.cache).length} cached summaries`);
    }

    async cleanupCorrupted(): Promise<number> {
        let cleaned = 0;

        for (const [fileId, summary] of Object.entries(this.cache)) {
            if (!summary || !summary.summary || !summary.file_id) {
                const path = `${this.cachePath}${fileId}.json`;
                try {
                    await this.storage.delete(path);
                    cleaned++;
                } catch (error) {
                    console.error(`[SummaryStore] Error deleting ${path}:`, error);
                }
            }
        }

        return cleaned;
    }

    async cleanupOrphans(fileIds: Set<string>): Promise<number> {
        let cleaned = 0;

        for (const fileId of Object.keys(this.cache)) {
            if (!fileIds.has(fileId)) {
                const path = `${this.cachePath}${fileId}.json`;
                try {
                    await this.storage.delete(path);
                    delete this.cache[fileId];
                    cleaned++;
                } catch (error) {
                    console.error(`[SummaryStore] Error deleting ${path}:`, error);
                }
            }
        }

        if (cleaned > 0) {
            console.log(`[SummaryStore] Cleaned up ${cleaned} orphaned summaries`);
        }

        return cleaned;
    }

    getAll(): Record<string, FileSummary> {
        return this.cache;
    }

    has(fileId: string): boolean {
        return this.cache.hasOwnProperty(fileId);
    }

    get(fileId: string): FileSummary | undefined {
        return this.cache[fileId];
    }
}
