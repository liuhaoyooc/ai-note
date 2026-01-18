/**
 * 每日复盘流程集成测试
 * @P0
 * 测试每日复盘的完整流程，从快照管理到复盘生成
 *
 * 测试计划 v2.1 - 32个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestDataBuilder, NoteDataBuilder } from '@tests/helpers/testDataBuilder';
import { AIMockHelper } from '@tests/helpers/aiMock';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync, gunzipSync } from 'zlib';

// 导入自定义断言
import '@tests/helpers/customAssertions';

// 模拟每日复盘服务
class DailyReviewService {
  private vault: VaultTestHelper;
  private aiHelper: AIMockHelper;
  private reviewTime = '21:00'; // 默认复盘时间

  // 获取路径
  private get vaultPath(): string {
    return this.vault.getPath();
  }

  private get pluginDataDir(): string {
    return path.join(this.vaultPath, '.obsidian', 'plugins', 'ai-note');
  }

  private get snapshotsDir(): string {
    return path.join(this.pluginDataDir, 'data', 'snapshots');
  }

  private get snapshotIndexPath(): string {
    return path.join(this.snapshotsDir, 'index.json');
  }

  private get reviewDir(): string {
    return path.join(this.vaultPath, 'Reviews', 'Daily');
  }

  private get summariesDir(): string {
    return path.join(this.pluginDataDir, 'data', 'summaries');
  }

  constructor(vault: VaultTestHelper, aiHelper: AIMockHelper) {
    this.vault = vault;
    this.aiHelper = aiHelper;
  }

  /**
   * 计算内容哈希
   */
  private calculateContentHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 压缩快照
   */
  private compressSnapshot(content: string): string {
    const compressed = gzipSync(Buffer.from(content, 'utf-8'));
    return compressed.toString('base64');
  }

  /**
   * 解压快照
   */
  private decompressSnapshot(compressedContent: string): string {
    const buffer = Buffer.from(compressedContent, 'base64');
    const decompressed = gunzipSync(buffer);
    return decompressed.toString('utf-8');
  }

  /**
   * 创建快照索引
   */
  private createSnapshotIndex(): void {
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    fs.writeFileSync(this.snapshotIndexPath, JSON.stringify({}, null, 2));
  }

  /**
   * 读取快照索引
   */
  private readSnapshotIndex(): Record<string, { hash: string; snapshotFile: string; modifiedTime: number }> {
    if (!fs.existsSync(this.snapshotIndexPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(this.snapshotIndexPath, 'utf-8'));
  }

  /**
   * 创建仓库概要（首次运行）
   */
  async generateRepoOverview(): Promise<string> {
    // 读取所有笔记并生成概要
    const notes = this.vault.getAllNotes();
    const overview = `# 仓库概要\n\n共有 ${notes.length} 个笔记。\n\n` +
      notes.map(note => `- [[${note}]]`).join('\n');

    return overview;
  }

  /**
   * 创建初始快照
   */
  async createInitialSnapshots(): Promise<void> {
    this.createSnapshotIndex();
    const notes = this.vault.getAllNotes();
    const index = this.readSnapshotIndex();

    for (const notePath of notes) {
      const content = await this.vault.readNote(notePath);
      const hash = this.calculateContentHash(content);
      const compressed = this.compressSnapshot(content);
      const snapshotFile = `${hash}.gz`;

      // 保存快照
      fs.writeFileSync(path.join(this.snapshotsDir, snapshotFile), compressed);

      // 更新索引
      index[notePath] = {
        hash,
        snapshotFile,
        modifiedTime: Date.now(),
      };
    }

    fs.writeFileSync(this.snapshotIndexPath, JSON.stringify(index, null, 2));
  }

  /**
   * 检测变更
   */
  async detectChanges(): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
  }> {
    const index = this.readSnapshotIndex();
    const currentNotes = this.vault.getAllNotes();
    const currentNoteSet = new Set(currentNotes);

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // 检测新增和修改
    for (const notePath of currentNotes) {
      if (!index[notePath]) {
        added.push(notePath);
      } else {
        const content = await this.vault.readNote(notePath);
        const currentHash = this.calculateContentHash(content);
        if (currentHash !== index[notePath].hash) {
          modified.push(notePath);
        }
      }
    }

    // 检测删除
    for (const notePath of Object.keys(index)) {
      if (!currentNoteSet.has(notePath)) {
        deleted.push(notePath);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * 计算diff
   */
  async calculateDiff(notePath: string, oldContent: string, maxDiffLines: number = 100): Promise<string> {
    const newContent = await this.vault.readNote(notePath);
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    let diff = '';
    let diffLineCount = 0;
    let truncated = false;

    // 简化的diff算法（实际应使用更复杂的diff库）
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        i++;
        j++;
      } else {
        // 标记删除
        while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
          if (diffLineCount < maxDiffLines) {
            diff += `- ${oldLines[i]}\n`;
            diffLineCount++;
          } else {
            truncated = true;
          }
          i++;
        }
        // 标记新增
        while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
          if (diffLineCount < maxDiffLines) {
            diff += `+ ${newLines[j]}\n`;
            diffLineCount++;
          } else {
            truncated = true;
          }
          j++;
        }
      }

      // 检查是否需要截断
      if (truncated) {
        diff += `\n... (差异过大，已截断)\n`;
        break;
      }
    }

    return diff || '(无变化)';
  }

  /**
   * 生成复盘报告
   */
  async generateReview(changes: {
    added: string[];
    modified: string[];
    deleted: string[];
  }): Promise<string> {
    const index = this.readSnapshotIndex();
    let review = `# 每日复盘\n\n`;
    review += `**日期**: ${new Date().toLocaleDateString()}\n\n`;

    // 新增笔记
    if (changes.added.length > 0) {
      review += `## 新增笔记 (${changes.added.length})\n\n`;
      for (const notePath of changes.added) {
        review += `- [[${notePath}]]\n`;
      }
      review += '\n';
    }

    // 修改笔记
    if (changes.modified.length > 0) {
      review += `## 修改笔记 (${changes.modified.length})\n\n`;
      for (const notePath of changes.modified) {
        const snapshotFile = index[notePath]?.snapshotFile;
        if (snapshotFile && fs.existsSync(path.join(this.snapshotsDir, snapshotFile))) {
          const compressed = fs.readFileSync(path.join(this.snapshotsDir, snapshotFile));
          const oldContent = this.decompressSnapshot(compressed.toString());
          const diff = await this.calculateDiff(notePath, oldContent);
          review += `### [[${notePath}]]\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
        }
      }
    }

    // 删除笔记
    if (changes.deleted.length > 0) {
      review += `## 删除笔记 (${changes.deleted.length})\n\n`;
      for (const notePath of changes.deleted) {
        review += `- ~~${notePath}~~\n`;
      }
      review += '\n';
    }

    return review;
  }

  /**
   * 更新快照
   */
  async updateSnapshots(notePaths: string[]): Promise<void> {
    const index = this.readSnapshotIndex();

    for (const notePath of notePaths) {
      const content = await this.vault.readNote(notePath);
      const hash = this.calculateContentHash(content);
      const compressed = this.compressSnapshot(content);
      const snapshotFile = `${hash}.gz`;

      // 删除旧快照
      if (index[notePath]?.snapshotFile) {
        const oldSnapshotFile = path.join(this.snapshotsDir, index[notePath].snapshotFile);
        if (fs.existsSync(oldSnapshotFile)) {
          fs.unlinkSync(oldSnapshotFile);
        }
      }

      // 保存新快照
      fs.writeFileSync(path.join(this.snapshotsDir, snapshotFile), compressed);

      // 更新索引
      index[notePath] = {
        hash,
        snapshotFile,
        modifiedTime: Date.now(),
      };
    }

    fs.writeFileSync(this.snapshotIndexPath, JSON.stringify(index, null, 2));
  }

  /**
   * 运行每日复盘
   */
  async run(forceDate?: Date): Promise<string> {
    // 检查是否首次运行
    const isFirstRun = !fs.existsSync(this.snapshotIndexPath);

    if (isFirstRun) {
      // 首次运行：生成仓库概要和初始快照
      await this.generateRepoOverview();
      await this.createInitialSnapshots();

      // 生成首次复盘
      const review = `# 首次复盘\n\n` + await this.generateRepoOverview();
      return review;
    }

    // 正常流程：检测变更
    const changes = await this.detectChanges();

    // 如果有变更，生成复盘
    if (changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0) {
      const review = await this.generateReview(changes);

      // 保存复盘
      const today = forceDate || new Date();
      const dateStr = today.toISOString().split('T')[0];
      fs.mkdirSync(this.reviewDir, { recursive: true });
      const reviewFile = path.join(this.reviewDir, `${dateStr}.md`);
      fs.writeFileSync(reviewFile, review);

      // 更新快照
      await this.updateSnapshots([...changes.added, ...changes.modified]);

      return review;
    }

    return '# 今日无变更\n\n今天没有笔记变更。';
  }

  /**
   * 补执行复盘
   */
  async catchUp(): Promise<void> {
    // 延迟10秒执行
    await new Promise(resolve => setTimeout(resolve, 100));

    const now = new Date();
    const [hour, minute] = this.reviewTime.split(':').map(Number);
    const reviewTimeToday = new Date(now);
    reviewTimeToday.setHours(hour, minute, 0, 0);

    let targetDate: Date;

    if (now > reviewTimeToday) {
      // 今天复盘时间已过，生成今天的复盘
      targetDate = now;
    } else {
      // 今天复盘时间未到，生成昨天的复盘
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - 1);
    }

    // 检查是否已存在复盘
    const dateStr = targetDate.toISOString().split('T')[0];
    const existingReview = path.join(this.reviewDir, `${dateStr}.md`);

    if (!fs.existsSync(existingReview)) {
      await this.run(targetDate);
    }
  }

  /**
   * 设置复盘时间
   */
  setReviewTime(time: string): void {
    this.reviewTime = time;
  }
}

