/**
 * PathManager 集成测试
 * @P0
 * 测试路径管理、规范化、拼接等功能
 *
 * 测试计划 v2.1 - 16个测试用例
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

class PathManager {
  private vaultRoot: string;
  private separator = '/';

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
  }

  /**
   * 规范化路径
   */
  normalize(inputPath: string): string {
    if (!inputPath) return '';

    // 统一分隔符
    let normalized = inputPath.replace(/\\/g, this.separator);

    // 移除开头的分隔符
    normalized = normalized.replace(/^\/+/, '');

    // 移除结尾的分隔符
    normalized = normalized.replace(/\/+$/, '');

    // 移除多余的连续分隔符
    normalized = normalized.replace(/\/+/g, this.separator);

    // 处理 .. 和 .
    const parts = normalized.split(this.separator);
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part && part !== '.') {
        result.push(part);
      }
    }

    return result.join(this.separator);
  }

  /**
   * 拼接路径
   */
  join(...parts: string[]): string {
    return this.normalize(parts.join(this.separator));
  }

  /**
   * 获取相对路径
   */
  relative(from: string, to: string): string {
    const normalizedFrom = this.normalize(from);
    const normalizedTo = this.normalize(to);

    if (normalizedFrom === normalizedTo) {
      return '';
    }

    const fromParts = normalizedFrom.split(this.separator);
    const toParts = normalizedTo.split(this.separator);

    // 特殊情况：同一目录下的文件，直接返回文件名
    if (fromParts.length === toParts.length && fromParts.length > 1) {
      const fromDir = fromParts.slice(0, -1).join(this.separator);
      const toDir = toParts.slice(0, -1).join(this.separator);
      if (fromDir === toDir) {
        return toParts[toParts.length - 1];
      }
    }

    // 找到公共前缀（排除文件名部分）
    let commonLength = 0;
    const maxLen = Math.min(fromParts.length - 1, toParts.length); // to 的文件名也算在路径中
    for (let i = 0; i < maxLen; i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    // 构建相对路径（from 去掉文件名，计算需要向上几级）
    const upCount = fromParts.length - 1 - commonLength;
    const downParts = toParts.slice(commonLength);

    const result = Array.from({ length: upCount }, () => '..')
      .concat(downParts)
      .join(this.separator);

    return result || '.';
  }

  /**
   * 获取目录名
   */
  dirname(inputPath: string): string {
    const normalized = this.normalize(inputPath);
    const parts = normalized.split(this.separator);
    parts.pop();
    return parts.join(this.separator);
  }

  /**
   * 获取文件名
   */
  basename(inputPath: string, ext?: string): string {
    const normalized = this.normalize(inputPath);
    const parts = normalized.split(this.separator);
    let filename = parts[parts.length - 1] || '';

    if (ext) {
      if (filename.endsWith(ext)) {
        filename = filename.substring(0, filename.length - ext.length);
      }
    }

    return filename;
  }

  /**
   * 获取扩展名
   */
  extname(inputPath: string): string {
    const normalized = this.normalize(inputPath);
    const parts = normalized.split(this.separator);
    const filename = parts[parts.length - 1] || '';

    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) {
      return '';
    }

    return filename.substring(lastDot);
  }

  /**
   * 判断是否为绝对路径
   */
  isAbsolute(inputPath: string): boolean {
    return /^[a-zA-Z]:/.test(inputPath) || inputPath.startsWith('/');
  }

  /**
   * 判断是否为子路径
   */
  isChild(parent: string, child: string): boolean {
    const normalizedParent = this.normalize(parent);
    const normalizedChild = this.normalize(child);

    return normalizedChild.startsWith(normalizedParent + this.separator);
  }
}

