/**
 * 并发操作边界测试
 * @P0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';

describe('Concurrency Boundary Tests', () => {
  let vault: any;

  beforeEach(async () => {
    vault = await createTestVault('concurrency');
  });

  it('should handle rapid sequential operations', async () => {
    // 测试快速连续操作
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        new Promise(resolve => {
          vault.createNote(`note${i}.md`, `content ${i}`);
          resolve(true);
        })
      );
    }

    await Promise.all(promises);

    // 验证所有文件都已创建
    for (let i = 0; i < 100; i++) {
      expect(vault.noteExists(`note${i}.md`)).toBe(true);
    }

    vault.cleanup();
  });

  it('should handle parallel read operations', async () => {
    // 创建一些笔记
    for (let i = 0; i < 10; i++) {
      vault.createNote(`note${i}.md`, `content ${i}`);
    }

    // 并行读取
    const readPromises = [];
    for (let i = 0; i < 10; i++) {
      readPromises.push(
        new Promise(resolve => {
          const content = vault.readNote(`note${i}.md`);
          resolve(content);
        })
      );
    }

    const results = await Promise.all(readPromises);
    expect(results).toHaveLength(10);

    vault.cleanup();
  });

  it('should prevent race conditions in archive operations', async () => {
    // 创建多个笔记
    for (let i = 0; i < 10; i++) {
      vault.createNote(`note${i}.md`, `content ${i}`);
    }

    // 并发归档
    const archivePromises = [];
    for (let i = 0; i < 10; i++) {
      archivePromises.push(
        new Promise(resolve => {
          vault.moveNote(`note${i}.md`, `Archives/note${i}.md`);
          resolve(true);
        })
      );
    }

    await Promise.all(archivePromises);

    // 验证所有文件都已移动
    for (let i = 0; i < 10; i++) {
      expect(vault.noteExists(`note${i}.md`)).toBe(false);
      expect(vault.noteExists(`Archives/note${i}.md`)).toBe(true);
    }

    vault.cleanup();
  });
});
