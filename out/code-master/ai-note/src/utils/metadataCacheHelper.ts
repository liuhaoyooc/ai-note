import { MetadataCache, TFile } from 'obsidian';

/**
 * Obsidian 元数据缓存辅助类
 * 提供对笔记标签、链接、YAML Frontmatter 等元数据的访问
 */
export class MetadataCacheHelper {
    private metadataCache: MetadataCache;

    constructor(metadataCache: MetadataCache) {
        this.metadataCache = metadataCache;
        console.log('[MetadataCacheHelper] Initialized');
    }

    /**
     * 获取文件的标签
     */
    getTags(file: TFile): string[] {
        const cache = this.metadataCache.getFileCache(file);
        if (!cache) {
            return [];
        }

        const tags: string[] = [];

        // 从标签中提取
        if (cache.tags) {
            cache.tags.forEach(tag => {
                tags.push(tag.tag);
            });
        }

        return tags;
    }

    /**
     * 获取文件的链接 (双向链接)
     */
    getLinks(file: TFile): Array<{ path: string; displayText?: string }> {
        const cache = this.metadataCache.getFileCache(file);
        if (!cache || !cache.links) {
            return [];
        }

        return cache.links.map(link => ({
            path: link.link,
            displayText: link.displayText
        }));
    }

    /**
     * 获取文件的嵌入内容
     */
    getEmbeds(file: TFile): string[] {
        const cache = this.metadataCache.getFileCache(file);
        if (!cache || !cache.embeds) {
            return [];
        }

        return cache.embeds.map(embed => embed.link);
    }

    /**
     * 获取文件的 YAML Frontmatter
     */
    getFrontmatter(file: TFile): Record<string, any> {
        const cache = this.metadataCache.getFileCache(file);
        if (!cache || !cache.frontmatter) {
            return {};
        }

        return cache.frontmatter;
    }

    /**
     * 获取文件的标题 (从 frontmatter 或第一个 heading)
     */
    getTitle(file: TFile): string {
        // 优先从 frontmatter 获取标题
        const frontmatter = this.getFrontmatter(file);
        if (frontmatter.title) {
            return frontmatter.title;
        }

        // 从缓存获取 headings
        const cache = this.metadataCache.getFileCache(file);
        if (cache && cache.headings && cache.headings.length > 0) {
            return cache.headings[0].heading;
        }

        // 使用文件名
        return file.basename;
    }

    /**
     * 获取文件的所有 headings
     */
    getHeadings(file: TFile): Array<{ level: number; heading: string }> {
        const cache = this.metadataCache.getFileCache(file);
        if (!cache || !cache.headings) {
            return [];
        }

        return cache.headings.map(h => ({
            level: h.level,
            heading: h.heading
        }));
    }

    /**
     * 检查文件是否有特定标签
     */
    hasTag(file: TFile, tag: string): boolean {
        const tags = this.getTags(file);
        return tags.some(t => t.toLowerCase() === tag.toLowerCase());
    }

    /**
     * 获取反向链接 (指向该文件的链接)
     */
    getBacklinks(file: TFile): TFile[] {
        const backlinks = this.metadataCache.getBacklinksForFile(file);
        if (!backlinks) {
            return [];
        }

        return Array.from(backlinks.keys());
    }

    /**
     * 获取文件的完整元数据摘要
     */
    getFileMetadata(file: TFile): {
        tags: string[];
        links: Array<{ path: string; displayText?: string }>;
        embeds: string[];
        frontmatter: Record<string, any>;
        title: string;
        headings: Array<{ level: number; heading: string }>;
        backlinksCount: number;
    } {
        return {
            tags: this.getTags(file),
            links: this.getLinks(file),
            embeds: this.getEmbeds(file),
            frontmatter: this.getFrontmatter(file),
            title: this.getTitle(file),
            headings: this.getHeadings(file),
            backlinksCount: this.getBacklinks(file).length
        };
    }
}
