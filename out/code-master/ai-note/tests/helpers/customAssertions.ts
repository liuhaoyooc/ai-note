/**
 * 自定义断言库
 * 扩展 Vitest expect 以支持特定领域的断言
 */

import { expect } from 'vitest';
import { zlib } from 'zlib';

// 类型定义
interface SummaryStructure {
  path: string;
  title: string;
  summary: string;
  keywords: string[];
  contentHash: string;
  lastUpdated: string;
}

interface FolderSummaryStructure {
  path: string;
  theme: string;
  sampleNotes: string[];
  noteCount: number;
  lastUpdated: string;
}

interface SnapshotStructure {
  hash: string;
  content: string;
  compressed: boolean;
  createdAt: string;
}

interface ArchiveResult {
  targetPath: string;
  confidence: number;
  reason?: string;
}

interface ClassifyResult {
  filePath: string;
  category: string;
  confidence: number;
  uncertain: boolean;
}

// 扩展 Vitest expect 类型
declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

interface CustomMatchers<R = any> {
  /**
   * 验证是否是有效的 Obsidian 双向链接格式
   * 示例: [[Note Title]], [[Folder/Note Title]]
   */
  toBeValidObsidianLink(): R;

  /**
   * 验证是否是有效的 Obsidian 嵌入格式
   * 示例: ![[Image.png]], ![[Folder/Note Title#Heading]]
   */
  toBeValidObsidianEmbed(): R;

  /**
   * 验证摘要结构是否完整
   */
  toHaveValidSummaryStructure(): R;

  /**
   * 验证文件夹摘要结构是否完整
   */
  toHaveValidFolderSummaryStructure(): R;

  /**
   * 验证快照结构是否完整且可解压
   */
  toBeValidSnapshot(): R;

  /**
   * 验证是否是有效的 MD5 哈希值
   */
  toBeValidMD5Hash(): R;

  /**
   * 验证归档结果的置信度是否达到阈值
   */
  toHaveConfidenceAtLeast(threshold: number): R;

  /**
   * 验证分类结果是否确定
   */
  toBeCertainClassification(): R;

  /**
   * 验证分类结果是否不确定
   */
  toBeUncertainClassification(): R;

  /**
   * 验证是否是有效的相对路径
   */
  toBeValidRelativePath(): R;

  /**
   * 验证是否是有效的 ISO 8601 日期字符串
   */
  toBeValidISODate(): R;

  /**
   * 验证两个集合的 Jaccard 相似度是否接近预期值
   */
  toHaveJaccardSimilarity(other: string[] | Set<string>, expected: number, delta?: number): R;

  /**
   * 验证是否是有效的调研主题类型
   */
  toBeValidResearchTopicType(): R;

  /**
   * 验证是否是有效的归档类别
   */
  toBeValidArchiveCategory(): R;

  /**
   * 验证是否是有效的文件扩展名
   */
  toHaveValidFileExtension(...extensions: string[]): R;

  /**
   * 验证时间字符串是否在指定范围内
   */
  toBeWithinTimeRange(start: Date, end: Date): R;

  /**
   * 验证数组是否按指定字段排序
   */
  toBeSortedBy(field: string, order?: 'asc' | 'desc'): R;

  /**
   * 验证是否是有效的压缩数据 (gzip)
   */
  toBeValidGzipData(): R;

  /**
   * 验证 YAML frontmatter 是否有效
   */
  toHaveValidYAMLFrontmatter(): R;

  /**
   * 验证标签格式是否符合 Obsidian 规范
   */
  toBeValidObsidianTag(): R;
}

// Obsidian 双向链接断言
expect.extend({
  toBeValidObsidianLink(received: string) {
    const isValid = /^\[\[.+\]\]$/.test(received);
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid Obsidian link`
          : `Expected "${received}" to be a valid Obsidian link (format: [[Link]])`,
    };
  },
});

// Obsidian 嵌入断言
expect.extend({
  toBeValidObsidianEmbed(received: string) {
    const isValid = /^!\[\[.+\]\](\#.*)?$/.test(received);
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid Obsidian embed`
          : `Expected "${received}" to be a valid Obsidian embed (format: ![[Embed]] or ![[Embed#Heading])`,
    };
  },
});

