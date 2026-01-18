# 路径系统重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构路径处理逻辑，消除重复的前缀处理逻辑，建立清晰的路径类型系统

**Architecture:** 引入路径类型概念（PluginPath vs VaultPath），建立统一的路径转换层

**Tech Stack:** TypeScript, Obsidian Plugin API, existing PathManager and StorageService

---

## 问题分析

### 当前坏味道

1. **职责混乱**：
   - `PathManager` 不知道是否需要添加 `.obsidian/plugins/` 前缀
   - ` `StorageService` 需要硬编码检查（`data/`, `identity/` 等）来判断是否添加前缀
   - 两个组件都在处理路径前缀，职责不清晰

2. **逻辑重复**：
   - `ensureFullPath()` 添加前缀
   - `listCacheFiles()` 移除前缀
   - 相反的操作，容易出错

3. **脆弱的实现**：
   - while 循环 + replace 移除重复前缀（临时修复，不优雅）
   - 硬编码的前缀检查（`data/`, `identity/`, `snapshots/`, `summaries/`, `folder-`）
   - 容易出错，难以维护

4. **缺乏抽象**：
   - 路径类型没有明确的类型系统
   - 没有统一的路径转换接口
   - 路径处理逻辑散布在多个方法中

### 当前路径流

```
PathManager (返回相对路径)
    ↓
StorageService.ensureFullPath() (添加前缀)
    ↓
Obsidian adapter (使用完整路径)
```

但实际使用中还会出现：
- `listCacheFiles()` 接收可能已包含前缀的路径
- 各种手动检查前缀的代码分散在不同方法中

---

## 重构方案：类型化路径系统

### 核心设计

```typescript
// 定义路径类型
enum PathType {
  PluginData,    // 插件数据目录文件，需要完整路径
  Markdown,      // Markdown 文件，使用 vault 相对路径
}

class PathResolver {
  resolvePath(path: string, type: PathType, configDir: string): string
}
```

### 架构

```
PathManager (定义路径)
    ↓
PathResolver (统一路径转换)
    ↓
Obsidian adapter (使用路径)
```

---

## Task 1: 创建 PathResolver 类

**Files:**
- Create: `out/code-master/ai-note/src/utils/pathResolver.ts`
- Modify: `out/code-master/ai-note/src/services/storageService.ts` (添加导入)

**Step 1: 创建 PathResolver 工具类**

创建 `src/utils/pathResolver.ts`：

```typescript
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
     */
    private static removeAllPluginPrefixes(path: string): string {
        let normalized = path;
        while (normalized.includes('.obsidian/plugins/')) {
            const regex = /\.obsidian\/plugins\/[^/]+\/+/g;
            normalized = normalized.replace(regex, '');
        }
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
```

**Step 2: 更新 StorageService 使用 PathResolver**

修改 `storageService.ts`：

```typescript
import { PathResolver, PathType } from '../utils/pathResolver';

export class StorageService {
    private vault: Vault;
    private configDir: string;
    private pathManager: PathManager;

    constructor(vault: Vault, configDir: string, pathManager: PathManager) {
        this.vault = vault;
        this.configDir = configDir;
        this.pathManager = pathManager;
    }

    // 移除 ensureFullPath()，改用 PathResolver
    // 所有方法现在使用 PathResolver.resolvePath()
}
```

**Step 3: 更新所有路径处理方法**

```typescript
async readJson(path: string): Promise<any> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    // ... 使用 fullPath
}

async writeJson(path: string, data: unknown): Promise<void> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    // ... 使用 fullPath
}

async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
    // dir 本身已经是相对路径，直接构建完整路径
    const targetDir = PathResolver.resolvePath(dir, PathType.PluginData, this.configDir);
    // ... 使用 targetDir
}

async exists(path: string): Promise<boolean> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this.configDir);
    return await this.vault.adapter.exists(fullPath);
}

async delete(path: string): Promise<void> {
    const fullPath = PathResolver.resolvePath(path, PathType.PluginData, this_configDir);
    if (await this.vault.adapter.exists(fullPath)) {
        await this.vault.adapter.remove(fullPath);
    }
}

