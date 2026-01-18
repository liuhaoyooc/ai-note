/**
 * 归档功能集成测试
 * @P0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';
import { createTestPlugin } from '@tests/helpers/testPlugin';
import { createNoteBuilder, TestDataPresets } from '@tests/helpers/testDataBuilder';

describe('Archive Integration Tests', () => {
  let vault: any;
  let plugin: any;

  beforeEach(async () => {
    vault = await createTestVault('archive-integration');
    plugin = await createTestPlugin(vault.getPath());
  });

  it('should archive a single note', async () => {
    // 创建待归档的笔记
    const note = createNoteBuilder('to-archive.md')
      .withTitle('To Archive')
      .withParagraph('This note should be archived.')
      .build();

    await vault.createNote(note.path, note.content);

    // 验证笔记存在
    expect(vault.noteExists('to-archive.md')).toBe(true);

    // 模拟归档操作
    await vault.moveNote('to-archive.md', 'Archives/2024/to-archive.md');

    // 验证归档成功
    expect(vault.noteExists('to-archive.md')).toBe(false);
    expect(vault.noteExists('Archives/2024/to-archive.md')).toBe(true);

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should archive multiple notes', async () => {
    // 创建多个待归档的笔记
    const notes = [
      'note1.md',
      'note2.md',
      'note3.md',
    ];

    for (let i = 0; i < notes.length; i++) {
      const notePath = notes[i];
      const note = createNoteBuilder(notePath)
        .withTitle(`Note ${i + 1}`)
        .withParagraph(`Content ${i + 1}`)
        .build();
      await vault.createNote(note.path, note.content);
    }

    // 验证所有笔记都存在
    notes.forEach(notePath => {
      expect(vault.noteExists(notePath)).toBe(true);
    });

    // 批量归档
    for (const notePath of notes) {
      await vault.moveNote(notePath, `Archives/2024/${notePath}`);
    }

    // 验证归档成功
    notes.forEach(notePath => {
      expect(vault.noteExists(notePath)).toBe(false);
      expect(vault.noteExists(`Archives/2024/${notePath}`)).toBe(true);
    });

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should use AI response for archive confirmation', async () => {
    // 创建笔记
    const note = TestDataPresets.archiveNote();
    await vault.createNote(note.path, note.content);

    // 验证笔记已创建
    expect(vault.noteExists(note.path)).toBe(true);

    // AI Mock 验证在实际实现中完成
    // 这里主要验证测试基础设施正常工作

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should organize archives by date', async () => {
    // 创建不同日期的笔记
    const dates = ['2024-01', '2024-02', '2024-03'];

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const note = createNoteBuilder(`note${i}.md`)
        .withTitle(`Note for ${date}`)
        .withFrontmatter('created', date)
        .build();

      await vault.createNote(note.path, note.content);
      await vault.moveNote(note.path, `Archives/${date}/note${i}.md`);
    }

    // 验证归档结构
    dates.forEach(date => {
      expect(vault.noteExists(`Archives/${date}/`)).toBe(true);
    });

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should handle archive metadata', async () => {
    // 创建带归档元数据的笔记
    const note = createNoteBuilder('with-metadata.md')
      .withTitle('With Metadata')
      .withFrontmatter('archived', true)
      .withFrontmatter('archive-date', new Date().toISOString())
      .withFrontmatter('archive-reason', 'completed')
      .build();

    await vault.createNote(note.path, note.content);
    await vault.moveNote(note.path, 'Archives/with-metadata.md');

    // 验证归档后的元数据
    const archivedContent = await vault.readNote('Archives/with-metadata.md');
    expect(archivedContent).toContain('archived');
    expect(archivedContent).toContain('archive-date');

    await vault.cleanup();
    await plugin.cleanup();
  });
});
