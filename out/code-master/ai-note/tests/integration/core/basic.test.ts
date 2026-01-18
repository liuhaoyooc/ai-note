/**
 * 核心功能集成测试
 * @P0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';
import { createTestPlugin } from '@tests/helpers/testPlugin';
import { createNoteBuilder } from '@tests/helpers/testDataBuilder';

describe('Core Integration Tests', () => {
  let vault: any;
  let plugin: any;

  beforeEach(async () => {
    vault = await createTestVault('core-integration');
    plugin = await createTestPlugin(vault.getPath());
  });

  it('should create and read notes', async () => {
    const noteData = createNoteBuilder('test.md')
      .withTitle('Test Note')
      .withParagraph('This is a test note.')
      .build();

    await vault.createNote(noteData.path, noteData.content);

    expect(vault.noteExists(noteData.path)).toBe(true);
    expect(await vault.readNote(noteData.path)).toContain('Test Note');
    expect(await vault.readNote(noteData.path)).toContain('This is a test note.');

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should handle note metadata', async () => {
    const noteData = createNoteBuilder('metadata.md')
      .withTitle('Metadata Test')
      .withFrontmatter('author', 'Test User')
      .withFrontmatter('tags', ['test', 'metadata'])
      .withTags(['tag1', 'tag2'])
      .build();

    await vault.createNote(noteData.path, noteData.content);

    const content = await vault.readNote(noteData.path);
    expect(content).toContain('author');
    expect(content).toContain('Test User');
    expect(content).toContain('#tag1');
    expect(content).toContain('#tag2');

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should handle linked notes', async () => {
    // 创建第一个笔记
    const note1 = createNoteBuilder('note1.md')
      .withTitle('Note 1')
      .withParagraph('First note')
      .build();

    await vault.createNote(note1.path, note1.content);

    // 创建第二个笔记，链接到第一个
    const note2 = createNoteBuilder('note2.md')
      .withTitle('Note 2')
      .withParagraph('Second note linking to [[Note 1]]')
      .build();

    await vault.createNote(note2.path, note2.content);

    expect(vault.noteExists('note1.md')).toBe(true);
    expect(vault.noteExists('note2.md')).toBe(true);
    expect(await vault.readNote('note2.md')).toContain('[[Note 1]]');

    await vault.cleanup();
    await plugin.cleanup();
  });

  it('should list all notes in vault', async () => {
    // 创建多个笔记
    for (let i = 1; i <= 5; i++) {
      const note = createNoteBuilder(`note${i}.md`)
        .withTitle(`Note ${i}`)
        .build();
      await vault.createNote(note.path, note.content);
    }

    const allNotes = vault.getAllNotes();
    expect(allNotes).toHaveLength(5);
    expect(allNotes).toContain('note1.md');
    expect(allNotes).toContain('note5.md');

    await vault.cleanup();
    await plugin.cleanup();
  });
});
