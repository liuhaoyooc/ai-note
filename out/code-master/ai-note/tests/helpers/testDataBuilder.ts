/**
 * 测试数据构建器
 * 使用 Builder 模式创建测试数据
 */

import type { TFile } from 'obsidian';
import type { NoteSummary, SnapshotEntry } from '../../src/types';

export interface NoteData {
  path: string;
  content: string;
  frontmatter?: Record<string, any>;
  tags?: string[];
  links?: string[];
}

// 测试用的 Snapshot 类型
export interface TestSnapshot {
  hash: string;
  content: string;
  timestamp: number;
}

// 测试用的 FolderSummary 类型
export interface TestFolderSummary {
  path: string;
  sampleNotes: string[];
  theme: string;
  noteCount: number;
  lastUpdated: number;
}

export class TestDataBuilder {
  /**
   * 构建测试用的 TFile 对象
   */
  static note(options: {
    path?: string;
    title?: string;
    content?: string;
    tags?: string[];
    frontmatter?: Record<string, any>;
    ctime?: number;
    mtime?: number;
    size?: number;
  }): TFile {
    const {
      path = 'test-note.md',
      title = 'Test Note',
      content = `# ${title}\n\nTest content.`,
      tags = [],
      frontmatter = {},
      ctime = Date.now(),
      mtime = Date.now(),
      size = content.length,
    } = options;

    return {
      path,
      name: path.split('/').pop() || 'test-note.md',
      basename: path.replace(/\.md$/, '').split('/').pop() || 'test-note',
      extension: 'md',
      stat: {
        ctime,
        mtime,
        size,
      },
    } as TFile;
  }

  /**
   * 构建测试用的 NoteSummary 对象
   */
  static summary(options: {
    keywords?: string[];
    questions?: string[];
    summary?: string;
    file_path?: string;
    file_id?: string;
    time_bucket?: 'd15' | 'd45' | 'd180' | 'beyond';
    generated_at?: string;
    file_mtime?: number;
  }): NoteSummary {
    const {
      keywords = [],
      questions = [],
      summary = 'Test summary',
      file_path = 'test/test-note.md',
      file_id = 'test-id',
      time_bucket = 'd15',
      generated_at = new Date().toISOString(),
      file_mtime = Date.now(),
    } = options;

    return {
      file_id,
      file_path,
      summary,
      keywords,
      time_bucket,
      generated_at,
      file_mtime,
    };
  }

  /**
   * 构建测试用的 Snapshot 对象
   */
  static snapshot(options: {
    hash?: string;
    content?: string;
    timestamp?: number;
  }): TestSnapshot {
    const {
      hash = 'test-hash-' + Math.random().toString(36).substring(7),
      content = 'Test snapshot content',
      timestamp = Date.now(),
    } = options;

    return {
      hash,
      content,
      timestamp,
    };
  }

  /**
   * 构建测试用的 SnapshotEntry 对象
   */
  static snapshotEntry(options: {
    hash?: string;
    snapshotFile?: string;
    modifiedTime?: number;
  }): SnapshotEntry {
    const {
      hash = 'test-hash-' + Math.random().toString(36).substring(7),
      snapshotFile = 'test-snapshot.json',
      modifiedTime = Date.now(),
    } = options;

    return {
      hash,
      snapshotFile,
      modifiedTime,
    };
  }

  /**
   * 构建测试用的 FolderSummary 对象
   */
  static folderSummary(options: {
    path?: string;
    sampleNotes?: string[];
    theme?: string;
    noteCount?: number;
    lastUpdated?: number;
  }): TestFolderSummary {
    const {
      path = 'test-folder',
      sampleNotes = [],
      theme = 'Test theme',
      noteCount = sampleNotes.length,
      lastUpdated = Date.now(),
    } = options;

    return {
      path,
      sampleNotes,
      theme,
      noteCount,
      lastUpdated,
    };
  }

