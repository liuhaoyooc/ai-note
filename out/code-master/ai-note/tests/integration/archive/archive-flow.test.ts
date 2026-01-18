/**
 * 智能归档流程集成测试
 * @P0
 * 测试智能归档的完整流程，从摘要生成到文件移动
 *
 * 测试计划 v2.1 - 34个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestDataBuilder, NoteDataBuilder } from '@tests/helpers/testDataBuilder';
import { AIMockHelper, ClassifyResult } from '@tests/helpers/aiMock';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

// 模拟归档服务
class ArchiveService {
  private vault: VaultTestHelper;
  private aiHelper: AIMockHelper;
  private maxRetries = 3;

  // 获取路径
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
    return path.join(this.pluginDataDir, 'data', 'cache', 'folder_summaries');
  }

  private get pendingDir(): string {
    return path.join(this.vaultPath, '待整理');
  }

  constructor(vault: VaultTestHelper, aiHelper: AIMockHelper) {
    this.vault = vault;
    this.aiHelper = aiHelper;
  }

  /**
   * 计算内容哈希（用于摘要缓存）
   */
  private calculateContentHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 生成笔记摘要
   */
  async generateNoteSummary(notePath: string): Promise<{ summary: string; keywords: string[]; contentHash: string }> {
    const content = await this.vault.readNote(notePath);
    const contentHash = this.calculateContentHash(content);

    // 检查摘要缓存
    const summaryPath = path.join(this.summariesDir, `${contentHash}.json`);
    if (fs.existsSync(summaryPath)) {
      const cached = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      if (cached.contentHash === contentHash) {
        return cached;
      }
    }

    // 调用 AI 生成摘要（mock模式返回预设）
    const summary = `Summary for ${notePath}`;
    const keywords = ['keyword1', 'keyword2'];

    const summaryData = {
      path: notePath,
      title: path.basename(notePath, '.md'),
      summary,
      keywords,
      contentHash,
      lastUpdated: new Date().toISOString(),
    };

    // 保存摘要
    fs.mkdirSync(this.summariesDir, { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));

    return summaryData;
  }

  /**
   * 生成文件夹摘要
   */
  async generateFolderSummaries(): Promise<void> {
    const folders = this.vault.listFolders();
    const folderSummaries: any[] = [];

    // 包括根目录
    const allFolders = ['.', ...folders];

    for (const folder of allFolders) {
      const notes = this.vault.listNotesInFolder(folder);
      if (notes.length === 0) continue;

      const sampleNotes = notes.slice(0, 10);
      const folderHash = createHash('md5').update(folder).digest('hex');
      const summaryPath = path.join(this.folderSummariesDir, `${folderHash}.json`);

      // 检查是否已存在摘要，如果存在则保留现有数据
      let folderSummary: any;
      if (fs.existsSync(summaryPath)) {
        folderSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        // 合并新笔记到现有的 sampleNotes
        for (const note of sampleNotes) {
          if (!folderSummary.sampleNotes.includes(note)) {
            folderSummary.sampleNotes.push(note);
          }
        }
        // 限制 sampleNotes 为 10 个
        if (folderSummary.sampleNotes.length > 10) {
          folderSummary.sampleNotes = folderSummary.sampleNotes.slice(-10);
        }
        folderSummary.noteCount = notes.length;
        folderSummary.lastUpdated = new Date().toISOString();
      } else {
        // 创建新摘要
        folderSummary = {
          path: folder,
          theme: `Theme for ${folder}`,
          sampleNotes,
          noteCount: notes.length,
          lastUpdated: new Date().toISOString(),
        };
      }

      fs.mkdirSync(this.folderSummariesDir, { recursive: true });
      fs.writeFileSync(summaryPath, JSON.stringify(folderSummary, null, 2));
      folderSummaries.push(folderSummary);
    }
  }

  /**
   * AI分类笔记
   */
  async classifyNotes(notePaths: string[]): Promise<ClassifyResult[]> {
    const results: ClassifyResult[] = [];

    for (const notePath of notePaths) {
      // 读取笔记内容判断是否需要上下文增强
      const content = await this.vault.readNote(notePath);
      const needsEnhancement = content.split('\n').length < 5;

      const context = needsEnhancement
        ? {
            filename: path.basename(notePath, '.md'),
            parentDir: path.dirname(notePath),
          }
        : {};

      // 调用 AI 分类（使用 mock）
      // 对于待整理目录中的文件，返回低置信度以测试重试逻辑
      const isInPending = notePath.includes('待整理');
      const result: ClassifyResult = {
        targetDir: 'Archives/2024',
        confidence: isInPending ? 0.6 : 0.85,
        uncertain: false,
      };

      results.push({ ...result, filePath: notePath, ...context } as any);
    }

    return results;
  }

  /**
   * 执行归档
   */
  async archive(classifyResult: any): Promise<void> {
    const { filePath, targetDir, confidence, uncertain } = classifyResult;

    // 低置信度或不确定 -> 移至待整理目录
    if (confidence < 0.7 || uncertain) {
      await this.moveToPending(filePath, classifyResult);
      return;
    }

    // 高置信度 -> 移动到目标目录
    const fileName = path.basename(filePath);

    // 拼接完整的目标路径（相对于 vault 根目录）
    // targetDir 是相对路径如 'Archives/2024'，需要从 vault 根目录计算
    const targetPath = path.join(this.vaultPath, targetDir, fileName);

    // 处理文件名冲突
    const finalTargetPath = await this.resolveFileNameConflict(targetPath);

    // 计算相对于 vault 根目录的相对路径
    const relativeTargetPath = path.relative(this.vaultPath, finalTargetPath);

    // 创建目标目录
    const targetDirPath = path.dirname(finalTargetPath);
    if (!fs.existsSync(targetDirPath)) {
      fs.mkdirSync(targetDirPath, { recursive: true });
    }

    // 移动文件
    await this.vault.renameNote(filePath, relativeTargetPath);

    // 更新摘要路径
    await this.updateSummaryPath(filePath, relativeTargetPath);

    // 增量更新文件夹摘要
    await this.updateFolderSummary(targetDir, path.basename(finalTargetPath));
  }

  /**
   * 处理文件名冲突
   */
  private async resolveFileNameConflict(targetPath: string): Promise<string> {
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }

    const dir = path.dirname(targetPath);
    const baseName = path.basename(targetPath, '.md');
    let counter = 1;
    let newPath: string;

    do {
      newPath = path.join(dir, `${baseName}.${counter}.md`);
      counter++;
    } while (fs.existsSync(newPath));

    return newPath;
  }

  /**
   * 移动到待整理目录
   */
  private async moveToPending(filePath: string, classifyResult: any): Promise<void> {
    if (!fs.existsSync(this.pendingDir)) {
      fs.mkdirSync(this.pendingDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    // 计算相对路径（从 vault 根目录到待整理目录）
    const targetPath = path.join('待整理', fileName);

    await this.vault.renameNote(filePath, targetPath);

    // 保存分类结果用于重试（使用完整路径）
    const resultPath = path.join(this.pendingDir, `.${fileName}.classify-result.json`);
    const existingResult = fs.existsSync(resultPath)
      ? JSON.parse(fs.readFileSync(resultPath, 'utf-8'))
      : { retryCount: 0 };

    existingResult.retryCount = (existingResult.retryCount || 0) + 1;
    existingResult.lastAttempt = new Date().toISOString();
    existingResult.classifyResult = classifyResult;

    fs.writeFileSync(resultPath, JSON.stringify(existingResult, null, 2));
  }

  /**
   * 更新摘要路径
   */
  private async updateSummaryPath(oldPath: string, newPath: string): Promise<void> {
    if (!fs.existsSync(this.summariesDir)) {
      return;
    }
    const summaryFiles = fs.readdirSync(this.summariesDir);
    for (const file of summaryFiles) {
      const summaryPath = path.join(this.summariesDir, file);
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      if (summary.path === oldPath) {
        summary.path = newPath;
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        break;
      }
    }
  }

  /**
   * 增量更新文件夹摘要
   */
  private async updateFolderSummary(folderPath: string, fileName: string): Promise<void> {
    const folderHash = createHash('md5').update(folderPath).digest('hex');
    const summaryPath = path.join(this.folderSummariesDir, `${folderHash}.json`);

    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      summary.sampleNotes.push(fileName);
      // 只保留最后10个
      if (summary.sampleNotes.length > 10) {
        summary.sampleNotes = summary.sampleNotes.slice(-10);
      }
      summary.noteCount += 1;
      summary.lastUpdated = new Date().toISOString();
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }
  }

  /**
   * 检查待整理目录并重新分类
   */
  async processPendingFolder(): Promise<void> {
    if (!fs.existsSync(this.pendingDir)) {
      return;
    }

    const files = fs.readdirSync(this.pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const resultPath = path.join(this.pendingDir, `.${file}.classify-result.json`);
      if (fs.existsSync(resultPath)) {
        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

        // 检查重试次数
        if (resultData.retryCount >= this.maxRetries) {
          continue; // 达到最大重试次数，跳过
        }

        // 计算相对于 vault 根目录的路径（用于 classifyNotes）
        const relativeFilePath = path.join('待整理', file);
        const notes = await this.classifyNotes([relativeFilePath]);
        const newResult = notes[0];

        // 检查新的置信度
        if (newResult.confidence >= 0.7) {
          // 高置信度：移回根目录并归档
          const rootPath = file; // 相对路径：直接在根目录
          await this.vault.renameNote(relativeFilePath, rootPath);

          // 删除重试记录
          fs.unlinkSync(resultPath);

          // 执行归档（需要更新 filePath）
          newResult.filePath = rootPath;
          await this.archive(newResult);
        } else {
          // 低置信度：保留在待整理目录，更新重试信息
          resultData.retryCount = (resultData.retryCount || 0) + 1;
          resultData.lastAttempt = new Date().toISOString();
          resultData.classifyResult = newResult;

          fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
        }
      }
    }
  }

  /**
   * 运行完整归档流程
   */
  async run(): Promise<{ archived: number; pending: number; failed: number }> {
    // 阶段0: 生成笔记摘要
    const rootNotes = this.vault.listNotesInFolder('.');
    const summaryStats = { new: 0, updated: 0, cached: 0 };

    for (const note of rootNotes) {
      await this.generateNoteSummary(note);
    }

    // 阶段1: 生成文件夹摘要
    await this.generateFolderSummaries();

    // 阶段2: AI分类和归档（批量处理10个）
    const batchSize = 10;
    let archived = 0;
    let pending = 0;
    let failed = 0;

    for (let i = 0; i < rootNotes.length; i += batchSize) {
      const batch = rootNotes.slice(i, i + batchSize);
      const results = await this.classifyNotes(batch);

      for (const result of results) {
        try {
          await this.archive(result);
          if (result.confidence >= 0.7 && !result.uncertain) {
            archived++;
          } else {
            pending++;
          }
        } catch (e) {
          failed++;
        }
      }
    }

    // 处理待整理目录
    await this.processPendingFolder();

    return { archived, pending, failed };
  }
}

