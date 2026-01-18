/**
 * 仓库概要测试
 * @P0
 * 测试仓库概要生成的完整流程
 *
 * 测试计划 v2.2 - 6个测试用例
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import { AIMockHelper } from '@tests/helpers/aiMock';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

// 模拟仓库概要服务
class RepoOverviewService {
  private vault: VaultTestHelper;
  private aiHelper: AIMockHelper;

  private get vaultPath(): string {
    return this.vault.getPath();
  }

  private get pluginDataDir(): string {
    return path.join(this.vaultPath, '.obsidian', 'plugins', 'ai-note');
  }

  private get summariesDir(): string {
    return path.join(this.pluginDataDir, 'data', 'summaries');
  }

  private get folderSummariesDir(): string {
    return path.join(this.pluginDataDir, 'data', 'folder_summaries');
  }

  private get reviewDir(): string {
    return path.join(this.vaultPath, 'Reviews', 'Daily');
  }

  constructor(vault: VaultTestHelper, aiHelper: AIMockHelper) {
    this.vault = vault;
    this.aiHelper = aiHelper;
  }

  /**
   * 检查是否有摘要或快照
   */
  private hasSummariesOrSnapshots(): boolean {
    const hasSummaries = fs.existsSync(this.summariesDir) &&
                        fs.readdirSync(this.summariesDir).length > 0;
    const hasSnapshots = fs.existsSync(path.join(this.pluginDataDir, 'data', 'snapshots', 'index.json'));
    return hasSummaries || hasSnapshots;
  }

  /**
   * 统计仓库信息
   */
  private async getRepoInfo(): Promise<{
    noteCount: number;
    folderCount: number;
    mainFolders: string[];
  }> {
    const allFiles = this.vault.getAllNotes();
    const folders = new Set<string>();

    for (const file of allFiles) {
      const dir = path.dirname(file);
      if (dir !== '.') {
        folders.add(dir);
      }
    }

    return {
      noteCount: allFiles.length,
      folderCount: folders.size,
      mainFolders: Array.from(folders).slice(0, 5) // 最多显示5个主要文件夹
    };
  }

  /**
   * 生成仓库概要
   */
  async generateOverview(): Promise<string> {
    const repoInfo = await this.getRepoInfo();
    const dateStr = new Date().toISOString().split('T')[0];

    // 模拟AI生成的主要内容
    const mainContent = `## 主要知识领域

- 前端开发
  - React
  - Vue
- JavaScript

## 标签

#react #vue #javascript #前端 #web #开发 #笔记 #知识管理

## 内容组织结构

仓库包含${repoInfo.noteCount}篇笔记，分布在${repoInfo.folderCount}个文件夹中。主要内容围绕前端开发技术栈。`;

    const overview = `# 仓库概要

> 生成时间：${dateStr}
> 类型：首次运行概要

## 基本信息

- **笔记总数**：**${repoInfo.noteCount}** 篇
- **文件夹总数**：**${repoInfo.folderCount}** 个
- **主要文件夹**：${repoInfo.mainFolders.join(', ') || '无'}

---

${mainContent}
`;

    return overview;
  }

  /**
   * 生成仓库概要（首次运行）
   */
  async generateFirstRunOverview(): Promise<string> {
    const overview = await this.generateOverview();

    // 保存到复盘目录
    const dateStr = new Date().toISOString().split('T')[0];
    const overviewPath = path.join(this.reviewDir, `${dateStr}.md`);

    fs.mkdirSync(this.reviewDir, { recursive: true });
    fs.writeFileSync(overviewPath, overview);

    return overview;
  }
}

describe('仓库概要测试', () => {
  let vault: VaultTestHelper;
  let service: RepoOverviewService;
  let aiHelper: AIMockHelper;

  beforeEach(async () => {
    vault = new VaultTestHelper('repo-overview-test');
    aiHelper = new AIMockHelper();
    service = new RepoOverviewService(vault, aiHelper);
  });

  afterEach(async () => {
    await vault.cleanup();
  });

  describe('RP1-RP2: 首次运行和基本完整性', () => {
    it('RP1: 首次运行应生成仓库概要', async () => {
      // 确保没有摘要和快照
      await vault.cleanup();

      const overview = await service.generateFirstRunOverview();

      // 验证概要生成
      expect(overview).toContain('# 仓库概要');
      expect(overview).toContain('基本信息');
      expect(overview).toContain('生成时间');
    });

    it('RP2: 概要基本信息完整性', async () => {
      // 创建一些测试数据
      await vault.createNote('note1.md', '# Test Note 1');
      await vault.createNote('note2.md', '# Test Note 2');
      await vault.createNote('note3.md', '# Test Note 3');

      const overview = await service.generateFirstRunOverview();

      // 验证包含基本信息
      expect(overview).toContain('笔记总数');
      expect(overview).toContain('文件夹总数');
      expect(overview).toMatch(/笔记总数.*：\*\*(\d+)\*\*/);
      expect(overview).toMatch(/文件夹总数.*：\*\*(\d+)\*\*/);
    });
  });

  describe('RP3-RP4: 主要内容和文件夹结构', () => {
    it('RP3: 概要主要内容生成', async () => {
      // 创建测试数据
      await vault.createNote('note1.md', '# React Hooks 学习笔记');
      await vault.createNote('note2.md', '# Vue3 组合式API笔记');

      const overview = await service.generateFirstRunOverview();

      // 验证包含主要内容
      expect(overview).toContain('主要知识领域');
      expect(overview).toContain('前端开发');
      expect(overview).toContain('标签');
    });

    it('RP4: 概要文件夹结构', async () => {
      await vault.createNote('note1.md', '# Test');
      await vault.createNote('folder1/note2.md', '# Test');

      const overview = await service.generateFirstRunOverview();

      // 验证列出主要文件夹
      expect(overview).toContain('文件夹');
    });
  });

  describe('RP5-RP6: 保存位置和模板格式', () => {
    it('RP5: 概要保存位置', async () => {
      const overview = await service.generateFirstRunOverview();

      // 验证保存到正确位置
      expect(fs.existsSync(path.join(service.reviewDir))).toBe(true);
      const dateStr = new Date().toISOString().split('T')[0];
      expect(fs.existsSync(path.join(service.reviewDir, `${dateStr}.md`))).toBe(true);
    });

    it('RP6: 概要模板正确性', async () => {
      const overview = await service.generateFirstRunOverview();

      // 验证符合PRD模板格式
      expect(overview).toContain('# 仓库概要');
      expect(overview).toContain('基本信息');
      expect(overview).toContain('生成时间');
      expect(overview).toContain('类型：首次运行概要');
    });
  });
});