  /**
   * 构建完整的笔记数据（包含内容和元数据）
   */
  static fullNote(options: {
    path?: string;
    title?: string;
    content?: string;
    frontmatter?: Record<string, any>;
    tags?: string[];
    links?: string[];
  }): NoteData {
    const {
      path = 'test-note.md',
      title = 'Test Note',
      content = '',
      frontmatter = {},
      tags = [],
      links = [],
    } = options;

    let finalContent = content;

    // 添加 frontmatter
    if (Object.keys(frontmatter).length > 0) {
      const frontmatterStr = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      finalContent = `---\n${frontmatterStr}\n---\n\n${finalContent}`;
    }

    // 添加标题
    if (!finalContent.startsWith('#')) {
      finalContent = `# ${title}\n\n${finalContent}`;
    }

    // 添加标签
    if (tags.length > 0) {
      const tagsStr = tags.map(tag => `#${tag}`).join(' ');
      finalContent += `\n\n${tagsStr}`;
    }

    // 添加链接
    if (links.length > 0) {
      finalContent += '\n\n';
      links.forEach(link => {
        finalContent += `[[${link}]]\n`;
      });
    }

    return {
      path,
      content: finalContent,
      frontmatter,
      tags,
      links,
    };
  }
}

/**
 * NoteData 构建器类
 * 提供链式调用的流畅接口
 */
export class NoteDataBuilder {
  private data: NoteData;

  constructor(path: string = 'test-note.md') {
    this.data = {
      path,
      content: '',
      frontmatter: {},
      tags: [],
      links: [],
    };
  }

  /**
   * 设置笔记路径
   */
  withPath(path: string): NoteDataBuilder {
    this.data.path = path;
    return this;
  }

  /**
   * 设置笔记内容
   */
  withContent(content: string): NoteDataBuilder {
    this.data.content = content;
    return this;
  }

  /**
   * 添加标题
   */
  withTitle(title: string, level: number = 1): NoteDataBuilder {
    const prefix = '#'.repeat(level);
    this.data.content += `${prefix} ${title}\n\n`;
    return this;
  }

  /**
   * 添加段落
   */
  withParagraph(text: string): NoteDataBuilder {
    this.data.content += `${text}\n\n`;
    return this;
  }

  /**
   * 添加代码块
   */
  withCodeBlock(code: string, language: string = ''): NoteDataBuilder {
    this.data.content += '```' + language + '\n';
    this.data.content += code + '\n';
    this.data.content += '```\n\n';
    return this;
  }

  /**
   * 添加列表
   */
  withList(items: string[], ordered: boolean = false): NoteDataBuilder {
    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}.` : '-';
      this.data.content += `${prefix} ${item}\n`;
    });
    this.data.content += '\n';
    return this;
  }

  /**
   * 添加 frontmatter
   */
  withFrontmatter(key: string, value: any): NoteDataBuilder {
    this.data.frontmatter![key] = value;
    return this;
  }

  /**
   * 设置多个 frontmatter
   */
  withFrontmatterData(data: Record<string, any>): NoteDataBuilder {
    this.data.frontmatter = { ...this.data.frontmatter, ...data };
    return this;
  }

  /**
   * 添加标签
   */
  withTag(tag: string): NoteDataBuilder {
    this.data.tags!.push(tag);
    return this;
  }

  /**
   * 添加多个标签
   */
  withTags(tags: string[]): NoteDataBuilder {
    this.data.tags!.push(...tags);
    return this;
  }

  /**
   * 添加链接
   */
  withLink(link: string): NoteDataBuilder {
    this.data.links!.push(link);
    this.data.content += `[[${link}]]\n`;
    return this;
  }

  /**
   * 添加多个链接
   */
  withLinks(links: string[]): NoteDataBuilder {
    links.forEach(link => this.withLink(link));
    return this;
  }

  /**
   * 添加任务列表
   */
  withTasks(tasks: Array<{ text: string; completed: boolean }>): NoteDataBuilder {
    tasks.forEach(task => {
      const checkbox = task.completed ? '[x]' : '[ ]';
      this.data.content += `${checkbox} ${task.text}\n`;
    });
    this.data.content += '\n';
    return this;
  }

  /**
   * 添加引用块
   */
  withBlockquote(text: string): NoteDataBuilder {
    this.data.content += `> ${text}\n\n`;
    return this;
  }

  /**
   * 添加分割线
   */
  withHorizontalRule(): NoteDataBuilder {
    this.data.content += '---\n\n';
    return this;
  }

  /**
   * 构建笔记数据
   */
  build(): NoteData {
    // 如果有 frontmatter，添加到内容开头
    if (Object.keys(this.data.frontmatter!).length > 0) {
      const frontmatterStr = Object.entries(this.data.frontmatter!)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');

      this.data.content = `---\n${frontmatterStr}\n---\n\n` + this.data.content;
    }

    // 如果有标签但没有在内容中，添加到内容末尾
    if (this.data.tags!.length > 0) {
      const tagsInContent = this.data.tags!.map(tag => `#${tag}`).join(' ');
      if (!this.data.content.includes(tagsInContent)) {
        this.data.content += `\n\n${tagsInContent}`;
      }
    }

    return { ...this.data };
  }
}