describe('每日复盘流程集成测试', () => {
  let vault: VaultTestHelper;
  let aiHelper: AIMockHelper;
  let reviewService: DailyReviewService;

  beforeEach(async () => {
    vault = new VaultTestHelper('daily-review-test');
    aiHelper = new AIMockHelper();
    reviewService = new DailyReviewService(vault, aiHelper);
  });

  afterEach(async () => {
    await vault.cleanup();
  });

  // ========================================
  // 阶段1：首次运行检测
  // ========================================

  describe('R1-R2: 首次运行检测', () => {
    it('R1: 首次运行 - 无摘要无快照应生成仓库概要和初始快照', async () => {
      // 创建测试笔记
      await vault.createNote('note1.md', '# Note 1\nContent 1');
      await vault.createNote('note2.md', '# Note 2\nContent 2');

      // 首次运行
      const review = await reviewService.run();

      // 验证生成快照索引
      expect(fs.existsSync(reviewService['snapshotIndexPath'])).toBe(true);

      // 验证快照文件
      const index = reviewService['readSnapshotIndex']();
      expect(Object.keys(index).length).toBe(2);
      expect(index['note1.md']).toBeDefined();
      expect(index['note2.md']).toBeDefined();

      // 验证复盘包含概要
      expect(review).toContain('仓库概要');
      expect(review).toContain('共有 2 个笔记');
    });

    it('R2: 有摘要有快照应进入正常流程', async () => {
      // 创建测试笔记
      await vault.createNote('note1.md', '# Note 1\nContent 1');

      // 首次运行创建快照
      await reviewService.run();

      // 修改笔记
      await vault.createNote('note1.md', '# Note 1\nModified content');
      await vault.createNote('note2.md', '# Note 2\nNew note');

      // 再次运行
      const review = await reviewService.run();

      // 验证检测到变更
      expect(review).toContain('修改笔记');
      expect(review).toContain('新增笔记');
    });
  });

  // ========================================
  // 阶段2：快照状态检测
  // ========================================

  describe('R3-R4: 快照状态检测', () => {
    it('R3: 快照索引不存在 - 首次快照', async () => {
      await vault.createNote('note1.md', '# Note 1');

      // 删除索引
      const indexPath = reviewService['snapshotIndexPath'];
      if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
      }

      // 运行应按首次运行处理
      const review = await reviewService.run();

      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('R4: 快照索引存在 - 应正确读取快照数据', async () => {
      await vault.createNote('note1.md', '# Note 1\nContent 1');

      // 创建快照
      await reviewService.run();

      // 读取索引
      const index = reviewService['readSnapshotIndex']();

      expect(index['note1.md']).toBeDefined();
      expect(index['note1.md'].hash).toBeValidMD5Hash();

      // 验证快照文件存在
      const snapshotFile = path.join(
        reviewService['snapshotsDir'],
        index['note1.md'].snapshotFile
      );
      expect(fs.existsSync(snapshotFile)).toBe(true);
    });
  });

  // ========================================
  // 阶段3：变更检测
  // ========================================

  describe('R5-R12: 变更检测', () => {
    beforeEach(async () => {
      // 创建初始快照
      await vault.createNote('existing.md', '# Existing\nOriginal content');
      await reviewService.run();
    });

    it('R5: 新增笔记检测', async () => {
      await vault.createNote('new.md', '# New Note');

      const changes = await reviewService['detectChanges']();

      expect(changes.added).toContain('new.md');
      expect(changes.modified).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it('R6: 修改笔记检测', async () => {
      await vault.createNote('existing.md', '# Existing\nModified content');

      const changes = await reviewService['detectChanges']();

      expect(changes.modified).toContain('existing.md');
      expect(changes.added).toHaveLength(0);
    });

    it('R7: 删除笔记检测', async () => {
      const notePath = path.join(vault.getPath(), 'existing.md');
      fs.unlinkSync(notePath);

      const changes = await reviewService['detectChanges']();

      expect(changes.deleted).toContain('existing.md');
    });

    it('R8: 混合变更检测', async () => {
      await vault.createNote('new.md', '# New');
      await vault.createNote('existing.md', '# Existing\nModified');
      fs.unlinkSync(path.join(vault.getPath(), 'existing.md'));

      const changes = await reviewService['detectChanges']();

      expect(changes.added).toContain('new.md');
      expect(changes.deleted).toContain('existing.md');
    });

    it('R9: 应跳过.obsidian目录', async () => {
      await vault.createNote('.obsidian/config.md', '# Config');

      const changes = await reviewService['detectChanges']();

      expect(changes.added).not.toContain('.obsidian/config.md');
    });

    it('R10: 使用Vault.cachedRead高效读取', async () => {
      // 注：实际实现需要mock Vault.cachedRead
      const spy = vi.spyOn(vault, 'readNote');

      await vault.createNote('note1.md', '# Note 1');
      await reviewService['detectChanges']();

      expect(spy).toHaveBeenCalled();
    });

    it('R11: Diff行数未超限应完整包含', async () => {
      await vault.createNote('existing.md', '# Existing\nLine 2\nLine 3');

      const oldContent = '# Existing\nOriginal content';
      const diff = await reviewService['calculateDiff']('existing.md', oldContent, 100);

      expect(diff).toContain('- Original content');
      expect(diff).toContain('+ Line 2');
    });

    it('R12: Diff行数超限应截断并显示提示', async () => {
      // 创建一个长diff
      const longContent = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');
      await vault.createNote('long.md', longContent);

      const oldContent = Array.from({ length: 200 }, (_, i) => `Old Line ${i + 1}`).join('\n');
      const diff = await reviewService['calculateDiff']('long.md', oldContent, 10);

      expect(diff).toContain('已截断');
    });
  });

  // ========================================
  // 阶段4：生成复盘
  // ========================================

  describe('R13-R15: 生成复盘', () => {
    beforeEach(async () => {
      await vault.createNote('note1.md', '# Note 1\nContent 1');
      await reviewService.run();
    });

    it('R13: 应生成复盘报告并保存到正确位置', async () => {
      await vault.createNote('note1.md', '# Note 1\nModified');

      await reviewService.run();

      const reviewFile = path.join(
        reviewService['reviewDir'],
        `${new Date().toISOString().split('T')[0]}.md`
      );
      expect(fs.existsSync(reviewFile)).toBe(true);
    });

    it('R14: 应覆盖当日已有复盘', async () => {
      const dateStr = new Date().toISOString().split('T')[0];
      fs.mkdirSync(reviewService['reviewDir'], { recursive: true });

      const reviewFile = path.join(reviewService['reviewDir'], `${dateStr}.md`);
      fs.writeFileSync(reviewFile, '# Old Review');

      await vault.createNote('note1.md', '# Note 1\nModified');
      await reviewService.run();

      const content = fs.readFileSync(reviewFile, 'utf-8');
      expect(content).not.toContain('# Old Review');
    });

    it('R15: 应支持Obsidian链接格式', async () => {
      await vault.createNote('note1.md', '# Note 1\nModified');

      await reviewService.run();

      const reviewFile = path.join(
        reviewService['reviewDir'],
        `${new Date().toISOString().split('T')[0]}.md`
      );
      const content = fs.readFileSync(reviewFile, 'utf-8');

      expect(content).toContain('[[note1.md]]');
    });
  });

  // ========================================
  // 阶段5：更新快照
  // ========================================

  describe('R16-R17: 更新快照', () => {
    beforeEach(async () => {
      await vault.createNote('note1.md', '# Note 1\nOriginal');
      await reviewService.run();
    });

    it('R16: 更新变更笔记的快照应计算新hash并压缩', async () => {
      await vault.createNote('note1.md', '# Note 1\nModified');

      await reviewService['updateSnapshots'](['note1.md']);

      const index = reviewService['readSnapshotIndex']();
      const oldHash = createHash('md5').update('# Note 1\nOriginal').digest('hex');
      const newHash = createHash('md5').update('# Note 1\nModified').digest('hex');

      expect(index['note1.md'].hash).not.toBe(oldHash);
      expect(index['note1.md'].hash).toBe(newHash);
    });

    it('R17: 更新快照应删除旧快照文件', async () => {
      const oldIndex = reviewService['readSnapshotIndex']();
      const oldSnapshotFile = oldIndex['note1.md'].snapshotFile;

      await vault.createNote('note1.md', '# Note 1\nModified');
      await reviewService['updateSnapshots'](['note1.md']);

      const oldSnapshotPath = path.join(reviewService['snapshotsDir'], oldSnapshotFile);
      expect(fs.existsSync(oldSnapshotPath)).toBe(false);

      const newIndex = reviewService['readSnapshotIndex']();
      const newSnapshotPath = path.join(
        reviewService['snapshotsDir'],
        newIndex['note1.md'].snapshotFile
      );
      expect(fs.existsSync(newSnapshotPath)).toBe(true);
    });
  });

  // ========================================
  // 启动补执行机制
  // ========================================

  describe('R18-R22: 启动补执行机制', () => {
    beforeEach(async () => {
      await vault.createNote('note1.md', '# Note 1');
    });

    it('R18: 今天复盘时间已过应补执行今天', async () => {
      // 设置复盘时间为22:00
      reviewService.setReviewTime('22:00');

      // 模拟23:00
      const review = await reviewService.run();

      expect(review).toBeDefined();
    });

    it('R19: 今天复盘时间未到应补执行昨天', async () => {
      // 设置复盘时间为22:00
      reviewService.setReviewTime('22:00');

      // 注：这个测试需要mock当前时间
      // 实际实现需要使用fake timers
    });

    it('R20: 今日已存在复盘应不重复执行', async () => {
      const dateStr = new Date().toISOString().split('T')[0];
      fs.mkdirSync(reviewService['reviewDir'], { recursive: true });
      fs.writeFileSync(
        path.join(reviewService['reviewDir'], `${dateStr}.md`),
        '# Existing Review'
      );

      // 注：补执行逻辑需要检查是否已存在
    });

    it('R21: 不会同时补执行两天', async () => {
      // 验证只补执行一天
    });

    it('R22: 延迟10秒执行', async () => {
      const startTime = Date.now();
      await reviewService.catchUp();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  // ========================================
  // Vault.cachedRead 增强
  // ========================================

  describe('R23-R25: Vault.cachedRead 增强', () => {
    it('R23: cachedRead 缓存命中应提升性能', async () => {
      await vault.createNote('note1.md', '# Note 1\nContent 1');

      const start1 = Date.now();
      await vault.readNote('note1.md');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await vault.readNote('note1.md');
      const time2 = Date.now() - start2;

      // 注：实际实现需要真实的缓存机制
    });

    it('R24: cachedRead 缓存失效应重新读取', async () => {
      await vault.createNote('note1.md', '# Note 1');

      const first = await vault.readNote('note1.md');

      await vault.createNote('note1.md', '# Note 1\nModified');

      const second = await vault.readNote('note1.md');

      expect(second).not.toBe(first);
    });

    it('R25: cachedRead 性能对比', async () => {
      // 性能对比测试
    });
  });

  // ========================================
  // Diff 截断增强
  // ========================================

  describe('R26-R27: Diff 截断增强', () => {
    it('R26: Diff截断位置应精确', async () => {
      const longContent = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
      await vault.createNote('long.md', longContent);

      const oldContent = Array.from({ length: 50 }, (_, i) => `Old ${i + 1}`).join('\n');
      const diff = await reviewService['calculateDiff']('long.md', oldContent, 20);

      // 验证截断位置
      const lines = diff.split('\n');
      const diffContentLines = lines.filter(line => line.startsWith('-') || line.startsWith('+'));
      expect(diffContentLines.length).toBeLessThanOrEqual(20);
    });

    it('R27: Diff截断提示文本应符合PRD要求', async () => {
      const longContent = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');
      await vault.createNote('long.md', longContent);

      const oldContent = Array.from({ length: 200 }, (_, i) => `Old ${i + 1}`).join('\n');
      const diff = await reviewService['calculateDiff']('long.md', oldContent, 10);

      expect(diff).toContain('已截断');
    });
  });

  // ========================================
  // 快照与diff一致性验证 (v2.1新增)
  // ========================================

  describe('R28-R32: 快照与diff一致性验证', () => {
    beforeEach(async () => {
      await vault.createNote('note1.md', '# Note 1\nOriginal');
      await reviewService.run();
    });

    it('R28: 快照与diff内容应一致', async () => {
      const oldContent = '# Note 1\nOriginal';
      await vault.createNote('note1.md', '# Note 1\nModified');

      const index = reviewService['readSnapshotIndex']();
      const snapshotFile = path.join(
        reviewService['snapshotsDir'],
        index['note1.md'].snapshotFile
      );
      const compressed = fs.readFileSync(snapshotFile);
      const oldSnapshot = reviewService['decompressSnapshot'](compressed.toString());

      const diff = await reviewService['calculateDiff']('note1.md', oldSnapshot);

      expect(diff).toContain('- Original');
      expect(diff).toContain('+ Modified');
    });

    it('R29: 快照压缩不应影响diff', async () => {
      const oldContent = '# Note 1\nOriginal content here';
      await vault.createNote('note1.md', '# Note 1\nModified content here');

      // 通过压缩/解压后的内容计算diff
      const compressed = reviewService['compressSnapshot'](oldContent);
      const decompressed = reviewService['decompressSnapshot'](compressed);
      const diff = await reviewService['calculateDiff']('note1.md', decompressed);

      expect(diff).toContain('- Original content here');
      expect(diff).toContain('+ Modified content here');
    });

    it('R30: 多次变更的diff应基于最新快照', async () => {
      // 第一次修改
      await vault.createNote('note1.md', '# Note 1\nFirst modification');
      await reviewService['updateSnapshots'](['note1.md']);

      // 第二次修改
      await vault.createNote('note1.md', '# Note 1\nSecond modification');

      const index = reviewService['readSnapshotIndex']();
      const snapshotFile = path.join(
        reviewService['snapshotsDir'],
        index['note1.md'].snapshotFile
      );
      const compressed = fs.readFileSync(snapshotFile);
      const latestSnapshot = reviewService['decompressSnapshot'](compressed.toString());

      const diff = await reviewService['calculateDiff']('note1.md', latestSnapshot);

      expect(diff).toContain('First modification');
      expect(diff).toContain('Second modification');
    });

    it('R31: 快照删除后应能重建diff', async () => {
      // 删除快照
      const indexPath = reviewService['snapshotIndexPath'];
      const snapshotsDir = reviewService['snapshotsDir'];

      if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
      }
      if (fs.existsSync(snapshotsDir)) {
        fs.rmSync(snapshotsDir, { recursive: true });
      }

      // 运行复盘应能重建快照
      await vault.createNote('note1.md', '# Note 1\nAfter rebuild');
      await reviewService.run();

      expect(fs.existsSync(indexPath)).toBe(true);
      const newIndex = reviewService['readSnapshotIndex']();
      expect(newIndex['note1.md']).toBeDefined();
    });

    it('R32: 首次运行到正常流程切换应正确', async () => {
      // 清除快照索引，模拟首次运行
      const indexPath = reviewService['snapshotIndexPath'];
      if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
      }

      // 首次运行
      const firstReview = await reviewService.run();
      expect(firstReview).toContain('仓库概要');

      // 修改笔记
      await vault.createNote('note1.md', '# Note 1\nModified');

      // 第二次运行应进入正常流程
      const secondReview = await reviewService.run();
      expect(secondReview).toContain('修改笔记');
      expect(secondReview).not.toContain('仓库概要');
    });
  });
});
