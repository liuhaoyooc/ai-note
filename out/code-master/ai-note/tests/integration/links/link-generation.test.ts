/**
 * 链接生成集成测试
 * @P0
 * 测试Obsidian双向链接和嵌入的生成与解析
 *
 * 测试计划 v2.1 - 11个测试用例
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

interface LinkInfo {
  type: 'link' | 'embed';
  target: string;
  position: { line: number; column: number };
}

class LinkService {
  private vault: VaultTestHelper;

  constructor(vault: VaultTestHelper) {
    this.vault = vault;
  }

  /**
   * 解析内容中的链接
   */
  parseLinks(content: string): LinkInfo[] {
    const links: LinkInfo[] = [];
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // 匹配 ![[嵌入]] 或 [[链接]]
      const linkRegex = /!?\[\[([^\]]+)\]\]/g;
      let match;

      while ((match = linkRegex.exec(line)) !== null) {
        const fullMatch = match[0]; // 包含 ! 或 [
        const innerMatch = match[1]; // 只包含链接内容
        const isEmbed = fullMatch.startsWith('!');

        // 解析目标和别名
        let target = innerMatch;
        let alias: string | undefined;

        if (innerMatch.includes('|')) {
          const parts = innerMatch.split('|');
          target = parts[0];
          alias = parts[1];
        }

        links.push({
          type: isEmbed ? 'embed' : 'link',
          target,
          position: { line: lineNum + 1, column: match.index + 1 },
        });
      }
    }

    return links;
  }

  /**
   * 生成双向链接
   */
  generateLink(target: string, alias?: string): string {
    if (alias) {
      return `[[${target}|${alias}]]`;
    }
    return `[[${target}]]`;
  }

  /**
   * 生成嵌入
   */
  generateEmbed(target: string, alias?: string): string {
    if (alias) {
      return `![[${target}|${alias}]]`;
    }
    return `![[${target}]]`;
  }

  /**
   * 提取链接中的目标和别名
   */
  parseLink(linkText: string): { target: string; alias?: string } {
    // 移除开头的 !（如果有）然后解析
    const cleanText = linkText.startsWith('!') ? linkText.substring(1) : linkText;
    const match = cleanText.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]/);
    if (!match) {
      throw new Error('Invalid link format');
    }

    return {
      target: match[1],
      alias: match[2],
    };
  }

  /**
   * 获取反向链接
   */
  async getBacklinks(targetPath: string): Promise<string[]> {
    const notes = this.vault.getAllNotes();
    const backlinks: string[] = [];

    // 检查目标文件是否存在
    const targetExists = this.vault.noteExists(targetPath);
    if (!targetExists) {
      return backlinks;
    }

    for (const notePath of notes) {
      if (notePath === targetPath) continue;

      const content = await this.vault.readNote(notePath);
      const links = this.parseLinks(content);

      for (const link of links) {
        // 过滤嵌入类型的链接
        if (link.type === 'embed') {
          continue;
        }

        // 只检查链接是否精确指向目标
        if (link.target === targetPath) {
          backlinks.push(notePath);
          break;
        }

        // 也检查无扩展名的匹配
        const targetWithoutExt = targetPath.replace(/\.md$/, '');
        if (link.target === targetWithoutExt) {
          backlinks.push(notePath);
          break;
        }
      }
    }

    return backlinks;
  }
}

describe('链接生成集成测试', () => {
  let vault: VaultTestHelper;
  let linkService: LinkService;

  beforeEach(async () => {
    vault = new VaultTestHelper('link-test');
    linkService = new LinkService(vault);
  });

  afterEach(async () => {
    await vault.cleanup();
  });

  // ========================================
  // 基本功能
  // ========================================

  describe('L1-L4: 基本功能', () => {
    it('L1: 应生成正确的双向链接格式', () => {
      const link = linkService.generateLink('Note Title');

      expect(link).toBeValidObsidianLink();
      expect(link).toBe('[[Note Title]]');
    });

    it('L2: 应生成带别名的链接', () => {
      const link = linkService.generateLink('Note Title', '别名');

      expect(link).toBe('[[Note Title|别名]]');
    });

    it('L3: 应生成正确的嵌入格式', () => {
      const embed = linkService.generateEmbed('Image.png');

      expect(embed).toBeValidObsidianEmbed();
      expect(embed).toBe('![[Image.png]]');
    });

    it('L4: 应生成带别名的嵌入', () => {
      const embed = linkService.generateEmbed('Note Title', '显示文本');

      expect(embed).toBe('![[Note Title|显示文本]]');
    });
  });

  // ========================================
  // 解析功能
  // ========================================

  describe('L5-L8: 解析功能', () => {
    it('L5: 应正确解析简单链接', () => {
      const parsed = linkService.parseLink('[[Note Title]]');

      expect(parsed.target).toBe('Note Title');
      expect(parsed.alias).toBeUndefined();
    });

    it('L6: 应正确解析带别名的链接', () => {
      const parsed = linkService.parseLink('[[Note Title|别名]]');

      expect(parsed.target).toBe('Note Title');
      expect(parsed.alias).toBe('别名');
    });

    it('L7: 应正确解析嵌入', () => {
      const parsed = linkService.parseLink('![[Note Title]]');

      expect(parsed.target).toBe('Note Title');
      expect(parsed.alias).toBeUndefined();
    });

    it('L8: 应正确解析内容中的所有链接', () => {
      const content = `# Test\n\nSee [[Note1]] and [[Note2|别名]].\nAlso ![[Image.png]].`;

      const links = linkService.parseLinks(content);

      expect(links).toHaveLength(3);
      expect(links[0].type).toBe('link');
      expect(links[0].target).toBe('Note1');
      expect(links[1].type).toBe('link');
      expect(links[1].target).toBe('Note2');
      expect(links[2].type).toBe('embed');
      expect(links[2].target).toBe('Image.png');
    });
  });

  // ========================================
  // 反向链接
  // ========================================

  describe('L9-L11: 反向链接', () => {
    it('L9: 应获取链接到目标的所有笔记', async () => {
      await vault.createNote('target.md', '# Target\n\nContent here.');
      await vault.createNote('source1.md', '# Source 1\n\nSee [[target]].');
      await vault.createNote('source2.md', '# Source 2\n\nLink to [[target.md]].');

      const backlinks = await linkService.getBacklinks('target.md');

      expect(backlinks).toHaveLength(2);
      expect(backlinks).toContain('source1.md');
      expect(backlinks).toContain('source2.md');
    });

    it('L10: 嵌入不计入反向链接', async () => {
      await vault.createNote('target.md', '# Target');
      await vault.createNote('source.md', '# Source\n\n![[target]]');

      const backlinks = await linkService.getBacklinks('target.md');

      // 嵌入不算反向链接
      expect(backlinks).toHaveLength(0);
    });

    it('L11: 应处理不存在的目标', async () => {
      await vault.createNote('source.md', '# Source\n\n[[non-existent]]');

      const backlinks = await linkService.getBacklinks('non-existent.md');

      expect(backlinks).toHaveLength(0);
    });
  });
});