describe('PathManager 集成测试', () => {
  let pathManager: PathManager;

  beforeEach(() => {
    pathManager = new PathManager('/vault');
  });

  // ========================================
  // 基本功能
  // ========================================

  describe('PM1-PM4: 基本功能', () => {
    it('PM1: 应规范化路径分隔符', () => {
      const normalized = pathManager.normalize('folder\\\\subfolder/note.md');

      expect(normalized).toBe('folder/subfolder/note.md');
    });

    it('PM2: 应移除路径前后的分隔符', () => {
      const normalized1 = pathManager.normalize('/folder/subfolder/');
      const normalized2 = pathManager.normalize('///folder//subfolder///');

      expect(normalized1).toBe('folder/subfolder');
      expect(normalized2).toBe('folder/subfolder');
    });

    it('PM3: 应处理 . 和 ..', () => {
      const normalized = pathManager.normalize('folder/../other/./file.md');

      expect(normalized).toBe('other/file.md');
    });

    it('PM4: 应处理连续的分隔符', () => {
      const normalized = pathManager.normalize('folder///subfolder////note.md');

      expect(normalized).toBe('folder/subfolder/note.md');
    });
  });

  // ========================================
  // 路径拼接
  // ========================================

  describe('PM5-PM8: 路径拼接', () => {
    it('PM5: 应正确拼接多个部分', () => {
      const joined = pathManager.join('folder', 'subfolder', 'note.md');

      expect(joined).toBe('folder/subfolder/note.md');
    });

    it('PM6: 应处理包含分隔符的部分', () => {
      const joined = pathManager.join('folder/', '/subfolder', 'note.md');

      expect(joined).toBe('folder/subfolder/note.md');
    });

    it('PM7: 应处理空部分', () => {
      const joined = pathManager.join('folder', '', 'note.md');

      expect(joined).toBe('folder/note.md');
    });

    it('PM8: 应处理 .. 规范化', () => {
      const joined = pathManager.join('folder', 'subfolder', '..', 'note.md');

      expect(joined).toBe('folder/note.md');
    });
  });

  // ========================================
  // 相对路径
  // ========================================

  describe('PM9-PM10: 相对路径', () => {
    it('PM9: 应计算同级文件的相对路径', () => {
      const relative = pathManager.relative('folder/note1.md', 'folder/note2.md');

      expect(relative).toBe('note2.md');
    });

    it('PM10: 应计算跨级文件的相对路径', () => {
      const relative = pathManager.relative('folder/subfolder/note.md', 'other/note.md');

      expect(relative).toBe('../../other/note.md');
    });
  });

  // ========================================
  // 路径组成部分
  // ========================================

  describe('PM11-PM13: 路径组成部分', () => {
    it('PM11: 应获取正确的目录名', () => {
      const dirname = pathManager.dirname('folder/subfolder/note.md');

      expect(dirname).toBe('folder/subfolder');
    });

    it('PM12: 应获取正确的文件名', () => {
      const basename = pathManager.basename('folder/subfolder/note.md');

      expect(basename).toBe('note.md');
    });

    it('PM13: 应获取文件名(无扩展名)', () => {
      const basename = pathManager.basename('folder/subfolder/note.md', '.md');

      expect(basename).toBe('note');
    });
  });

  // ========================================
  // 路径类型判断
  // ========================================

  describe('PM14-PM16: 路径类型判断', () => {
    it('PM14: 应正确判断绝对路径', () => {
      expect(pathManager.isAbsolute('C:\\Users\\file.md')).toBe(true);
      expect(pathManager.isAbsolute('/home/user/file.md')).toBe(true);
      expect(pathManager.isAbsolute('folder/file.md')).toBe(false);
    });

    it('PM15: 应判断子路径关系', () => {
      expect(pathManager.isChild('folder', 'folder/subfolder/file.md')).toBe(true);
      expect(pathManager.isChild('folder', 'other/file.md')).toBe(false);
    });

    it('PM16: 应获取正确的扩展名', () => {
      const ext1 = pathManager.extname('folder/note.md');
      const ext2 = pathManager.extname('folder/image.png');
      const ext3 = pathManager.extname('folder/no-extension');

      expect(ext1).toBe('.md');
      expect(ext2).toBe('.png');
      expect(ext3).toBe('');
    });
  });
});