// 摘要结构断言
expect.extend({
  toHaveValidSummaryStructure(received: any) {
    const requiredFields = ['path', 'title', 'summary', 'keywords', 'contentHash', 'lastUpdated'];

    const missingFields = requiredFields.filter(field => !(field in received));

    const isHashValid = received.contentHash && /^[a-f0-9]{32}$/i.test(received.contentHash);
    const isKeywordsValid = Array.isArray(received.keywords);
    const isDateValid = received.lastUpdated && !isNaN(Date.parse(received.lastUpdated));

    const pass = missingFields.length === 0 && isHashValid && isKeywordsValid && isDateValid;

    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Missing required fields: ${missingFields.join(', ')}`;
        }
        if (!isHashValid) {
          return `contentHash "${received.contentHash}" is not a valid MD5 hash`;
        }
        if (!isKeywordsValid) {
          return `keywords must be an array`;
        }
        if (!isDateValid) {
          return `lastUpdated "${received.lastUpdated}" is not a valid ISO date`;
        }
        return `Expected summary structure to be valid`;
      },
    };
  },
});

// 文件夹摘要结构断言
expect.extend({
  toHaveValidFolderSummaryStructure(received: any) {
    const requiredFields = ['path', 'theme', 'sampleNotes', 'noteCount', 'lastUpdated'];

    const missingFields = requiredFields.filter(field => !(field in received));

    const isSampleNotesValid = Array.isArray(received.sampleNotes) && received.sampleNotes.length <= 10;
    const isNoteCountValid = typeof received.noteCount === 'number' && received.noteCount >= 0;
    const isDateValid = received.lastUpdated && !isNaN(Date.parse(received.lastUpdated));

    const pass = missingFields.length === 0 && isSampleNotesValid && isNoteCountValid && isDateValid;

    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Missing required fields: ${missingFields.join(', ')}`;
        }
        if (!isSampleNotesValid) {
          return `sampleNotes must be an array with at most 10 items`;
        }
        if (!isNoteCountValid) {
          return `noteCount must be a non-negative number`;
        }
        if (!isDateValid) {
          return `lastUpdated "${received.lastUpdated}" is not a valid ISO date`;
        }
        return `Expected folder summary structure to be valid`;
      },
    };
  },
});

// 快照结构断言
expect.extend({
  toBeValidSnapshot(received: any) {
    const requiredFields = ['hash', 'content', 'createdAt'];

    const missingFields = requiredFields.filter(field => !(field in received));

    const isHashValid = received.hash && /^[a-f0-9]{32}$/i.test(received.hash);
    const isDateValid = received.createdAt && !isNaN(Date.parse(received.createdAt));

    let canDecompress = true;
    let decompressError = '';
    if (received.compressed && received.content) {
      try {
        const buffer = Buffer.from(received.content, 'base64');
        // 简单验证：检查是否看起来像 gzip 数据
        canDecompress = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
      } catch (e) {
        canDecompress = false;
        decompressError = (e as Error).message;
      }
    }

    const pass = missingFields.length === 0 && isHashValid && isDateValid && canDecompress;

    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Missing required fields: ${missingFields.join(', ')}`;
        }
        if (!isHashValid) {
          return `hash "${received.hash}" is not a valid MD5 hash`;
        }
        if (!isDateValid) {
          return `createdAt "${received.createdAt}" is not a valid ISO date`;
        }
        if (!canDecompress) {
          return `Compressed content is invalid: ${decompressError}`;
        }
        return `Expected snapshot structure to be valid`;
      },
    };
  },
});

// MD5 哈希断言
expect.extend({
  toBeValidMD5Hash(received: string) {
    const isValid = /^[a-f0-9]{32}$/i.test(received);
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid MD5 hash`
          : `Expected "${received}" to be a valid MD5 hash (32 hexadecimal characters)`,
    };
  },
});

// 置信度断言
expect.extend({
  toHaveConfidenceAtLeast(received: ArchiveResult | ClassifyResult, threshold: number) {
    const pass = received.confidence >= threshold;
    return {
      pass,
      message: () =>
        pass
          ? `Expected confidence ${received.confidence} not to be at least ${threshold}`
          : `Expected confidence ${received.confidence} to be at least ${threshold}`,
    };
  },
});

// 分类确定性断言
expect.extend({
  toBeCertainClassification(received: ClassifyResult) {
    const pass = !received.uncertain && received.confidence >= 0.7;
    return {
      pass,
      message: () =>
        pass
          ? `Expected classification to be uncertain`
          : `Expected classification to be certain (uncertain: ${received.uncertain}, confidence: ${received.confidence})`,
    };
  },
});

expect.extend({
  toBeUncertainClassification(received: ClassifyResult) {
    const pass = received.uncertain || received.confidence < 0.7;
    return {
      pass,
      message: () =>
        pass
          ? `Expected classification to be certain`
          : `Expected classification to be uncertain (uncertain: ${received.uncertain}, confidence: ${received.confidence})`,
    };
  },
});

// 相对路径断言
expect.extend({
  toBeValidRelativePath(received: string) {
    // 检查不是绝对路径，不包含 .. 驱动器等
    const isAbsolute = /^([A-Za-z]:)?[\/\\]/.test(received);
    const hasParentRef = received.includes('..');
    const isValid = !isAbsolute && !hasParentRef && received.length > 0;

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid relative path`
          : `Expected "${received}" to be a valid relative path (not absolute, no parent references)`,
    };
  },
});

// ISO 日期断言
expect.extend({
  toBeValidISODate(received: string) {
    const isValid = !isNaN(Date.parse(received)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(received);
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid ISO date`
          : `Expected "${received}" to be a valid ISO 8601 date`,
    };
  },
});

