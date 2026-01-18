# Fix IdentityService Summary Collection

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 IdentityService 无法读取摘要文件的问题，使调研功能能够正常执行

**Architecture:** `StorageService.listFiles()` 使用 `vault.getMarkdownFiles()` 只返回 `.md` 文件，但摘要存储为 `.json` 文件在插件数据目录。需要添加一个新的方法来列出 JSON 缓存文件。

**Tech Stack:** TypeScript, Obsidian API, Vault.adapter API

---

## Task 1: 在 StorageService 中添加 listCacheFiles 方法

**Files:**
- Modify: `src/services/storageService.ts:140-199` (在 listFiles 方法后添加新方法)

**Step 1: 添加 listCacheFiles 方法**

在 `listFiles` 方法后添加新方法，用于列出插件数据目录中的 JSON 文件：

```typescript
/**
 * 列出插件数据目录中的 JSON 缓存文件
 * 注意：插件数据目录不在 vault 的 Markdown 文件系统中，
 * 需要使用 adapter.list() 或其他方法
 */
async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
    try {
        // Normalize directory path to ensure it ends with /
        const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`;

        // 使用 Obsidian 的 adapter.list() 方法获取目录内容
        // 注意：adapter.list() 可能返回 TFile 对象或字符串路径，取决于 Obsidian 版本
        const adapter = this.vault.adapter;

        // 检查目录是否存在
        if (!(await adapter.exists(normalizedDir))) {
            console.warn(`[StorageService] Cache directory does not exist: ${normalizedDir}`);
            return [];
        }

        // 使用 adapter.list() 获取目录内容
        const contents = await adapter.list(normalizedDir);

        if (!contents || contents.length === 0) {
            console.log(`[StorageService] No files found in ${normalizedDir}`);
            return [];
        }

        // 过滤出指定扩展名的文件
        const ext = extension.startsWith('.') ? extension : `.${extension}`;

        // adapter.list() 返回的可能是文件名或路径，需要处理
        const result: string[] = [];
        for (const item of contents) {
            // item 可能是字符串或对象，统一处理
            const itemName = typeof item === 'string' ? item : (item as any).name;

            if (itemName && itemName.endsWith(ext)) {
                // 组合完整路径
                result.push(normalizedDir + itemName);
            }
        }

        console.log(`[StorageService] Found ${result.length} ${ext} files in ${normalizedDir}`);
        return result;
    } catch (error) {
        console.error(`[StorageService] Failed to list cache files in ${dir}:`, error);
        return [];
    }
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 3: 提交更改**

```bash
git add src/services/storageService.ts
git commit -m "feat: add listCacheFiles method for plugin data directory JSON files"
```

---

## Task 2: 修改 IdentityService 使用 listCacheFiles

**Files:**
- Modify: `src/services/identityService.ts:82-108`

**Step 1: 更新 collectSummaries 方法使用 listCacheFiles**

将：
```typescript
const cachePath = this.pathManager.summariesDir;

try {
    const files = await this.storage.listFiles(cachePath, 'json');
```

