import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';
import { formatDate } from '../utils/dateHelper';
import * as diff from 'diff';
import { FileChangeType, ChangeSummary, SnapshotEntry, SnapshotIndex } from '../types/review';

export class DiffService {
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private apiClient: ApiClient;
    private maxDiffLines = 100;
    private snapshotPath = '.ai-note/snapshots/';

    constructor(obsidianHelper: ObsidianHelper, storage: StorageService, apiClient: ApiClient) {
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.apiClient = apiClient;
        console.log('[DiffService] Initialized');
    }

    async detectChanges(maxLines?: number): Promise<ChangeSummary> {
        console.log('[DiffService] Detecting file changes...');

        const maxLinesCount = maxLines || this.maxDiffLines;

        const index = await this.readSnapshotIndex();
        const summary: ChangeSummary = {
            added: [],
            modified: [],
            deleted: []
        };

        const allFiles = await this.obsidianHelper.getAllMarkdownFiles();

        if (!index || Object.keys(index.files).length === 0) {
            console.log('[DiffService] First run, creating initial snapshots...');
            await this.createInitialSnapshots(allFiles);
            return summary;
        }

        const existingFilePaths = new Set<string>();
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
                        type: FileChangeType.ADDED,
                        newHash: hash
                    });
                } else if (snapshotEntry.hash !== hash) {
                    let diff: string | undefined;

                    const snapshotPath = `${this.snapshotPath}${snapshotEntry.snapshotFile}`;
                    const oldContent = await this.storage.readJson<string>(snapshotPath);

                    if (oldContent) {
                        diff = this.calculateDiff(oldContent, content, maxLinesCount);
                    }

                    summary.modified.push({
                        path: relPath,
                        type: FileChangeType.MODIFIED,
                        oldHash: snapshotEntry.hash,
                        newHash: hash,
                        diff
                    });
                }
            } catch (error) {
                console.error(`[DiffService] Error processing file ${file.path}:`, error);
            }
        }

        for (const filePath of Object.keys(index.files)) {
            if (!existingFilePaths.has(filePath)) {
                summary.deleted.push({
                    path: filePath,
                    type: FileChangeType.DELETED,
                    oldHash: index.files[filePath].hash
                });
            }
        }

        console.log(`[DiffService] Changes: ${summary.added.length} added, ${summary.modified.length} modified, ${summary.deleted.length} deleted`);
        return summary;
    }

    private async readSnapshotIndex(): Promise<SnapshotIndex | null> {
        const indexFile = `${this.snapshotPath}index.json`;
        return await this.storage.readJson<SnapshotIndex>(indexFile);
    }

    private async writeSnapshotIndex(index: SnapshotIndex): Promise<void> {
        const indexFile = `${this.snapshotPath}index.json`;
        await this.storage.writeJson(indexFile, index);
    }

    private async createInitialSnapshots(files: any[]): Promise<void> {
        console.log('[DiffService] Creating initial snapshots...');

        const index: SnapshotIndex = {
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

                const snapshotPath = `${this.snapshotPath}${hash}.sn`;
                await this.storage.writeJson(snapshotPath, content);
            } catch (error) {
                console.error(`[DiffService] Error creating snapshot for ${file.path}:`, error);
            }
        }

        await this.writeSnapshotIndex(index);
        console.log(`[DiffService] Created ${Object.keys(index.files).length} initial snapshots`);
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

    private async calculateHash(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    setMaxDiffLines(lines: number): void {
        this.maxDiffLines = lines;
    }
}
