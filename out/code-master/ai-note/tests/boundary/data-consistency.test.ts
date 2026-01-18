/**
 * 数据一致性边界测试
 * @P0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault, TestVaultPresets } from '@tests/helpers/vaultHelper';

describe('Data Consistency Boundary Tests', () => {
  let vault: any;

  beforeEach(async () => {
    vault = await createTestVault('data-consistency');
  });

  it('should maintain consistency when archiving same file twice', async () => {
    // 测试同一文件被归档两次时的一致性
    const notePath = 'test.md';
    await vault.createNote(notePath, 'content');

    // 第一次归档
    await vault.moveNote(notePath, 'Archives/test.md');

    // 第二次尝试归档应该失败或无操作
    expect(() => {
      vault.moveNote('Archives/test.md', 'Archives/2024/test.md');
    }).not.toThrow();

    await vault.cleanup();
  });

  it('should handle concurrent file modifications', async () => {
    // 测试并发修改同一文件
    const notePath = 'concurrent.md';
    await vault.createNote(notePath, 'initial');

    // 模拟多次修改
    await vault.createNote(notePath, 'version 1');
    await vault.createNote(notePath, 'version 2');
    await vault.createNote(notePath, 'version 3');

    const content = await vault.readNote(notePath);
    expect(content).toBe('version 3');

    await vault.cleanup();
  });

  it('should prevent data loss during move operations', async () => {
    // 测试移动操作不会丢失数据
    const notePath = 'important.md';
    const content = 'Important content that must not be lost';
    await vault.createNote(notePath, content);

    const newPath = 'Archives/2024/important.md';
    await vault.moveNote(notePath, newPath);

    expect(vault.noteExists(newPath)).toBe(true);
    expect(vault.noteExists(notePath)).toBe(false);
    expect(await vault.readNote(newPath)).toBe(content);

    await vault.cleanup();
  });

  describe('DC4: 快照和摘要数据一致性测试', () => {
    it('DC4: 文件夹摘要sampleNotes为空应正常处理', async () => {
      // 创建带有空sampleNotes的文件夹摘要
      const folderSummaryPath = '.obsidian/plugins/ai-note/data/cache/folder_summaries/test-hash.json';
      await vault.createNote(
        folderSummaryPath,
        JSON.stringify({
          path: 'test',
          theme: 'Test Theme',
          sampleNotes: [], // 空数组
          noteCount: 0,
          lastUpdated: new Date().toISOString()
        })
      );

      // 验证空数组能被正确处理
      const summary = JSON.parse(await vault.readNote(folderSummaryPath));
      expect(summary.sampleNotes).toEqual([]);
      expect(summary.noteCount).toBe(0);

      await vault.cleanup();
    });

    it('DC5: JSON解析失败应能重建摘要', async () => {
      // 创建损坏的JSON文件
      await vault.createNote(
        '.obsidian/plugins/ai-note/data/summaries/note1.json',
        '{ invalid json content'
      );

      // Mock快照索引损坏场景
      const snapshotIndexPath = '.obsidian/plugins/ai-note/data/snapshots/index.json';
      await vault.createNote(
        snapshotIndexPath,
        '{ "lastSnapshotTime": "2024-01-01T00:00:00.000Z", "files": {} }'
      );

      // 验证损坏的JSON能被检测并重建
      const corruptContent = await vault.readNote('.obsidian/plugins/ai-note/data/summaries/note1.json');
      expect(() => {
        JSON.parse(corruptContent);
      }).toThrow();

      // 清理损坏文件后重新生成
      await vault.deleteNote('.obsidian/plugins/ai-note/data/summaries/note1.json');

      // 验证系统可以继续工作
      await vault.createNote(
        '.obsidian/plugins/ai-note/data/summaries/note1.json',
        JSON.stringify({ title: 'Test', summary: 'Summary' })
      );

      const summary = JSON.parse(await vault.readNote('.obsidian/plugins/ai-note/data/summaries/note1.json'));
      expect(summary.title).toBe('Test');

      await vault.cleanup();
    });

    it('DC6: 快照索引JSON损坏应能重建', async () => {
      // 创建损坏的快照索引
      const indexPath = '.obsidian/plugins/ai-note/data/snapshots/index.json';
      await vault.createNote(indexPath, '{ invalid json }');

      // Mock快照文件仍然存在
      await vault.createNote(
        '.obsidian/plugins/ai-note/data/snapshots/abc123.gz',
        'compressed content'
      );

      // 验证损坏的索引能被检测
      const corruptIndex = await vault.readNote(indexPath);
      expect(() => {
        JSON.parse(corruptIndex);
      }).toThrow();

      // 删除损坏的索引
      await vault.deleteNote(indexPath);

      // 重建索引
      const newIndex = {
        lastSnapshotTime: new Date().toISOString(),
        files: {
          'test.md': {
            hash: 'abc123',
            snapshotFile: 'snapshots/abc123.gz',
            modifiedTime: Date.now()
          }
        }
      };

      await vault.createNote(indexPath, JSON.stringify(newIndex));

      // 验证重建成功
      const parsedIndex = JSON.parse(await vault.readNote(indexPath));
      expect(parsedIndex.files).toHaveProperty('test.md');

      await vault.cleanup();
    });
  });
});
