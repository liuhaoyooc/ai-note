/**
 * 测试 Helpers 使用示例
 * 展示如何使用各个测试辅助工具
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AIMockHelper,
  VaultTestHelper,
  TestDataBuilder,
  NoteDataBuilder,
  TestPlugin,
  createTestVault,
  TestDataPresets,
} from '@tests/helpers';

describe('测试 Helpers 使用示例', () => {
  let vaultHelper: VaultTestHelper;
  let aiMockHelper: AIMockHelper;
  let testPlugin: TestPlugin;

  beforeEach(async () => {
    // 创建测试 Vault
    vaultHelper = new VaultTestHelper('example-test');
    await vaultHelper.createTestVault({
      root: {
        notes: ['Inbox/test-note.md'],
        folders: ['Archives', 'Reviews'],
      },
    });

    // 创建 AI Mock Helper
    aiMockHelper = new AIMockHelper();

    // 创建测试 Plugin
    testPlugin = new TestPlugin(vaultHelper);
  });

  afterEach(async () => {
    // 清理测试数据
    await vaultHelper.cleanup();
    aiMockHelper.clearRecordings();
  });

  describe('AIMockHelper', () => {
    it('应该能够 Mock AI 分类响应', () => {
      // Mock 分类响应
      aiMockHelper.mockClassify([
        {
          targetDir: 'Archives/2024',
          confidence: 0.95,
        },
      ]);

      expect(aiMockHelper.getMode()).toBe('mock');
    });

    it('应该能够使用预设响应', () => {
      // 可以使用 AIResponsePresets 中预设的响应
      const preset = {
        success: '已成功将笔记归档到目标文件夹。',
        error: '归档过程中出现错误,请检查日志。',
      };

      expect(preset.success).toBeDefined();
      expect(preset.error).toBeDefined();
    });
  });

  describe('VaultTestHelper', () => {
    it('应该能够创建和读取笔记', async () => {
      const content = '# Test Note\n\nThis is test content.';
      await vaultHelper.createNote('test.md', content);

      expect(vaultHelper.noteExists('test.md')).toBe(true);

      const readContent = await vaultHelper.readNote('test.md');
      expect(readContent).toBe(content);
    });

    it('应该能够列出所有笔记', () => {
      const notes = vaultHelper.getAllNotes();
      expect(notes.length).toBeGreaterThan(0);
      expect(notes).toContain('Inbox/test-note.md');
    });
  });

  describe('TestDataBuilder', () => {
    it('应该能够使用静态方法创建测试数据', () => {
      // 创建 TFile 对象
      const file = TestDataBuilder.note({
        path: 'test.md',
        title: 'Test Note',
      });

      expect(file.path).toBe('test.md');
      expect(file.name).toBe('test.md');

      // 创建 NoteSummary 对象
      const summary = TestDataBuilder.summary({
        keywords: ['test', 'example'],
        summary: 'Test summary',
      });

      expect(summary.keywords).toEqual(['test', 'example']);
      expect(summary.summary).toBe('Test summary');
    });

    it('应该能够使用构建器创建复杂笔记', () => {
      const note = new NoteDataBuilder('complex.md')
        .withTitle('Complex Note')
        .withParagraph('First paragraph')
        .withList(['Item 1', 'Item 2', 'Item 3'])
        .withTasks([
          { text: 'Task 1', completed: false },
          { text: 'Task 2', completed: true },
        ])
        .withTags(['test', 'complex'])
        .withLinks(['RelatedNote'])
        .build();

      expect(note.path).toBe('complex.md');
      expect(note.tags).toEqual(['test', 'complex']);
      expect(note.links).toEqual(['RelatedNote']);
      expect(note.content).toContain('# Complex Note');
      expect(note.content).toContain('Item 1');
      expect(note.content).toContain('[ ]');
    });

    it('应该能够使用预设数据', () => {
      // 使用简单笔记预设
      const simpleNote = TestDataPresets.simpleNote();
      expect(simpleNote.content).toContain('Simple Note');

      // 使用完整笔记预设
      const fullNote = TestDataPresets.fullNote();
      expect(fullNote.frontmatter).toBeDefined();
      expect(fullNote.tags).toBeDefined();
      expect(fullNote.links).toBeDefined();

      // 使用归档笔记预设
      const archiveNote = TestDataPresets.archiveNote();
      expect(archiveNote.frontmatter?.archived).toBe(true);
    });
  });

  describe('TestPlugin', () => {
    it('应该能够创建和管理测试 Plugin', async () => {
      await testPlugin.onload();

      expect(testPlugin.isLoaded).toBe(true);

      // 检查默认设置
      const settings = testPlugin.getSettings();
      expect(settings.apiKey).toBe('test-key');
      expect(settings.paths.reviewsDir).toBe('复盘');
    });

    it('应该能够访问 Mock App 对象', () => {
      const app = testPlugin.getApp();

      expect(app.vault).toBeDefined();
      expect(app.metadataCache).toBeDefined();
      expect(app.workspace).toBeDefined();
    });

    it('应该能够修改插件设置', () => {
      testPlugin.setSettings({
        apiKey: 'new-test-key',
        review: {
          maxDiffLines: 500,
          dayBoundary: 'rolling',
        },
      });

      const settings = testPlugin.getSettings();
      expect(settings.apiKey).toBe('new-test-key');
      expect(settings.review.maxDiffLines).toBe(500);
    });
  });

  describe('集成测试示例', () => {
    it('应该能够组合使用多个 Helpers', async () => {
      // 1. 使用 TestDataBuilder 创建笔记数据
      const noteData = new NoteDataBuilder('integration-test.md')
        .withTitle('Integration Test')
        .withParagraph('Testing integration of helpers')
        .withTags(['test', 'integration'])
        .build();

      // 2. 使用 VaultHelper 创建笔记
      await vaultHelper.createNote(noteData.path, noteData.content);

      // 3. 验证笔记已创建
      expect(vaultHelper.noteExists(noteData.path)).toBe(true);

      // 4. 读取笔记内容
      const content = await vaultHelper.readNote(noteData.path);
      expect(content).toContain('Integration Test');

      // 5. 使用 AIMockHelper 模拟 AI 分析
      aiMockHelper.mockClassify([
        {
          targetDir: 'Archives/Integration',
          confidence: 0.98,
        },
      ]);

      // 6. 验证 Mock 已设置
      expect(aiMockHelper.getMode()).toBe('mock');
    });
  });
});
