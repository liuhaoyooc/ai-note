import { PathResolver, PathType } from '../utils/pathResolver';

export interface PathSettings {
    reviewsDir: string;
    researchDir: string;
    unsortedDir: string;
}

export class PathManager {
    private pluginDataPath: string;
    private vaultPath: string;
    private settings: PathSettings;

    constructor(pluginDataPath: string, vaultPath: string, settings: PathSettings) {
        // Remove any leading .obsidian/plugins/ prefix for consistency
        this.pluginDataPath = pluginDataPath.replace(/^\.obsidian\/plugins\//, '').replace(/^\/+/, '');
        this.vaultPath = vaultPath;
        this.settings = settings;
        console.log('[PathManager] Initialized with pluginDataPath:', this.pluginDataPath);
    }

    updateSettings(settings: PathSettings): void {
        this.settings = settings;
        console.log('[PathManager] Settings updated');
    }

    private ensureNoLeadingSlash(path: string): string {
        return path.startsWith('/') ? path.slice(1) : path;
    }

    private ensureNoTrailingSlash(path: string): string {
        return path.endsWith('/') ? path.slice(0, -1) : path;
    }

    private normalizePath(path: string): string {
        let normalized = path;
        normalized = this.ensureNoLeadingSlash(normalized);
        normalized = this.ensureNoTrailingSlash(normalized);
        return normalized;
    }

    private joinPaths(...parts: string[]): string {
        return parts
            .filter(part => part && part !== '')
            .map(part => this.normalizePath(part))
            .join('/');
    }

    get summariesDir(): string {
        // Return relative path from plugin data directory (data/cache/summaries)
        return this.joinPaths('data', 'cache', 'summaries');
    }

    get folderSummariesDir(): string {
        return this.joinPaths('data', 'cache', 'folder-summaries');
    }

    get snapshotsDir(): string {
        return this.joinPaths('data', 'cache', 'snapshots');
    }

    get identityDir(): string {
        return this.joinPaths('data', 'cache', 'identity');
    }

    get researchTopicsDir(): string {
        return this.joinPaths('data', 'cache', 'research', 'topics');
    }

    get researchHistoryDir(): string {
        return this.joinPaths('data', 'cache', 'research', 'history');
    }

    get pluginCacheDir(): string {
        return this.joinPaths('data', 'cache');
    }

    get pluginDataDir(): string {
        return this.joinPaths('data');
    }

    get reviewsDir(): string {
        const dir = this.settings.reviewsDir || '复盘';
        return this.normalizePath(dir);
    }

    get dailyReviewsDir(): string {
        return this.joinPaths(this.reviewsDir, 'daily');
    }

    get weeklyReviewsDir(): string {
        return this.joinPaths(this.reviewsDir, 'weekly');
    }

    get researchReportsDir(): string {
        const dir = this.settings.researchDir || '调研';
        return this.normalizePath(dir);
    }

    get unsortedDir(): string {
        const dir = this.settings.unsortedDir || '待整理';
        return this.normalizePath(dir);
    }

    getDailyReviewPath(date: string): string {
        return this.joinPaths(this.dailyReviewsDir, `${date}.md`);
    }

    getWeeklyReviewPath(weekNumber: number, year: number): string {
        return this.joinPaths(this.weeklyReviewsDir, `${year}-W${weekNumber}.md`);
    }

    getResearchReportPath(date: string, slug: string): string {
        return this.joinPaths(this.researchReportsDir, `${date}-${slug}.md`);
    }

    getSummaryPath(fileId: string): string {
        return this.joinPaths(this.summariesDir, `${fileId}.json`);
    }

    getFolderSummaryPath(folderId: string): string {
        return this.joinPaths(this.folderSummariesDir, `${folderId}.json`);
    }

    getSnapshotPath(hash: string): string {
        return this.joinPaths(this.snapshotsDir, `${hash}.sn`);
    }

    getSnapshotIndexPath(): string {
        return this.joinPaths(this.snapshotsDir, 'index.json');
    }

    getIdentityPath(): string {
        return this.joinPaths(this.identityDir, 'profile.json');
    }

    getResearchTopicsPath(date: string): string {
        return this.joinPaths(this.researchTopicsDir, `${date}.json`);
    }

    getResearchHistoryIndexPath(): string {
        return this.joinPaths(this.researchHistoryDir, 'index.json');
    }

    isHiddenDirectory(path: string, hiddenDirs: string[]): boolean {
        const parts = path.split('/');
        for (const part of parts) {
            if (hiddenDirs.includes(part)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取路径的类型
     */
    getType(path: string): PathType {
        if (this.isPluginDataPath(path)) {
            return PathType.PluginData;
        }
        return PathType.Markdown;
    }

    /**
     * 解析插件数据文件路径（添加完整路径前缀）
     */
    resolvePluginPath(path: string): string {
        return PathResolver.resolvePath(path, PathType.PluginData, this.pluginDataPath);
    }

    /**
     * 解析 Markdown 文件路径（移除插件路径前缀）
     */
    resolveMarkdownPath(path: string): string {
        return PathResolver.resolvePath(path, PathType.Markdown, this.pluginDataPath);
    }

    /**
     * 判断是否是插件数据目录路径
     */
    private isPluginDataPath(path: string): boolean {
        return path.startsWith('data/') ||
               path.startsWith('identity/') ||
               path.startsWith('snapshots/') ||
               path.startsWith('summaries/') ||
               path.startsWith('folder-') ||
               path.includes('data/cache/');
    }
}
