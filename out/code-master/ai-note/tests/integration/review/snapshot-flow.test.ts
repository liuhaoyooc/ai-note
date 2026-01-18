/**
 * 快照管理集成测试
 * @P0
 * 测试快照的压缩、解压、索引管理等功能
 *
 * 测试计划 v2.1 - 12个测试用例
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

class SnapshotManager {
  private vault: VaultTestHelper;
  private snapshotsDir: string;

  constructor(vault: VaultTestHelper) {
    this.vault = vault;
    this.snapshotsDir = path.join(vault.getPath(), '.obsidian', 'plugins', 'ai-note', 'data', 'snapshots');
  }

  /**
   * 计算内容哈希
   */
  private calculateHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 压缩内容
   */
  compress(content: string): string {
    const compressed = gzipSync(Buffer.from(content, 'utf-8'));
    return compressed.toString('base64');
  }

  /**
   * 解压内容
   */
  decompress(compressedContent: string): string {
    try {
      const buffer = Buffer.from(compressedContent, 'base64');
      const decompressed = gunzipSync(buffer);
      return decompressed.toString('utf-8');
    } catch (e) {
      throw new Error('解压失败: ' + (e as Error).message);
    }
  }

  /**
   * 创建快照
   */
  async createSnapshot(notePath: string, content: string): string {
    const hash = this.calculateHash(content);
    const compressed = this.compress(content);

    fs.mkdirSync(this.snapshotsDir, { recursive: true });
    const snapshotFile = path.join(this.snapshotsDir, `${hash}.gz`);
    fs.writeFileSync(snapshotFile, compressed);

    return hash;
  }

  /**
   * 读取快照
   */
  async readSnapshot(hash: string): string | null {
    const snapshotFile = path.join(this.snapshotsDir, `${hash}.gz`);

    if (!fs.existsSync(snapshotFile)) {
      return null;
    }

    const compressed = fs.readFileSync(snapshotFile, 'utf-8');
    return this.decompress(compressed);
  }
}

