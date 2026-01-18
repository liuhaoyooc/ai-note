/**
 * 测试用 Plugin 类
 * 提供简化的 Plugin 实现用于测试
 */

import type { App, Plugin, TFile, TFolder, Vault, MetadataCache } from 'obsidian';
import type { AiNoteSettings } from '../../src/types';
import { VaultTestHelper } from './vaultHelper';
import { AIMockHelper } from './aiMock';

/**
 * Mock App 接口
 */
export interface MockApp {
  vault: Partial<Vault>;
  metadataCache: Partial<MetadataCache>;
  workspace: any;
}

/**
 * 测试用 Plugin 类
 */
export class TestPlugin {
  public app: MockApp;
  public vaultHelper: VaultTestHelper;
  public aiMockHelper: AIMockHelper;
  public settings: AiNoteSettings;
  public isLoaded: boolean = false;

  constructor(vaultHelper: VaultTestHelper) {
    this.vaultHelper = vaultHelper;
    this.aiMockHelper = new AIMockHelper();
    this.app = this.createMockApp();
    this.settings = this.getDefaultSettings();
  }

  /**
   * 创建 Mock App 对象
   */
  private createMockApp(): MockApp {
    return {
      vault: this.createMockVault(),
      metadataCache: this.createMockMetadataCache(),
      workspace: this.createMockWorkspace(),
    };
  }

  /**
   * 创建 Mock Vault
   */
  private createMockVault(): Partial<Vault> {
    return {
      getAbstractFileByPath: (path: string) => {
        if (this.vaultHelper.noteExists(path)) {
          return this.createMockFile(path);
        }
        return null;
      },

      create: async (path: string, data: string) => {
        await this.vaultHelper.createNote(path, data);
        return this.createMockFile(path);
      },

      read: async (file: TFile) => {
        return this.vaultHelper.readNote(file.path);
      },

      modify: async (file: TFile, data: string) => {
        await this.vaultHelper.createNote(file.path, data);
      },

      delete: async (file: TFile) => {
        this.vaultHelper.deleteNote(file.path);
      },

      rename: async (file: TFile, newPath: string) => {
        this.vaultHelper.moveNote(file.path, newPath);
      },

      getAllLoadedFiles: () => {
        const notes = this.vaultHelper.getAllNotes();
        return notes.map(path => this.createMockFile(path));
      },

      getRoot: () => {
        return this.createMockFolder('');
      },

      adapter: {
        basePath: this.vaultHelper.getPath(),
      },
    } as Partial<Vault>;
  }

  /**
   * 创建 Mock MetadataCache
   */
  private createMockMetadataCache(): Partial<MetadataCache> {
    return {
      getCache: (file: TFile) => {
        const content = this.vaultHelper.readNote(file.path);
        return this.parseFrontmatter(content);
      },

      getFileCache: (file: TFile) => {
        const content = this.vaultHelper.readNote(file.path);
        return {
          frontmatter: this.parseFrontmatter(content),
          tags: this.extractTags(content),
          links: this.extractLinks(content),
          headings: this.extractHeadings(content),
        };
      },

      on: (event: string, callback: any) => {
        // Mock event registration
      },

      off: (event: string, callback: any) => {
        // Mock event deregistration
      },
    } as Partial<MetadataCache>;
  }

  /**
   * 创建 Mock Workspace
   */
  private createMockWorkspace(): any {
    return {
      activeLeaf: {
        view: {
          file: null,
          editor: {
            getValue: () => '',
            setValue: (value: string) => {},
            getSelection: () => ({ from: 0, to: 0 }),
            replaceSelection: (text: string) => {},
          },
          save: async () => {},
        },
      },

      getActiveFile: () => null,
      getActiveViewOfType: () => null,

      openLinkText: async (text: string, sourcePath: string) => {
        // Mock implementation
      },

      on: (event: string, callback: any) => {
        // Mock event registration
      },

      off: (event: string, callback: any) => {
        // Mock event deregistration
      },
    };
  }

  /**
   * 创建 Mock File
   */
  private createMockFile(path: string): TFile {
    const exists = this.vaultHelper.noteExists(path);
    const stat = exists ? this.getFileStat(path) : { ctime: Date.now(), mtime: Date.now(), size: 0 };

    return {
      path,
      name: path.split('/').pop() || '',
      basename: path.replace(/\.md$/, '').split('/').pop() || '',
      extension: 'md',
      stat,
    } as TFile;
  }

