export enum PathType {
    PluginData,    // 插件数据目录文件
    Markdown,      // Markdown 文件（vault 相对路径）
}

export class PathResolver {
    /**
     * 解析路径，确保包含正确的路径前缀
     */
    static resolvePath(path: string, type: PathType, configDir: string): string {
        switch (type) {
            case PathType.PluginData:
                return PathResolver.ensurePluginPath(path, configDir);
            case PathType.Markdown:
                return PathResolver.removePluginPath(path, configDir);
            default:
                throw new Error(`Unknown path type: ${type}`);
        }
    }

    /**
     * 确保插件数据文件有完整路径前缀
     */
    private static ensurePluginPath(path: string, configDir: string): string {
        // 如果已包含 .obsidian/plugins/，确保只有一个前缀
        if (path.includes('.obsidian/plugins/')) {
            // 移除所有重复的前缀，然后添加一个正确的
            const normalizedPath = PathResolver.removeAllPluginPrefixes(path);
            return `.obsidian/plugins/${configDir}/${normalizedPath}`;
        }

        // 检查是否是插件数据目录路径
        if (PathResolver.isPluginDataPath(path)) {
            return `.obsidian/plugins/${configDir}/${path}`;
        }

        // 默认作为插件数据路径处理
        return path;
    }

    /**
     * 移除插件路径前缀，返回 vault 相对路径
     */
    private static removePluginPath(path: string, configDir: string): string {
        // 如果不包含插件路径前缀，直接返回
        if (!path.includes('.obsidian/plugins/')) {
            return path;
        }

        // 移除一个插件路径前缀
        const pluginPath = `.obsidian/plugins/${configDir}/`;
        if (path.startsWith(pluginPath)) {
            return path.substring(pluginPath.length);
        }

        return path;
    }

    /**
     * 移除所有重复的插件路径前缀
     * 处理 .obsidian/plugins/{configDir}/ 的重复
     */
    private static removeAllPluginPrefixes(path: string): string {
        // 移除所有重复的 .obsidian/plugins/{dirname}/ 前缀
        // 重复前缀可能是 .obsidian/plugins/ 或 .obsidian/plugins/{configDir}/
        let normalized = path
            .replace(/^(\.obsidian\/plugins\/(ai-note\/)?)+/, '')
            .replace(/^\/+/, ''); // 移除前导斜杠

        return normalized;
    }

    /**
     * 判断是否是插件数据目录路径
     */
    private static isPluginDataPath(path: string): boolean {
        return path.startsWith('data/') ||
               path.startsWith('identity/') ||
               path.startsWith('snapshots/') ||
               path.startsWith('summaries/') ||
               path.startsWith('folder-') ||
               path.includes('data/cache/');
    }
}