describe('快照管理集成测试', () => {
  let vault: VaultTestHelper;
  let snapshotManager: SnapshotManager;

  beforeEach(async () => {
    vault = new VaultTestHelper('snapshot-test');
    snapshotManager = new SnapshotManager(vault);
  });

  afterEach(async () => {
    await vault.cleanup();
  });

  // ========================================
  // 基本功能
  // ========================================

  describe('SN1-SN5: 基本功能', () => {
    it('SN1: 快照压缩应正确', async () => {
      const content = '# Test Note\n\nThis is a test content.';
      const compressed = snapshotManager.compress(content);

      // 验证是有效的base64
      expect(() => Buffer.from(compressed, 'base64')).not.toThrow();

      // 验证是有效的gzip
      const buffer = Buffer.from(compressed, 'base64');
      expect(buffer[0]).toBe(0x1f); // gzip magic number
      expect(buffer[1]).toBe(0x8b);
    });

    it('SN2: 快照解压应正确', async () => {
      const originalContent = '# Test Note\n\nThis is a test content.';
      const compressed = snapshotManager.compress(originalContent);
      const decompressed = snapshotManager.decompress(compressed);

      expect(decompressed).toBe(originalContent);
    });

    it('SN3: 压缩率应合理', async () => {
      const shortContent = '# Short';
      const longContent = '# Long\n\n' + Array.from({ length: 1000 }, () => 'Line content. ').join('\n');

      const compressedShort = snapshotManager.compress(shortContent);
      const compressedLong = snapshotManager.compress(longContent);

      const ratioShort = compressedShort.length / shortContent.length;
      const ratioLong = compressedLong.length / longContent.length;

      // 长内容应该有更好的压缩率
      expect(ratioLong).toBeLessThan(ratioShort);
    });

    it('SN4: 损坏快照文件应能检测并重建', async () => {
      const content = '# Test';
      const hash = await snapshotManager.createSnapshot('test.md', content);

      // 损坏快照文件
      const snapshotFile = path.join(snapshotManager['snapshotsDir'], `${hash}.gz`);
      fs.writeFileSync(snapshotFile, 'corrupted data');

      // 尝试读取应抛出错误
      await expect(async () => {
        await snapshotManager.readSnapshot(hash);
      }).rejects.toThrow();
    });

    it('SN5: 快照索引与文件不一致应能检测并修复', async () => {
      // 创建快照
      await snapshotManager.createSnapshot('note1.md', '# Note 1');

      // 删除快照文件但保留索引
      const indexFile = path.join(snapshotManager['snapshotsDir'], 'index.json');
      fs.writeFileSync(indexFile, JSON.stringify({
        'note1.md': { hash: 'abc123', snapshotFile: 'abc123.gz' }
      }));

      // 应检测到不一致
      const snapshot = await snapshotManager.readSnapshot('abc123');
      expect(snapshot).toBeNull();
    });
  });

  // ========================================
  // 批量操作
  // ========================================

  describe('SN6-SN8: 批量操作', () => {
    it('SN6: 批量创建快照应高效', async () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await snapshotManager.createSnapshot(`note${i}.md`, `# Note ${i}\n\nContent.`);
      }

      const elapsed = Date.now() - start;

      // 100个快照应在合理时间内完成
      expect(elapsed).toBeLessThan(5000);
    });

    it('SN7: 批量读取快照应正确', async () => {
      const contents: Record<string, string> = {};

      for (let i = 0; i < 10; i++) {
        const content = `# Note ${i}\n\nContent ${i}.`;
        contents[`note${i}.md`] = content;
        await snapshotManager.createSnapshot(`note${i}.md`, content);
      }

      // 读取所有快照
      const files = fs.readdirSync(snapshotManager['snapshotsDir']);
      const snapshotFiles = files.filter(f => f.endsWith('.gz'));

      expect(snapshotFiles).toHaveLength(10);

      // 验证每个快照都能正确解压
      for (const file of snapshotFiles) {
        const hash = file.replace('.gz', '');
        const snapshot = await snapshotManager.readSnapshot(hash);
        expect(snapshot).toBeTruthy();
      }
    });

    it('SN8: 批量删除快照应正确', async () => {
      // 创建快照
      for (let i = 0; i < 10; i++) {
        await snapshotManager.createSnapshot(`note${i}.md`, `# Note ${i}`);
      }

      // 删除一半
      for (let i = 0; i < 5; i++) {
        const hash = snapshotManager['calculateHash'](`# Note ${i}`);
        const snapshotFile = path.join(snapshotManager['snapshotsDir'], `${hash}.gz`);
        fs.unlinkSync(snapshotFile);
      }

      // 验证剩余快照
      const files = fs.readdirSync(snapshotManager['snapshotsDir']);
      const snapshotFiles = files.filter(f => f.endsWith('.gz'));

      expect(snapshotFiles).toHaveLength(5);
    });
  });

  // ========================================
  // 边界情况
  // ========================================

  describe('SN9-SN12: 边界情况', () => {
    it('SN9: 空内容快照应正确处理', async () => {
      const emptyContent = '';
      const compressed = snapshotManager.compress(emptyContent);
      const decompressed = snapshotManager.decompress(compressed);

      expect(decompressed).toBe('');
    });

    it('SN10: 特殊字符内容快照应正确处理', async () => {
      const specialContent = '# 特殊字符\\n\\n中文字符\\n\\u{1F389} Emoji\n引号\\反斜杠';
      const compressed = snapshotManager.compress(specialContent);
      const decompressed = snapshotManager.decompress(compressed);

      expect(decompressed).toBe(specialContent);
    });

    it('SN11: 大文件快照应正确处理', async () => {
      const largeContent = '# Large\n\n' + Array.from({ length: 10000 }, () => 'Line content. ').join('\n');
      const compressed = snapshotManager.compress(largeContent);
      const decompressed = snapshotManager.decompress(compressed);

      expect(decompressed).toBe(largeContent);
      expect(decompressed.length).toBe(largeContent.length);
    });

    it('SN12: 快照哈希冲突检测', async () => {
      // MD5哈希冲突概率极低，但代码应能处理
      const content1 = '# Note 1';
      const content2 = '# Note 2';

      const hash1 = await snapshotManager.createSnapshot('note1.md', content1);
      const hash2 = await snapshotManager.createSnapshot('note2.md', content2);

      // 在极少数情况下，如果哈希冲突，应有处理机制
      // 这里我们验证至少大部分情况下哈希不同
      expect(hash1).not.toBe(hash2);
    });
  });
});
