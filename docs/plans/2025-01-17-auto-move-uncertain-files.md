# Auto-Move Uncertain Files to Unsorted Directory

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 不确定文件自动移至待整理目录，移除 Modal 弹窗，下次归档时重新尝试分类

**Architecture:** 修改 `main.ts` 中的 `executeArchive` 方法，移除 `ArchiveModal` 调用，直接将不确定文件移至待整理目录。待整理目录的文件会在下次归档时被重新扫描和分类。

**Tech Stack:** TypeScript, Obsidian API

---

## Task 1: 修改 executeArchive 处理不确定文件

**Files:**
- Modify: `src/main.ts:271-295` (替换 ArchiveModal 调用为直接移动到待整理目录)

**Step 1: 替换不确定文件处理逻辑**

找到 `executeArchive` 方法中的不确定文件处理部分（约第 271-295 行），将：

```typescript
const uncertainFiles = decisions.filter(d => d.uncertain);

if (uncertainFiles.length > 0) {
    new ArchiveModal(
        this.app,
        uncertainFiles.map(d => ({ path: d.path, reason: d.reason })),
        async (targetDir) => {
            await this.handleManualArchive(uncertainFiles.map(d => ({ path: d.path, targetDir })));
        }
    ).open();
}
```

替换为：

```typescript
const uncertainFiles = decisions.filter(d => d.uncertain);

if (uncertainFiles.length > 0) {
    // 不确定文件直接移至待整理目录
    const unsortedDir = this.pathManager.unsortedDir;
    const movedUncertainFiles = uncertainFiles.map(d => ({
        path: d.path,
        targetDir: unsortedDir
    }));

    // 更新归档进度
    const total = movedUncertainFiles.length;
    for (let i = 0; i < movedUncertainFiles.length; i++) {
        this.statusBarItems.archive?.setText(`移至待整理: ${i + 1}/${total}`);
        await this.handleManualArchive([movedUncertainFiles[i]]);
    }

    // 更新受影响的文件夹摘要
    const movedFilesForUpdate = movedUncertainFiles.map(f => ({
        from: f.path,
        to: `${f.targetDir}/${f.path.split('/').pop()}`
    }));
    await this.summarizerService.updateFolderSummariesForMovedFiles(movedFilesForUpdate);

    this.statusBarItems.archive?.setText(`${total} 个文件已移至待整理`);
    setTimeout(() => {
        this.statusBarItems.archive?.setText('归档');
    }, 3000);
}
```

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 3: 提交更改**

```bash
git add src/main.ts
git commit -m "refactor: auto-move uncertain files to unsorted directory, remove modal"
```

---

## Task 2: 移除 ArchiveModal 导入（如果不再使用）

**Files:**
- Modify: `src/main.ts:1-15` (检查并移除 ArchiveModal 导入)

**Step 1: 检查 ArchiveModal 是否在其他地方使用**

在整个项目中搜索 `ArchiveModal` 的使用位置：
- 如果只在 `executeArchive` 中使用，可以移除导入
- 如果在其他地方使用，保留导入

**Step 2: 移除未使用的导入**

如果 `ArchiveModal` 只在 `executeArchive` 中使用，移除导入：

找到导入行：
```typescript
import { ArchiveModal } from './ui/modals/archiveModal';
```

删除此行。

**Step 3: 验证编译**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 4: 提交更改**

```bash
git add src/main.ts
git commit -m "refactor: remove unused ArchiveModal import"
```

---

## Task 3: 验证待整理目录文件重试机制

**Files:**
- Verify: `src/main.ts:220-227` (确认待整理目录文件已包含在归档流程中)

**Step 1: 确认待整理目录文件被扫描**

检查 `executeArchive` 方法中是否已包含待整理目录的文件扫描：

```typescript
// 扫描待整理目录的笔记
const unsortedDir = this.pathManager.unsortedDir;
const unsortedFiles = files.filter(f => {
    return f.path.startsWith(unsortedDir + '/');
});

// 合并根目录和待整理目录的笔记
const filesToClassify = [...rootFiles, ...unsortedFiles];
```

此逻辑应已存在，确保正确。

**Step 2: 验证编译**

Run: `npm run build`
Expected: SUCCESS

---

## Task 4: 测试和验证

**Step 1: 编译并安装插件**

Run:
```bash
npm run build
cp -f main.js "/Users/liuhao/Library/Mobile Documents/com~apple~CloudDocs/Notes/.obsidian/plugins/ai-note/"
```

**Step 2: 在 Obsidian 中测试**

1. 打开 Obsidian，重新加载 AI Note 插件
2. 在根目录创建一些测试笔记
3. 执行归档命令
4. 验证：
   - 高置信度文件自动归档到对应文件夹
   - 不确定文件自动移至"待整理"目录
   - 无 Modal 弹窗出现
   - Status Bar 正确显示进度

**Step 3: 测试重试机制**

1. 再次执行归档命令
2. 验证待整理目录中的文件被重新扫描和分类
3. 如果分类结果更准确，文件应从待整理目录移出

**Step 4: 提交最终更改**

```bash
git add .
git commit -m "test: verify auto-move uncertain files feature"
```

---

## 验收标准

完成所有任务后：

1. ✅ 不确定文件自动移至待整理目录
2. ✅ 无 Modal 弹窗出现
3. ✅ Status Bar 显示"移至待整理: X/Y"进度
4. ✅ 完成后显示"X 个文件已移至待整理"
5. ✅ 待整理目录文件在下次归档时被重新分类
6. ✅ 编译无错误
7. ✅ 功能测试通过

---

## 技术说明

### 待整理目录重试机制

待整理目录（`unsortedDir`）的文件会在每次归档时被包含在分类流程中：

1. **首次归档**：不确定文件 → 待整理目录
2. **再次归档**：待整理目录文件 + 根目录文件 → 一起分类
3. **结果**：如果 AI 能更准确分类，文件从待整理移出

### Status Bar 进度显示

| 操作类型 | 状态显示 |
|---------|---------|
| 高置信度归档 | `归档中: X/Y` |
| 不确定文件移动 | `移至待整理: X/Y` |
| 完成状态 | `归档完成: X 个文件` 或 `X 个文件已移至待整理` |

### 文件修改汇总

| 文件 | 修改内容 |
|------|---------|
| `src/main.ts` | 替换 ArchiveModal 为直接移动到待整理目录 |
| `src/main.ts` | 可能移除 ArchiveModal 导入 |

---

## 回滚方案

如果出现问题：

```bash
git reset --hard HEAD~1  # 回退一个版本
```

或查看提交历史：

```bash
git log --oneline -5
```