// Markdown 文件不需要路径转换
async writeMarkdown(dir: string, filePath: string, content: string): Promise<void> {
    // 直接使用 dir 和 filePath，不需要转换
}
```

**Step 4: 测试路径解析**

创建 `tests/utils/pathResolver.test.ts`：

```typescript
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
    });

    describe('Error handling', () => {
        it('should throw error for unknown path type', () => {
            expect(() => {
                PathResolver.resolvePath('test/path.json', 'unknown' as PathType, configDir);
            }).toThrow('Unknown path type: unknown');
        });
    });
});
```

**Step 5: 运行测试验证**

```bash
cd /Users/liuhao/Documents/persional/ai-note/out/code-master/ai-note
npm test -- pathResolver.test.ts
```

**Step 6: 提交**

```bash
git add src/utils/pathResolver.ts tests/utils/pathResolver.test.ts
git commit -m "refactor: add PathResolver for unified path handling"
```

---

## Task 2: 重构 StorageService 使用 PathResolver

**Files:**
- Modify: `out/code-master/ai-note/src/services/storageService.ts`
- Read: `out/code-master/ai-note/src/services/identityService.ts`

**Step 1: 移除 ensureFullPath 方法**

删除 `ensureFullPath()` 方法。

**Step 2: 更新所有使用路径的方法**

更新 `readJson`, `writeJson`, `exists`, `delete`, `listCacheFiles`, `initialize` 使用 PathResolver。

**Step 3: 编译测试**

```bash
npm run build
cp main.js "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
```

**Step 4: 测试 Obsidian 功能**

在 Obsidian 中测试所有功能。

**Step 5: 移除调试日志**

修改 `identityService.ts`，移除所有 console.log。

**Step 6: 编译最终版本并提交**

```bash
npm run build
cp main.js "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
git add src/services/storageService.ts src/services/identityService.ts src/utils/pathResolver.ts tests/utils/pathResolver.test.ts
git commit -m "refactor: replace ensureFullPath with PathResolver"
```

---

## Task 3: 更新 PATH_RULES.md 文档

**Files:**
- Modify: `docs/PATH_RULES.md`

添加 PathResolver 文档，更新所有路径使用示例。

**Step 1: 编译测试**

```bash
npm test
npm run build
```

**Step 2: 提交文档**

```bash
git add docs/PATH_RULES.md
git commit -m "docs: update path rules with PathResolver documentation"
```

---

## Task 4: 添加 PathType 集成到 PathManager

**Files:**
- Modify: `out/code-master/ai-note/src/services/pathManager.ts`

**Step 1: 添加路径类型方法**

```typescript
getType(path: string): PathType {
    if (this.isPluginDataPath(path)) {
        return PathType.PluginData;
    }
    return PathType.Markdown;
}

resolvePluginPath(path: string): string {
    return PathResolver.resolvePath(path, PathType.PluginData, this.pluginDataPath);
}

resolveMarkdownPath(path: string): string {
    return PathResolver.resolvePath(path, PathType.Markdown, this.pluginDataPath);
}
```

**Step 2: 编译测试提交**

```bash
npm run build
git add src/services/pathManager.ts
git commit -m "refactor: add convenience path methods to PathManager"
```

---

## 任务 5: 移除硬编码的前缀检查

**Files:**
- Modify: `out/code-master/ai-note/src/utils/pathResolver.ts`

**Step 1: 改进 isPluginDataPath 检查**

```typescript
private static isPluginDataPath(path: string): boolean {
    const pluginDataPrefixes = [
        'data/',
        'identity/',
        'snapshots/',
        'summaries/',
        'folder-summaries/',
        'research/',
    ];

    return pluginDataPrefixes.some(prefix => path.startsWith(prefix));
}
```

**Step 2: 添加测试并提交**

```bash
npm test -- pathResolver.test.ts
npm run build
git add src/utils/pathResolver.ts tests/utils/pathResolver.test.ts
git commit -m "refactor: improve isPluginDataPath with whitelist check"
```

---

## 总结

### 重构前的问题

1. **路径前缀处理逻辑重复**
2. **硬编码的前缀检查**
3. **脆弱的重复前缀移除逻辑**
4. **缺乏类型系统的路径处理**
5. **调试日志散布在代码中**

### 重构后的改进

1. **清晰的职责分离**
2. **类型安全的路径处理**
3. **健壮的实现**
4. **可维护性**