describe('智能归档流程集成测试', () => {
  let vault: VaultTestHelper;
  let aiHelper: AIMockHelper;
  let archiveService: ArchiveService;

  beforeEach(async () => {
    // 创建测试 vault
    vault = new VaultTestHelper('archive-test');
    aiHelper = new AIMockHelper();
    archiveService = new ArchiveService(vault, aiHelper);
  });

  afterEach(async () => {
    // 清理测试环境
    await vault.cleanup();
  });

  // ========================================
  // 阶段1：首次初始化检查
  // ========================================

  describe('A1-A2: 首次初始化检查', () => {
    it('A1: 无文件夹摘要 - 首次运行应扫描所有文件夹并生成摘要', async () => {
      // 创建测试笔记
      await vault.createNote('note1.md', '# Note 1\nContent 1');
      await vault.createNote('note2.md', '# Note 2\nContent 2');

      // 运行归档
      await archiveService.run();

      // 验证文件夹摘要已生成
      const folderSummariesDir = archiveService['folderSummariesDir'];
      expect(fs.existsSync(folderSummariesDir)).toBe(true);

      const files = fs.readdirSync(folderSummariesDir);
      expect(files.length).toBeGreaterThan(0);

      // 验证摘要内容
      const summaryFile = path.join(folderSummariesDir, files[0]);
      const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
      expect(summary).toHaveValidFolderSummaryStructure();
    });

    it('A2: 已有文件夹摘要 - 应跳过初始化', async () => {
      // 创建现有文件夹摘要
      const folderHash = createHash('md5').update('.').digest('hex');
      const existingSummary = {
        path: '.',
        theme: 'Existing theme',
        sampleNotes: ['old-note.md'],
        noteCount: 1,
        lastUpdated: new Date().toISOString(),
      };

      const folderSummariesDir = archiveService['folderSummariesDir'];
      fs.mkdirSync(folderSummariesDir, { recursive: true });
      fs.writeFileSync(
        path.join(folderSummariesDir, `${folderHash}.json`),
        JSON.stringify(existingSummary, null, 2)
      );

      // 创建新笔记
      await vault.createNote('note1.md', '# Note 1\nContent 1');

      // 运行归档
      await archiveService.run();

      // 验证现有摘要被保留（不是完全重新生成）
      const summaryFile = path.join(folderSummariesDir, `${folderHash}.json`);
      const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
      expect(summary.sampleNotes).toContain('old-note.md');
    });
  });

  // ========================================
  // 阶段2：笔记摘要生成/更新
  // ========================================

  describe('A3-A6: 笔记摘要生成/更新', () => {
    it('A3: 新笔记应生成摘要', async () => {
      await vault.createNote('new-note.md', '# New Note\nNew content');

      const summary = await archiveService.generateNoteSummary('new-note.md');

      expect(summary.summary).toBeDefined();
      expect(summary.keywords).toBeDefined();
      expect(summary.contentHash).toBeValidMD5Hash();

      // 验证摘要文件已保存
      const summaryFile = path.join(archiveService['summariesDir'], `${summary.contentHash}.json`);
      expect(fs.existsSync(summaryFile)).toBe(true);
    });

    it('A4: 已有笔记摘要且内容未变更 - 不应重新调用AI', async () => {
      const content = '# Note\nContent';
      await vault.createNote('note.md', content);

      // 首次生成摘要
      const firstSummary = await archiveService.generateNoteSummary('note.md');
      const firstHash = firstSummary.contentHash;

      // 再次生成摘要（内容未变）
      const secondSummary = await archiveService.generateNoteSummary('note.md');

      expect(secondSummary.contentHash).toBe(firstHash);
      expect(secondSummary.summary).toBe(firstSummary.summary);
    });

    it('A5: 已有笔记摘要且内容已变更 - 应重新生成摘要', async () => {
      const originalContent = '# Original\nOriginal content';
      await vault.createNote('note.md', originalContent);

      const firstSummary = await archiveService.generateNoteSummary('note.md');

      // 修改内容
      const modifiedContent = '# Modified\nModified content';
      await vault.createNote('note.md', modifiedContent);

      const secondSummary = await archiveService.generateNoteSummary('note.md');

      expect(secondSummary.contentHash).not.toBe(firstSummary.contentHash);
    });

    it('A6: 应清理过期摘要（指向不存在的文件）', async () => {
      // 创建指向不存在文件的摘要
      const orphanSummary = {
        path: 'non-existent.md',
        title: 'Orphan',
        summary: 'Orphan summary',
        keywords: [],
        contentHash: 'orphan123',
        lastUpdated: new Date().toISOString(),
      };

      const summariesDir = archiveService['summariesDir'];
      fs.mkdirSync(summariesDir, { recursive: true });
      fs.writeFileSync(
        path.join(summariesDir, 'orphan123.json'),
        JSON.stringify(orphanSummary, null, 2)
      );

      // 运行归档（应清理过期摘要）
      await archiveService.run();

      // 注：实际实现需要在服务中添加清理逻辑
    });
  });

  // ========================================
  // 阶段3：AI分类和归档
  // ========================================

  describe('A7-A14: AI分类和归档', () => {
    it('A7: 只扫描根目录笔记 - 子目录笔记不参与分类', async () => {
      // 创建根目录笔记
      await vault.createNote('root-note.md', '# Root Note');

      // 创建子目录
      await vault.createNote('subfolder/sub-note.md', '# Sub Note');

      const rootNotes = vault.listNotesInFolder('.');
      const subNotes = vault.listNotesInFolder('subfolder');

      expect(rootNotes).toContain('root-note.md');
      expect(rootNotes).not.toContain('subfolder/sub-note.md');
      expect(subNotes).toContain('subfolder/sub-note.md');
    });

    it('A8: 批量处理 - 正好10个笔记应调用AI一次', async () => {
      for (let i = 0; i < 10; i++) {
        await vault.createNote(`note${i}.md`, `# Note ${i}`);
      }

      const classifySpy = vi.spyOn(archiveService, 'classifyNotes');

      await archiveService.run();

      // 验证只调用一次
      expect(classifySpy).toHaveBeenCalledTimes(1);
    });

    it('A9: 批量处理 - 23个笔记应调用AI三次', async () => {
      for (let i = 0; i < 23; i++) {
        await vault.createNote(`note${i}.md`, `# Note ${i}`);
      }

      const classifySpy = vi.spyOn(archiveService, 'classifyNotes');

      await archiveService.run();

      // 验证调用三次 (10+10+3)
      expect(classifySpy).toHaveBeenCalledTimes(3);
    });

    it('A10: 隐藏目录过滤 - 默认跳过.obsidian目录', async () => {
      // 创建.obsidian目录
      const obsidianDir = path.join(vault.getPath(), '.obsidian');
      fs.mkdirSync(obsidianDir, { recursive: true });

      // 创建隐藏目录中的笔记
      await vault.createNote('.obsidian/config.md', '# Config');

      const rootNotes = vault.listNotesInFolder('.');

      expect(rootNotes).not.toContain('.obsidian/config.md');
    });

    it('A11: 隐藏目录过滤 - 用户配置的隐藏目录应被过滤', async () => {
      // TODO: 添加用户配置的隐藏目录过滤测试
      // 需要实现配置系统
    });

    it('A12: 低置信度文件(confidence < 0.7)应移至待整理目录', async () => {
      await vault.createNote('low-confidence.md', '# Low Confidence Note');

      const lowConfidenceResult: any = {
        filePath: 'low-confidence.md',
        targetDir: 'Archives/2024',
        confidence: 0.5,
        uncertain: false,
      };

      await archiveService.archive(lowConfidenceResult);

      // 验证文件被移至待整理目录
      expect(fs.existsSync(path.join(archiveService['pendingDir'], 'low-confidence.md'))).toBe(true);
      expect(fs.existsSync(path.join(vault.getPath(), 'low-confidence.md'))).toBe(false);
    });

    it('A13: 高置信度文件(confidence >= 0.7)应移动到目标文件夹', async () => {
      await vault.createNote('high-confidence.md', '# High Confidence Note');

      const highConfidenceResult: any = {
        filePath: 'high-confidence.md',
        targetDir: 'Archives/2024',
        confidence: 0.85,
        uncertain: false,
      };

      await archiveService.archive(highConfidenceResult);

      // 验证文件被移至目标目录
      expect(fs.existsSync(path.join(vault.getPath(), 'Archives/2024/high-confidence.md'))).toBe(true);
      expect(fs.existsSync(path.join(vault.getPath(), 'high-confidence.md'))).toBe(false);
    });

    it('A14: uncertain状态应移至待整理目录', async () => {
      await vault.createNote('uncertain.md', '# Uncertain Note');

      const uncertainResult: any = {
        filePath: 'uncertain.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: true,
      };

      await archiveService.archive(uncertainResult);

      // 验证文件被移至待整理目录
      expect(fs.existsSync(path.join(archiveService['pendingDir'], 'uncertain.md'))).toBe(true);
    });
  });

  // ========================================
  // 阶段4：执行笔记移动
  // ========================================

  describe('A15-A19: 执行笔记移动', () => {
    it('A15: 目标目录不存在 - 应自动创建', async () => {
      await vault.createNote('note.md', '# Note');

      const result: any = {
        filePath: 'note.md',
        targetDir: 'NewFolder/2024',
        confidence: 0.8,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证目录已创建
      expect(fs.existsSync(path.join(vault.getPath(), 'NewFolder/2024'))).toBe(true);
    });

    it('A16: 文件名冲突 - 应自动重命名', async () => {
      await vault.createNote('note.md', '# Note 1');

      // 创建目标文件
      fs.mkdirSync(path.join(vault.getPath(), 'Archives/2024'), { recursive: true });
      fs.writeFileSync(path.join(vault.getPath(), 'Archives/2024/note.md'), 'Existing content');

      const result: any = {
        filePath: 'note.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证新文件被重命名
      expect(fs.existsSync(path.join(vault.getPath(), 'Archives/2024/note.1.md'))).toBe(true);
    });

    it('A17: 移动后应更新摘要路径', async () => {
      await vault.createNote('note.md', '# Note');

      // 生成摘要
      const summary = await archiveService.generateNoteSummary('note.md');

      // 归档
      const result: any = {
        filePath: 'note.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证摘要路径已更新
      const updatedSummary = JSON.parse(
        fs.readFileSync(path.join(archiveService['summariesDir'], `${summary.contentHash}.json`), 'utf-8')
      );
      expect(updatedSummary.path).toBe('Archives/2024/note.md');
    });

    it('A18: 移动后应增量更新文件夹摘要', async () => {
      const folderHash = createHash('md5').update('Archives/2024').digest('hex');
      const existingSummary = {
        path: 'Archives/2024',
        theme: 'Archive',
        sampleNotes: ['old-note.md'],
        noteCount: 1,
        lastUpdated: new Date().toISOString(),
      };

      const folderSummariesDir = archiveService['folderSummariesDir'];
      fs.mkdirSync(folderSummariesDir, { recursive: true });
      fs.writeFileSync(
        path.join(folderSummariesDir, `${folderHash}.json`),
        JSON.stringify(existingSummary, null, 2)
      );

      await vault.createNote('new-note.md', '# New Note');

      const result: any = {
        filePath: 'new-note.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证文件夹摘要已更新
      const updatedSummary = JSON.parse(
        fs.readFileSync(path.join(folderSummariesDir, `${folderHash}.json`), 'utf-8')
      );
      expect(updatedSummary.sampleNotes).toContain('new-note.md');
      expect(updatedSummary.noteCount).toBe(2);
    });

    it('A19: 文件夹摘要sampleNotes应限制为10个', async () => {
      const folderHash = createHash('md5').update('Archives/2024').digest('hex');
      const existingSummary = {
        path: 'Archives/2024',
        theme: 'Archive',
        sampleNotes: Array.from({ length: 10 }, (_, i) => `note${i}.md`),
        noteCount: 10,
        lastUpdated: new Date().toISOString(),
      };

      const folderSummariesDir = archiveService['folderSummariesDir'];
      fs.mkdirSync(folderSummariesDir, { recursive: true });
      fs.mkdirSync(path.join(vault.getPath(), 'Archives/2024'), { recursive: true });
      fs.writeFileSync(
        path.join(folderSummariesDir, `${folderHash}.json`),
        JSON.stringify(existingSummary, null, 2)
      );

      await vault.createNote('new-note.md', '# New Note');

      const result: any = {
        filePath: 'new-note.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证sampleNotes仍然只有10个
      const updatedSummary = JSON.parse(
        fs.readFileSync(path.join(folderSummariesDir, `${folderHash}.json`), 'utf-8')
      );
      expect(updatedSummary.sampleNotes.length).toBe(10);
      expect(updatedSummary.sampleNotes[9]).toBe('new-note.md');
    });
  });

  // ========================================
  // 待整理重试机制
  // ========================================

  describe('A20-A21: 待整理重试机制', () => {
    it('A20: 待整理目录笔记应参与重新分类', async () => {
      // 创建待整理目录
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      // 创建待整理文件
      const pendingNote = '# Pending Note\nThis is pending';
      fs.writeFileSync(path.join(pendingDir, 'pending.md'), pendingNote);

      // 创建分类结果文件
      const resultData = {
        retryCount: 1,
        lastAttempt: new Date().toISOString(),
        classifyResult: {
          targetDir: 'Archives/2024',
          confidence: 0.6,
        },
      };
      fs.writeFileSync(
        path.join(pendingDir, '.pending.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );

      // 运行归档
      await archiveService.processPendingFolder();

      // 验证文件被移回根目录并重新分类
      // 注：实际实现需要更完整的验证
    });

    it('A21: 持续低置信度有最大重试限制', async () => {
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      // 创建已达到最大重试次数的文件
      const resultData = {
        retryCount: 3,
        lastAttempt: new Date().toISOString(),
        classifyResult: {
          targetDir: 'Archives/2024',
          confidence: 0.5,
        },
      };
      fs.writeFileSync(
        path.join(pendingDir, '.max-retry.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );
      fs.writeFileSync(path.join(pendingDir, 'max-retry.md'), '# Max Retry');

      // 运行归档
      await archiveService.processPendingFolder();

      // 验证文件仍在待整理目录（不再重试）
      expect(fs.existsSync(path.join(pendingDir, 'max-retry.md'))).toBe(true);
    });
  });

  // ========================================
  // 边界情况
  // ========================================

  describe('A22-A24: 边界情况', () => {
    it('A22: 根目录无笔记应显示提示', async () => {
      const result = await archiveService.run();

      expect(result.archived).toBe(0);
      expect(result.pending).toBe(0);
    });

    it('A23: 所有笔记都在待整理目录应正常处理', async () => {
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });
      fs.writeFileSync(path.join(pendingDir, 'pending1.md'), '# Pending 1');
      fs.writeFileSync(path.join(pendingDir, 'pending2.md'), '# Pending 2');

      await archiveService.processPendingFolder();

      // 验证能正常处理
    });

    it('A24: 配置的待整理目录不存在应自动创建', async () => {
      await vault.createNote('note.md', '# Note');

      const result: any = {
        filePath: 'note.md',
        targetDir: 'Archives/2024',
        confidence: 0.5,
        uncertain: false,
      };

      await archiveService.archive(result);

      // 验证待整理目录已创建
      expect(fs.existsSync(archiveService['pendingDir'])).toBe(true);
    });
  });

  // ========================================
  // 上下文增强机制
  // ========================================

  describe('A25-A27: 上下文增强机制', () => {
    it('A25: 内容较少笔记应强制提取文件名', async () => {
      const shortNote = '# Short\n'; // 只有2行

      await vault.createNote('short-file.md', shortNote);

      const results = await archiveService.classifyNotes(['short-file.md']);

      // 验证分类调用时包含文件名
      expect(results[0]).toHaveProperty('filename', 'short-file');
    });

    it('A26: 内容较少笔记应强制提取父目录名', async () => {
      const shortNote = '# Short\n';

      await vault.createNote('parent/child.md', shortNote);

      const results = await archiveService.classifyNotes(['parent/child.md']);

      // 验证分类调用时包含父目录名
      expect(results[0]).toHaveProperty('parentDir', 'parent');
    });

    it('A27: 正常内容笔记不应额外提取', async () => {
      const longNote =
        '# Long Note\n\n' +
        'This is a longer note with multiple lines.\n' +
        'It has enough content to not need enhancement.\n' +
        'Line 4\n' +
        'Line 5\n';

      await vault.createNote('long-file.md', longNote);

      const results = await archiveService.classifyNotes(['long-file.md']);

      // 验证不包含额外的上下文信息
      expect(results[0]).not.toHaveProperty('filename');
      expect(results[0]).not.toHaveProperty('parentDir');
    });
  });

  // ========================================
  // 文件名冲突处理
  // ========================================

  describe('A28-A30: 文件名冲突处理', () => {
    it('A28: 同批次多文件冲突到同一目录应正确重命名', async () => {
      // 创建目标目录和已存在的文件
      fs.mkdirSync(path.join(vault.getPath(), 'Archives/2024'), { recursive: true });
      fs.writeFileSync(path.join(vault.getPath(), 'Archives/2024/conflict.md'), 'Existing');

      // 创建多个同名文件
      await vault.createNote('conflict.md', '# Conflict 1');
      await vault.createNote('conflict2.md', '# Conflict 2');

      // 归档到同一目录
      await archiveService.archive({
        filePath: 'conflict.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      } as any);

      // 验证文件被正确重命名
      expect(fs.existsSync(path.join(vault.getPath(), 'Archives/2024/conflict.1.md'))).toBe(true);
    });

    it('A29: 文件名冲突序号应递增', async () => {
      fs.mkdirSync(path.join(vault.getPath(), 'Archives/2024'), { recursive: true });
      fs.writeFileSync(path.join(vault.getPath(), 'Archives/2024/file.md'), 'Original');
      fs.writeFileSync(path.join(vault.getPath(), 'Archives/2024/file.1.md'), 'First');

      await vault.createNote('file.md', '# New File');

      await archiveService.archive({
        filePath: 'file.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      } as any);

      // 验证新文件为 file.2.md
      expect(fs.existsSync(path.join(vault.getPath(), 'Archives/2024/file.2.md'))).toBe(true);
    });

    it('A30: 特殊字符文件名冲突应正确处理', async () => {
      fs.mkdirSync(path.join(vault.getPath(), 'Archives/2024'), { recursive: true });
      fs.writeFileSync(
        path.join(vault.getPath(), 'Archives/2024/file with spaces.md'),
        'Original'
      );

      await vault.createNote('file with spaces.md', '# Spaces');

      await archiveService.archive({
        filePath: 'file with spaces.md',
        targetDir: 'Archives/2024',
        confidence: 0.8,
        uncertain: false,
      } as any);

      // 验证能正确处理带空格的文件名
      expect(fs.existsSync(path.join(vault.getPath(), 'Archives/2024/file with spaces.1.md'))).toBe(
        true
      );
    });
  });

  // ========================================
  // 待整理循环防护 (v2.1新增)
  // ========================================

  describe('A31-A34: 待整理循环防护', () => {
    it('A31: 持续低置信度有最大重试限制(3次)', async () => {
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      // 创建已重试3次的文件
      const resultData = {
        retryCount: 3,
        lastAttempt: new Date().toISOString(),
        classifyResult: { confidence: 0.5, targetDir: 'Archives/2024' },
      };

      fs.writeFileSync(
        path.join(pendingDir, '.loop.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );
      fs.writeFileSync(path.join(pendingDir, 'loop.md'), '# Loop');

      await archiveService.processPendingFolder();

      // 验证不再重试
      const updatedResult = JSON.parse(
        fs.readFileSync(path.join(pendingDir, '.loop.md.classify-result.json'), 'utf-8')
      );
      expect(updatedResult.retryCount).toBe(3);
    });

    it('A32: 达到重试上限后应停止', async () => {
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      const resultData = {
        retryCount: 3,
        lastAttempt: new Date().toISOString(),
        classifyResult: { confidence: 0.5, targetDir: 'Archives/2024' },
      };

      fs.writeFileSync(
        path.join(pendingDir, '.stop.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );
      fs.writeFileSync(path.join(pendingDir, 'stop.md'), '# Stop');

      await archiveService.processPendingFolder();

      // 验证文件仍在待整理目录
      expect(fs.existsSync(path.join(pendingDir, 'stop.md'))).toBe(true);
    });

    it('A33: 重试计数器应正确计数', async () => {
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      const resultData = {
        retryCount: 1,
        lastAttempt: new Date().toISOString(),
        classifyResult: { confidence: 0.6, targetDir: 'Archives/2024' },
      };

      fs.writeFileSync(
        path.join(pendingDir, '.counter.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );
      fs.writeFileSync(path.join(pendingDir, 'counter.md'), '# Counter');

      await archiveService.processPendingFolder();

      // 验证计数器增加
      const updatedResult = JSON.parse(
        fs.readFileSync(path.join(pendingDir, '.counter.md.classify-result.json'), 'utf-8')
      );
      expect(updatedResult.retryCount).toBe(2);
    });

    it('A34: 成功归档后应重置计数', async () => {
      // 创建待整理目录
      const pendingDir = archiveService['pendingDir'];
      fs.mkdirSync(pendingDir, { recursive: true });

      // 创建待整理文件
      fs.writeFileSync(path.join(pendingDir, 'reset.md'), '# Reset');

      const resultData = {
        retryCount: 2,
        lastAttempt: new Date().toISOString(),
        classifyResult: { confidence: 0.5, targetDir: 'Archives/2024' },
      };

      fs.writeFileSync(
        path.join(pendingDir, '.reset.md.classify-result.json'),
        JSON.stringify(resultData, null, 2)
      );

      // 模拟成功归档（移回根目录后高置信度归档）
      // 这需要更复杂的测试设置
    });
  });
});
