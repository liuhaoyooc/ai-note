import { PathResolver, PathType } from '../../src/utils/pathResolver';

describe('PathResolver', () => {
    const configDir = 'ai-note';

    describe('PluginData paths', () => {
        it('should add prefix to relative path', () => {
            const result = PathResolver.resolvePath('data/cache/summaries/abc.json', PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/data/cache/summaries/abc.json');
        });

        it('should handle path with existing prefix', () => {
            const input = '.obsidian/plugins/ai-note/data/cache/summaries/abc.json';
            const result = PathResolver.resolvePath(input, PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/data/cache/summaries/abc.json');
        });

        it('should remove duplicate prefixes', () => {
            const input = '.obsidian/plugins/.obsidian/plugins/ai-note/data/cache/summaries';
            const result = PathResolver.resolvePath(input, PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/data/cache/summaries');
        });

        it('should handle identity directory', () => {
            const result = PathResolver.resolvePath('identity/profile.json', PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/identity/profile.json');
        });

        it('should handle snapshots directory', () => {
            const result = PathResolver.resolvePath('snapshots/file.sn', PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/snapshots/file.sn');
        });

        it('should handle summaries directory', () => {
            const result = PathResolver.resolvePath('summaries/abc.json', PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/summaries/abc.json');
        });

        it('should handle folder-summaries directory', () => {
            const result = PathResolver.resolvePath('folder-summaries/folder.json', PathType.PluginData, configDir);
            expect(result).toBe('.obsidian/plugins/ai-note/folder-summaries/folder.json');
        });
    });

    describe('Markdown paths', () => {
        it('should keep markdown path as-is', () => {
            const result = PathResolver.resolvePath('复盘/2025-01-18.md', PathType.Markdown, configDir);
            expect(result).toBe('复盘/2025-01-18.md');
        });

        it('should remove plugin path from markdown path', () => {
            const input = '.obsidian/plugins/ai-note/复盘/2025-01-18.md';
            const result = PathResolver.resolvePath(input, PathType.Markdown, configDir);
            expect(result).toBe('复盘/2025-01-18.md');
        });

        it('should handle research directory', () => {
            const result = PathResolver.resolvePath('调研/2025-01-18-topic.md', PathType.Markdown, configDir);
            expect(result).toBe('调研/2025-01-18-topic.md');
        });
    });

    describe('Error handling', () => {
        it('should throw error for unknown path type', () => {
            expect(() => {
                PathResolver.resolvePath('test/path.json', 'unknown' as PathType, configDir);
            }).toThrow('Unknown path type: unknown');
        });
    });
});