/**
 * 测试数据预设
 */
export const TestDataPresets = {
  /**
   * 简单笔记
   */
  simpleNote: (): NoteData =>
    new NoteDataBuilder('simple.md')
      .withTitle('Simple Note')
      .withParagraph('This is a simple note.')
      .build(),

  /**
   * 带标签的笔记
   */
  taggedNote: (): NoteData =>
    new NoteDataBuilder('tagged.md')
      .withTitle('Tagged Note')
      .withParagraph('A note with tags.')
      .withTags(['test', 'example'])
      .build(),

  /**
   * 带链接的笔记
   */
  linkedNote: (): NoteData =>
    new NoteDataBuilder('linked.md')
      .withTitle('Linked Note')
      .withParagraph('A note with links.')
      .withLinks(['Note1', 'Note2'])
      .build(),

  /**
   * 带任务的笔记
   */
  taskNote: (): NoteData =>
    new NoteDataBuilder('tasks.md')
      .withTitle('Task Note')
      .withTasks([
        { text: 'Completed task', completed: true },
        { text: 'Pending task', completed: false },
      ])
      .build(),

  /**
   * 带代码块的笔记
   */
  codeNote: (): NoteData =>
    new NoteDataBuilder('code.md')
      .withTitle('Code Note')
      .withCodeBlock('console.log("Hello, World!");', 'javascript')
      .build(),

  /**
   * 完整的笔记
   */
  fullNote: (): NoteData =>
    new NoteDataBuilder('full.md')
      .withTitle('Full Note')
      .withFrontmatter('author', 'Test User')
      .withFrontmatter('date', '2024-01-01')
      .withParagraph('This is a complete note with various elements.')
      .withList(['Item 1', 'Item 2', 'Item 3'])
      .withTasks([
        { text: 'Task 1', completed: false },
        { text: 'Task 2', completed: true },
      ])
      .withCodeBlock('const x = 42;', 'javascript')
      .withBlockquote('This is a quote')
      .withTags(['test', 'full', 'example'])
      .withLinks(['RelatedNote'])
      .build(),

  /**
   * 归档笔记
   */
  archiveNote: (): NoteData =>
    new NoteDataBuilder('archive.md')
      .withTitle('Archive Note')
      .withFrontmatter('archived', true)
      .withFrontmatter('archive-date', new Date().toISOString())
      .withParagraph('This note has been archived.')
      .build(),

  /**
   * 评审笔记
   */
  reviewNote: (): NoteData =>
    new NoteDataBuilder('review.md')
      .withTitle('Review Note')
      .withFrontmatter('status', 'draft')
      .withFrontmatter('review-date', new Date().toISOString())
      .withParagraph('This note is ready for review.')
      .build(),

  /**
   * 研究笔记
   */
  researchNote: (): NoteData =>
    new NoteDataBuilder('research.md')
      .withTitle('Research Note')
      .withFrontmatter('type', 'research')
      .withFrontmatter('topic', 'Test Topic')
      .withParagraph('Research notes on a specific topic.')
      .withCodeBlock('// Research data\nconst data = {};', 'javascript')
      .build(),
};

/**
 * 创建笔记数据构建器的工厂函数
 */
export function createNoteBuilder(path?: string): NoteDataBuilder {
  return new NoteDataBuilder(path);
}
