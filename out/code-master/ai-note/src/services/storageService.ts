import { PathManager } from './pathManager';
import { Vault } from 'obsidian';
import { PathResolver, PathType } from '../utils/pathResolver';

export class StorageService {
    private vault: Vault;
    private configDir: string;
    private pathManager: PathManager;
    private cacheSubdirs = [
        'summaries',
        'folder-summaries',
        'snapshots',
        'identity',
        'research/topics',
        'research/history'
    ];

    constructor(vault: Vault, configDir: string, pathManager: PathManager) {
        this.vault = vault;
        this.configDir = configDir;
        this.pathManager = pathManager;
        console.log('[StorageService] Initialized');
        console.log(`[StorageService] Config dir: ${configDir}`);
    }

    async initialize(): Promise<void> {
        const pluginCacheDir = PathResolver.resolvePath(this.pathManager.pluginCacheDir, PathType.PluginData, this.configDir);
        if (!(await this.vault.adapter.exists(pluginCacheDir))) {
            await this.vault.adapter.mkdir(pluginCacheDir);
            console.log(`[StorageService] Created plugin cache directory: ${pluginCacheDir}`);
        }

        const cacheDirs = [
            this.pathManager.summariesDir,
            this.pathManager.folderSummariesDir,
            this.pathManager.snapshotsDir,
            this.pathManager.identityDir,
            this.pathManager.researchTopicsDir,
            this.pathManager.researchHistoryDir
        ];

        for (const dir of cacheDirs) {
            const fullPath = PathResolver.resolvePath(dir, PathType.PluginData, this.configDir);
            if (!(await this.vault.adapter.exists(fullPath))) {
                await this.vault.adapter.mkdir(fullPath);
                console.log(`[StorageService] Created cache directory: ${fullPath}`);
            }
        }

        const outputDirs = [
            this.pathManager.dailyReviewsDir,
            this.pathManager.weeklyReviewsDir,
            this.pathManager.researchReportsDir,
            this.pathManager.unsortedDir
        ];

        for (const dir of outputDirs) {
            const exists = await this.vault.adapter.exists(dir);

            if (!exists) {
                try {
                    await this.vault.createFolder(dir);
                    console.log(`[StorageService] Created directory: ${dir}`);
                } catch (error: any) {
                    if (error.message?.includes('already exists')) {
                        console.log(`[StorageService] Directory already exists: ${dir}`);
                    } else {
                        throw error;
                    }
                }
            } else {
                console.log(`[StorageService] Directory already exists: ${dir}`);
            }
        }
    }

    async readJson(path: string): Promise<any> {
        const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
        if (!(await this.vault.adapter.exists(fullPath))) {
            return null;
        }

        try {
            const content = await this.vault.adapter.read(fullPath) as string;
            return JSON.parse(content);
        } catch (error) {
            console.error(`[StorageService] Failed to read JSON from ${fullPath}:`, error);
            return null;
        }
    }

    async writeJson(path: string, data: unknown): Promise<void> {
        const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
        const content = JSON.stringify(data, null, 0);
        try {
            await this.vault.adapter.write(fullPath, content);
        } catch (error) {
            console.error(`[StorageService] Failed to write JSON to ${fullPath}:`, error);
            throw error;
        }
    }

    async exists(path: string): Promise<boolean> {
        const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
        return await this.vault.adapter.exists(fullPath);
    }

    async delete(path: string): Promise<void> {
        const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
        if (await this.vault.adapter.exists(fullPath)) {
            try {
                await this.vault.adapter.remove(fullPath);
            } catch (error) {
                console.error(`[StorageService] Failed to delete ${fullPath}:`, error);
            }
        }
    }