替换为：
```typescript
const cachePath = this.pathManager.summariesDir;

try {
    const files = await this.storage.listCacheFiles(cachePath, 'json');
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 3: 提交更改**

```bash
git add src/services/identityService.ts
git commit -m "fix: use listCacheFiles for summary collection in IdentityService"
```

---

## Task 3: 更新 SummarizerService 使用 listCacheFiles（可选）

**Files:**
- Modify: `src/services/summarizerService.ts:110-130` (loadCache 方法)
- Modify: `src/services/summarizerService.ts:375-395` (loadFolderSummaries 方法)

**Step 1: 更新 loadCache 方法**

找到 `loadCache` 方法中的：
```typescript
const files = await this.storage.listFiles(cachePath, 'json');
```

替换为：
```typescript
const files = await this.storage.listCacheFiles(cachePath, 'json');
```

**Step 2: 更新 getFolderSummaries 方法中的 loadFolderSummaries**

找到 `getFolderSummaries` 方法中的：
```typescript
const files = await this.storage.listFiles(summariesDir, 'json');
```

替换为：
```typescript
const files = await this.storage.listCacheFiles(summariesDir, 'json');
```

**Step 3: 验证编译**

Run: `npm run build`
Expected: SUCCESS

**Step 4: 提交更改**

```bash
git add src/services/summarizerService.ts
git commit -m "fix: use listCacheFiles for summary cache operations"
```

---

## Task 4: 验证 listCacheFiles 实现的兼容性

**Step 1: 检查 Obsidian adapter.list() API**

如果 `adapter.list()` 不可用或行为不符合预期，需要使用替代方案：

替代方案 A - 使用 Vault.createFolder() + 维护索引：
```typescript
async listCacheFiles(dir: string, extension: string = '.json'): Promise<string[]> {
    try {
        // 如果无法直接列出目录，返回空数组
        // 这种情况下需要维护一个文件索引
        const indexPath = this.pathManager.joinPaths(dir, 'index.json');
        const indexData = await this.readJson(indexPath);
        if (indexData && indexData.files) {
            return indexData.files as string[];
        }
        return [];
    } catch (error) {
        return [];
    }
}
```

替代方案 B - 如果 adapter.list() 可用，测试并确保正确实现

**Step 2: 验证编译和测试**

Run: `npm run build`
Expected: SUCCESS

---

## Task 5: 测试和验证

**Step 1: 编译并安装插件**

Run:
```bash
npm run build
cp -f main.js "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
```

**Step 2: 在 Obsidian 中测试摘要生成**

1. 重新加载 AI Note 插件
2. 执行归档命令（会触发摘要生成）
3. 检查控制台输出，确认摘要文件已生成

**Step 3: 测试调研功能**

1. 执行调研命令
2. 检查控制台是否显示找到足够的摘要（应该 > 5）
3. 验证用户身份生成成功

**Step 4: 验证文件读取**

在 Obsidian 开发者控制台中运行：
```javascript
// 测试 listCacheFiles 是否能找到摘要文件
const plugin = app.plugins.plugins['ai-note'];
const storage = plugin.storage;
const pathManager = plugin.pathManager;
const summariesDir = pathManager.summariesDir;
const files = await storage.listCacheFiles(summariesDir, 'json');
console.log('Summary files found:', files.length);
console.log('First few files:', files.slice(0, 3));
```

---

## 验收标准

完成所有任务后：

1. ✅ `StorageService.listCacheFiles()` 正确列出 JSON 缓存文件
2. ✅ `IdentityService.collectSummaries()` 能读取到摘要
3. ✅ 调研功能能正常执行（显示找到 >= 5 个摘要）
4. ✅ 用户身份分析成功
5. ✅ 编译无错误
6. ✅ 功能测试通过

---

## 技术说明

### 问题根因

`StorageService.listFiles()` 使用 `vault.getMarkdownFiles()` 只返回 `.md` 文件，但摘要缓存是 `.json` 文件存储在插件数据目录中。

### 解决方案

添加 `listCacheFiles()` 方法，使用 `vault.adapter.list()` 来列出插件数据目录中的 JSON 文件。

### 文件修改汇总

| 文件 | 修改内容 |
|------|---------|
| `src/services/storageService.ts` | 添加 `listCacheFiles()` 方法 |
| `src/services/identityService.ts` | 使用 `listCacheFiles()` 读取摘要 |
| `src/services/summarizerService.ts` | 使用 `listCacheFiles()` 读取摘要缓存 |

### Obsidian API 说明

- `vault.getMarkdownFiles()` - 只返回 Markdown 文件
- `vault.adapter.list(path)` - 返回目录中的所有文件/文件夹
- `vault.adapter.exists(path)` - 检查路径是否存在
- `vault.adapter.mkdir(path)` - 创建目录

---

## 回滚方案

如果出现问题：

```bash
git reset --hard HEAD~1  # 回退一个版本
git checkout -b <backup-branch>
```

或查看提交历史：

```bash
git log --oneline -5
```
