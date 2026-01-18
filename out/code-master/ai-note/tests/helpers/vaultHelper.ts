/**
 * 测试 Vault 操作 Helper
 * 提供创建和管理测试 Vault 的工具函数
 */

import type { TFile } from 'obsidian';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TestVaultStructure {
  root: {
    notes?: string[];
    folders?: string[];
  };
}

export class VaultTestHelper {
  private vaultPath: string;
  private createdFiles: Set<string> = new Set();

  constructor(vaultName: string = 'test-vault') {
    this.vaultPath = path.join(os.tmpdir(), `ai-note-test-${Date.now()}-${vaultName}`);
  }

  /**
   * 创建测试笔记
   */
  async createNote(relativePath: string, content: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    const dir = path.dirname(fullPath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(fullPath, content, 'utf-8');
    this.createdFiles.add(fullPath);
  }

  /**
   * 读取笔记内容
   */
  async readNote(relativePath: string): Promise<string> {
    const fullPath = this.getFullPath(relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * 创建测试文件结构
   */
  async createTestVault(structure: TestVaultStructure): Promise<void> {
    // 创建根目录
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
    }

    // 创建 .obsidian 目录
    const obsidianDir = path.join(this.vaultPath, '.obsidian');
    if (!fs.existsSync(obsidianDir)) {
      fs.mkdirSync(obsidianDir, { recursive: true });
    }

    // 创建配置文件
    const configFile = path.join(obsidianDir, 'plugins.json');
    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, '{}', 'utf-8');
    }

    // 创建笔记
    if (structure.root.notes) {
      for (const notePath of structure.root.notes) {
        await this.createNote(notePath, `# ${notePath}\n\nTest content.`);
      }
    }

    // 创建文件夹
    if (structure.root.folders) {
      for (const folderPath of structure.root.folders) {
        const fullPath = this.getFullPath(folderPath);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      }
    }
  }

  /**
   * 检查笔记是否存在
   */
  noteExists(relativePath: string): boolean {
    const fullPath = this.getFullPath(relativePath);
    return fs.existsSync(fullPath);
  }

  /**
   * 删除笔记
   */
  deleteNote(relativePath: string): void {
    const fullPath = this.getFullPath(relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.createdFiles.delete(fullPath);
    }
  }

  /**
   * 移动笔记
   */
  moveNote(oldRelativePath: string, newRelativePath: string): void {
    const fullOldPath = this.getFullPath(oldRelativePath);
    const fullNewPath = this.getFullPath(newRelativePath);

    if (fs.existsSync(fullOldPath)) {
      fs.mkdirSync(path.dirname(fullNewPath), { recursive: true });
      fs.renameSync(fullOldPath, fullNewPath);
      this.createdFiles.delete(fullOldPath);
      this.createdFiles.add(fullNewPath);
    }
  }

  /**
   * 重命名/移动笔记（别名方法）
   */
  async renameNote(oldRelativePath: string, newRelativePath: string): Promise<void> {
    this.moveNote(oldRelativePath, newRelativePath);
  }

  /**
   * 列出目录内容
   */
  listDir(relativePath: string = ''): string[] {
    const fullPath = this.getFullPath(relativePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    return fs.readdirSync(fullPath);
  }

  /**
   * 获取所有笔记路径
   */
  getAllNotes(relativePath: string = '', extension: string = '.md'): string[] {
    const fullPath = this.getFullPath(relativePath);
    const notes: string[] = [];

    if (!fs.existsSync(fullPath)) {
      return notes;
    }

    const scanDir = (dir: string, baseRelPath: string = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relPath = baseRelPath ? path.join(baseRelPath, item) : item;
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // 跳过隐藏目录（以 . 开头）
          if (!item.startsWith('.')) {
            scanDir(itemPath, relPath);
          }
        } else if (item.endsWith(extension)) {
          notes.push(relPath);
        }
      }
    };

    scanDir(fullPath);
    return notes;
  }

  /**
   * 创建 Mock TFile 对象
   */
  createMockFile(relativePath: string): TFile {
    const fullPath = this.getFullPath(relativePath);
    const stat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : { ctime: Date.now(), mtime: Date.now(), size: 0 };

    return {
      path: relativePath,
      name: relativePath.split('/').pop() || '',
      basename: relativePath.replace(/\.md$/, '').split('/').pop() || '',
      extension: 'md',
      stat,
    } as TFile;
  }

  /**
   * 清理测试数据
   */
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.vaultPath)) {
      fs.rmSync(this.vaultPath, { recursive: true, force: true });
    }
    this.createdFiles.clear();
  }

  /**
   * 获取 Vault 路径
   */
  getPath(): string {
    return this.vaultPath;
  }

  /**
   * 获取完整路径
   */
  private getFullPath(relativePath: string): string {
    return path.join(this.vaultPath, relativePath);
  }

  /**
   * 获取创建的文件列表
   */
  getCreatedFiles(): string[] {
    return Array.from(this.createdFiles);
  }

  /**
   * 列出所有文件夹
   */
  listFolders(): string[] {
    const folders: string[] = [];
    const scanDir = (dir: string, baseRelPath: string = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relPath = baseRelPath ? path.join(baseRelPath, item) : item;
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.')) {
          folders.push(relPath);
          scanDir(itemPath, relPath);
        }
      }
    };

    if (fs.existsSync(this.vaultPath)) {
      scanDir(this.vaultPath);
    }
    return folders;
  }

  /**
   * 列出文件夹中的所有笔记
   */
  listNotesInFolder(relativePath: string = ''): string[] {
    const fullPath = this.getFullPath(relativePath);
    const notes: string[] = [];

    if (!fs.existsSync(fullPath)) {
      return notes;
    }

    const items = fs.readdirSync(fullPath);
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith('.md') && !item.startsWith('.')) {
        const relPath = relativePath ? path.join(relativePath, item) : item;
        notes.push(relPath);
      }
    }

    return notes;
  }

  /**
   * 等待文件创建
   */
  async waitForFile(relativePath: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const fullPath = this.getFullPath(relativePath);

    while (Date.now() - startTime < timeout) {
      if (fs.existsSync(fullPath)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * 读取并解析 frontmatter
   */
  getFrontmatter(relativePath: string): Record<string, any> {
    const content = fs.readFileSync(this.getFullPath(relativePath), 'utf-8');
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) return {};

    const frontmatter: Record<string, any> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }
}

/**
 * 预设的测试 Vault 配置
 */
export const TestVaultPresets = {
  basic: {
    root: {
      notes: ['Inbox/test-note.md'],
      folders: ['Archives', 'Reviews', 'Research'],
    },
  },

  archive: {
    root: {
      notes: [
        'Inbox/note1.md',
        'Inbox/note2.md',
      ],
      folders: ['Archives/2023', 'Archives/2024'],
    },
  },

  review: {
    root: {
      notes: [
        'Reviews/draft.md',
        'Reviews/reviewed.md',
      ],
      folders: [],
    },
  },
};

/**
 * 创建测试 Vault 的工厂函数
 */
export async function createTestVault(
  vaultName?: string,
  structure?: TestVaultStructure
): Promise<VaultTestHelper> {
  const helper = new VaultTestHelper(vaultName);
  if (structure) {
    await helper.createTestVault(structure);
  }
  return helper;
}