// Jaccard 相似度断言
expect.extend({
  toHaveJaccardSimilarity(
    received: string[] | Set<string>,
    other: string[] | Set<string>,
    expected: number,
    delta = 0.05
  ) {
    const set1 = new Set(Array.isArray(received) ? received : [...received]);
    const set2 = new Set(Array.isArray(other) ? other : [...other]);

    // 计算 Jaccard 相似度: |A ∩ B| / |A ∪ B|
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const actual = union.size > 0 ? intersection.size / union.size : 0;
    const pass = Math.abs(actual - expected) <= delta;

    return {
      pass,
      message: () =>
        pass
          ? `Expected Jaccard similarity ${actual} not to be close to ${expected}`
          : `Expected Jaccard similarity ${actual} to be close to ${expected} (±${delta}). Intersection: ${intersection.size}, Union: ${union.size}`,
    };
  },
});

// 调研主题类型断言
expect.extend({
  toBeValidResearchTopicType(received: string) {
    const validTypes = ['trending', 'problem-solving', 'deep-dive', 'inspiration'];
    const isValid = validTypes.includes(received);
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid research topic type`
          : `Expected "${received}" to be one of: ${validTypes.join(', ')}`,
    };
  },
});

// 归档类别断言
expect.extend({
  toBeValidArchiveCategory(received: string) {
    // 根据测试计划，类别可以是以下几种
    const validCategories = [
      '技术',
      '设计',
      '产品',
      '管理',
      '学习',
      '生活',
      '灵感',
      '待整理',
      // 或者任何其他有效的类别名称
    ];
    const isValid = received && received.length > 0 && received.length <= 50;
    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid archive category`
          : `Expected "${received}" to be a non-empty string (max 50 characters)`,
    };
  },
});

// 文件扩展名断言
expect.extend({
  toHaveValidFileExtension(received: string, ...extensions: string[]) {
    const ext = received.split('.').pop()?.toLowerCase();
    const pass = ext && extensions.map(e => e.toLowerCase().replace('.', '')).includes(ext);
    return {
      pass,
      message: () =>
        pass
          ? `Expected "${received}" not to have one of these extensions: ${extensions.join(', ')}`
          : `Expected "${received}" to have one of these extensions: ${extensions.join(', ')}`,
    };
  },
});

// 时间范围断言
expect.extend({
  toBeWithinTimeRange(received: string | Date, start: Date, end: Date) {
    const date = typeof received === 'string' ? new Date(received) : received;
    const pass = date >= start && date <= end;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within ${start.toISOString()} and ${end.toISOString()}`
          : `Expected ${received} to be within ${start.toISOString()} and ${end.toISOString()}`,
    };
  },
});

// 排序断言
expect.extend({
  toBeSortedBy(received: any[], field: string, order: 'asc' | 'desc' = 'asc') {
    for (let i = 1; i < received.length; i++) {
      const prev = received[i - 1][field];
      const curr = received[i][field];
      const compare = order === 'asc' ? prev <= curr : prev >= curr;
      if (!compare) {
        return {
          pass: false,
          message: () =>
            `Array not sorted by ${field} in ${order} order at index ${i - 1}: ${prev} vs ${curr}`,
        };
      }
    }
    return {
      pass: true,
      message: () => `Expected array not to be sorted by ${field} in ${order} order`,
    };
  },
});

// Gzip 数据断言
expect.extend({
  toBeValidGzipData(received: Buffer | string) {
    const buffer = typeof received === 'string' ? Buffer.from(received, 'base64') : received;

    // Gzip magic number: 0x1f 0x8b
    const isValid = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected data not to be valid gzip`
          : `Expected data to be valid gzip (magic number: 0x1f 0x8b)`,
    };
  },
});

// YAML frontmatter 断言
expect.extend({
  toHaveValidYAMLFrontmatter(received: string) {
    const yamlRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const hasYAML = yamlRegex.test(received);

    // 基本验证：检查是否有成对的 ---
    const match = received.match(/^---+/g);
    const isValid = match && match.length >= 2;

    return {
      pass: hasYAML && isValid,
      message: () =>
        hasYAML && isValid
          ? `Expected content not to have valid YAML frontmatter`
          : `Expected content to have valid YAML frontmatter (format: ---\nkey: value\n---)`,
    };
  },
});

// Obsidian 标签断言
expect.extend({
  toBeValidObsidianTag(received: string) {
    // Obsidian 标签格式: #tag, #nested/tag, #multi-word-tag
    const isValid = /^#[a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5\/\-_]*/.test(received);

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid Obsidian tag`
          : `Expected "${received}" to be a valid Obsidian tag (format: #tag or #nested/tag)`,
    };
  },
});

export {};