  /**
   * 创建 Mock Folder
   */
  private createMockFolder(path: string): TFolder {
    const children = this.vaultHelper.listDir(path);
    return {
      path,
      name: path.split('/').pop() || '/',
      children: children.map(child => {
        const childPath = path ? `${path}/${child}` : child;
        if (child.endsWith('.md')) {
          return this.createMockFile(childPath) as any;
        } else {
          return this.createMockFolder(childPath);
        }
      }),
      isRoot: path === '',
    } as TFolder;
  }

  /**
   * 获取文件状态
   */
  private getFileStat(path: string): { ctime: number; mtime: number; size: number } {
    const fullPath = this.vaultHelper.getPath() + '/' + path;
    // 这里简化实现，实际应该读取真实文件状态
    return {
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0,
    };
  }

  /**
   * 解析 Frontmatter
   */
  private parseFrontmatter(content: string): any {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) return {};

    const frontmatter: any = {};
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

  /**
   * 提取标签
   */
  private extractTags(content: string): any[] {
    const tagRegex = /#([\w\u4e00-\u9fa5]+)/g;
    const tags: any[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      tags.push({
        tag: match[1],
      });
    }

    return tags;
  }

  /**
   * 提取链接
   */
  private extractLinks(content: string): any[] {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: any[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push({
        link: match[1],
        displayText: match[1],
      });
    }

    return links;
  }

  /**
   * 提取标题
   */
  private extractHeadings(content: string): any[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: any[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        heading: match[2],
      });
    }

    return headings;
  }

  /**
   * 模拟插件加载
   */
  async onload(): Promise<void> {
    this.isLoaded = true;
  }

  /**
   * 模拟插件卸载
   */
  async onunload(): Promise<void> {
    this.isLoaded = false;
    await this.vaultHelper.cleanup();
  }

  /**
   * 设置插件设置
   */
  setSettings(settings: Partial<AiNoteSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * 获取默认设置
   */
  getDefaultSettings(): AiNoteSettings {
    return {
      apiKey: 'test-key',
      paths: {
        reviewsDir: '复盘',
        researchDir: '调研',
        unsortedDir: '待整理',
      },
      review: {
        maxDiffLines: 1000,
        dayBoundary: 'natural',
      },
      research: {
        enabled: true,
        scheduler: {
          enabled: true,
          time: '10:00',
        },
      },
      archiving: {
        hiddenDirectories: ['.obsidian', '.git'],
      },
    };
  }

  /**
   * 获取设置
   */
  getSettings(): AiNoteSettings {
    return this.settings;
  }

  /**
   * 模拟加载设置
   */
  async loadSettings(): Promise<void> {
    // Mock implementation
  }

  /**
   * 模拟保存设置
   */
  async saveSettings(): Promise<void> {
    // Mock implementation
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.vaultHelper.cleanup();
    this.aiMockHelper.clearRecordings();
  }

  /**
   * 获取 Mock App
   */
  getApp(): MockApp {
    return this.app;
  }

  /**
   * 获取 AI Mock Helper
   */
  getAIMockHelper(): AIMockHelper {
    return this.aiMockHelper;
  }

  /**
   * 获取 Vault Helper
   */
  getVaultHelper(): VaultTestHelper {
    return this.vaultHelper;
  }
}

/**
 * 创建测试 Plugin 的工厂函数
 */
export async function createTestPlugin(
  vaultName?: string,
  structure?: any
): Promise<TestPlugin> {
  const vaultHelper = new VaultTestHelper(vaultName);
  if (structure) {
    await vaultHelper.createTestVault(structure);
  }
  return new TestPlugin(vaultHelper);
}

/**
 * 从现有的 Plugin 创建测试版本
 */
export function wrapPlugin(plugin: Plugin): TestPlugin {
  const vaultHelper = new VaultTestHelper('wrapped-plugin');
  const testPlugin = new TestPlugin(vaultHelper);
  testPlugin.setSettings((plugin as any).settings || testPlugin.getDefaultSettings());
  return testPlugin;
}
