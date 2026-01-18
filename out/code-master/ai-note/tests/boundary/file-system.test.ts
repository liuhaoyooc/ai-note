/**
 * 文件系统边界测试
 * @P1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';

describe('File System Boundary Tests', () => {
  let vault: any;

  beforeEach(async () => {
    vault = await createTestVault('file-system');
  });

  it('should handle very long file names', async () => {
    // 测试超长文件名
    const longName = 'a'.repeat(200) + '.md';
    expect(() => {
      vault.createNote(longName, 'content');
    }).not.toThrow();

    expect(vault.noteExists(longName)).toBe(true);

    vault.cleanup();
  });

  it('should handle special characters in file names', async () => {
    // 测试特殊字符
    const specialNames = [
      'test with spaces.md',
      'test-with-dashes.md',
      'test_with_underscores.md',
      'test.multiple.dots.md',
    ];

    specialNames.forEach(name => {
      expect(() => {
        vault.createNote(name, 'content');
      }).not.toThrow();
      expect(vault.noteExists(name)).toBe(true);
    });

    vault.cleanup();
  });

  it('should handle very large files', async () => {
    // 测试大文件
    const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
    await vault.createNote('large.md', largeContent);

    const readContent = await vault.readNote('large.md');
    expect(readContent.length).toBe(10 * 1024 * 1024);

    await vault.cleanup();
  });

  it('should handle deep directory structures', async () => {
    // 测试深层目录结构
    const deepPath = 'level1/level2/level3/level4/level5/deep.md';
    expect(() => {
      vault.createNote(deepPath, 'content');
    }).not.toThrow();

    expect(vault.noteExists(deepPath)).toBe(true);

    vault.cleanup();
  });

  it('should handle unicode file names', async () => {
    // 测试 Unicode 文件名
    const unicodeNames = [
      '测试.md',
      'тест.md',
      'テスト.md',
      '📝 Note.md',
    ];

    unicodeNames.forEach(name => {
      expect(() => {
        vault.createNote(name, 'content');
      }).not.toThrow();
      expect(vault.noteExists(name)).toBe(true);
    });

    vault.cleanup();
  });
});