    async listFiles(dir: string, extension: string = '.json'): Promise<string[]> {
        try {
            // 使用 Obsidian 的 Vault API 获取所有文件，然后过滤
            // Normalize directory path to ensure it ends with /
            const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`;

            const allFiles = await this.vault.getMarkdownFiles();

            // 过滤出指定目录下的文件
            const filteredFiles = allFiles.filter(file => {
                // 检查文件是否在目标目录中
                if (!file.path.startsWith(normalizedDir)) {
                    return false;
                }

                // 确保扩展名匹配
                const ext = extension.startsWith('.') ? extension : `.${extension}`;
                return file.path.endsWith(ext);
            });

            // 返回完整路径
            return filteredFiles.map(file => file.path);
        } catch (error) {
            console.error(`[StorageService] Failed to list files in ${dir}:`, error);
            return [];
        }
    }

    /**
     * 列出插件数据目录中的 JSON 缓存文件
     * 注意：插件数据目录不在 vault 的 Markdown 文件系统中，
     * 需要使用 adapter.list() 或其他方法
     */
    async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
        try {
            const adapter = this.vault.adapter;

            // Use PathResolver to normalize and construct the full path
            const targetDir = PathResolver.resolvePath(dir, PathType.PluginData, this.configDir);

            if (!(await adapter.exists(targetDir))) {
                console.warn(`[StorageService] Cache directory does not exist: ${targetDir}`);
                return [];
            }

            const listedFiles = await adapter.list(targetDir);

            if (!listedFiles || !listedFiles.files || listedFiles.files.length === 0) {
                console.log(`[StorageService] No files found in ${targetDir}`);
                return [];
            }

            const ext = extension.startsWith('.') ? extension : `.${extension}`;
            const result: string[] = [];

            // Return full paths from vault root
            for (const fileName of listedFiles.files) {
                if (fileName.endsWith(ext)) {
                    // adapter.list() may return filenames with or without path prefix
                    // If filename already contains the path, use it directly
                    if (fileName.includes('.obsidian/plugins/')) {
                        result.push(fileName);
                    } else {
                        // Otherwise, construct the full path
                        result.push(targetDir + (targetDir.endsWith('/') ? '' : '/') + fileName);
                    }
                }
            }

            console.log(`[StorageService] Found ${result.length} ${ext} files in ${targetDir}`);
            return result;
        } catch (error) {
            console.error(`[StorageService] Failed to list cache files in ${dir}:`, error);
            return [];
        }
    }

    getCacheDir(): string {
        return this.pathManager.pluginCacheDir;
    }

    async writeMarkdown(dir: string, filePath: string, content: string): Promise<void> {
        const fullPath = this.pathManager.joinPaths(dir, filePath);
        const file: any = this.vault.getAbstractFileByPath(fullPath);

        if (file && !file.children) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(fullPath, content);
        }
    }

    async readMarkdown(dir: string, filePath: string): Promise<string | null> {
        const fullPath = this.pathManager.joinPaths(dir, filePath);
        const file: any = this.vault.getAbstractFileByPath(fullPath);

        if (!file || file.children) {
            return null;
        }

        return await this.vault.read(file);
    }

    getPath(type: string, subtypeOrFilename: string, filename?: string): string {
        if (type === 'summaries') {
            return this.pathManager.getSummaryPath(subtypeOrFilename);
        }
        if (type === 'folder-summaries') {
            return this.pathManager.getFolderSummaryPath(subtypeOrFilename);
        }
        if (type === 'snapshots') {
            return this.pathManager.getSnapshotPath(subtypeOrFilename);
        }
        if (type === 'identity') {
            return this.pathManager.getIdentityPath();
        }
        if (type === 'history') {
            return this.pathManager.getResearchHistoryIndexPath();
        }
        if (type === 'reviews' && filename) {
            if (subtypeOrFilename === 'daily') {
                return this.pathManager.getDailyReviewPath(filename);
            }
            if (subtypeOrFilename === 'weekly') {
                return this.pathManager.getWeeklyReviewPath(parseInt(filename), new Date().getFullYear());
            }
        }
        if (type === 'research' && filename) {
            if (subtypeOrFilename === 'reports') {
                return this.pathManager.getResearchReportPath(filename, subtypeOrFilename);
            }
        }
        throw new Error(`Invalid path type: ${type}`);
    }
}
