/**
 * AI Mock 和录制工具
 * 用于模拟 AI 响应或录制真实的 AI 调用
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

export type AIMockMode = 'mock' | 'real';

export interface ClassifyResult {
  targetDir: string;
  confidence: number;
  uncertain?: boolean;
}

export class AIMockHelper {
  private mode: AIMockMode = 'mock';
  private recordings: Map<string, any> = new Map();
  private fixtureDir: string;

  constructor(fixtureDir: string = path.join(__dirname, '../fixtures/ai-responses')) {
    this.fixtureDir = fixtureDir;
    // 从环境变量读取模式
    this.mode = (process.env.AI_MODE as AIMockMode) || 'mock';
  }

  /**
   * 设置模式
   */
  setMode(mode: AIMockMode): void {
    this.mode = mode;
  }

  /**
   * 获取当前模式
   */
  getMode(): AIMockMode {
    return this.mode;
  }

  /**
   * Mock AI 分类响应
   */
  mockClassify(results: ClassifyResult[]): void {
    vi.mock('openrouter', () => ({
      classify: vi.fn().mockResolvedValue(results),
    }));
  }

  /**
   * Mock AI 摘要响应
   */
  mockSummary(summary: string, keywords: string[]): void {
    vi.mock('openrouter', () => ({
      generateSummary: vi.fn().mockResolvedValue({ summary, keywords }),
    }));
  }

  /**
   * 录制真实 AI 响应
   */
  async record<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (this.mode !== 'real') {
      throw new Error('Recording requires AI_MODE=real');
    }

    const result = await fn();
    this.recordings.set(name, result);

    // 保存到文件
    this.saveRecording(name, result);

    return result;
  }

  /**
   * 保存录制到文件
   */
  private saveRecording(name: string, data: any): void {
    const recordingPath = path.join(this.fixtureDir, `${name}.json`);
    fs.mkdirSync(path.dirname(recordingPath), { recursive: true });
    fs.writeFileSync(recordingPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 回放录制的响应
   */
  async replay<T>(name: string): Promise<T> {
    const recorded = this.recordings.get(name);
    if (recorded) {
      return recorded as T;
    }

    // 尝试从文件加载
    const recordingPath = path.join(this.fixtureDir, `${name}.json`);
    if (fs.existsSync(recordingPath)) {
      const data = fs.readFileSync(recordingPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.recordings.set(name, parsed);
      return parsed as T;
    }

    throw new Error(`No recording found: ${name}`);
  }

  /**
   * 返回 fixture 数据
   */
  getFixture<T>(name: string): T {
    const fixturePath = path.join(this.fixtureDir, `${name}.json`);

    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${name}`);
    }

    const data = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(data) as T;
  }

  /**
   * 检查 fixture 是否存在
   */
  hasFixture(name: string): boolean {
    const fixturePath = path.join(this.fixtureDir, `${name}.json`);
    return fs.existsSync(fixturePath);
  }

  /**
   * 清除所有录制
   */
  clearRecordings(): void {
    this.recordings.clear();
  }

  /**
   * 获取录制统计
   */
  getStats(): { total: number; names: string[] } {
    return {
      total: this.recordings.size,
      names: Array.from(this.recordings.keys()),
    };
  }
}

/**
 * AI 响应预设库
 */
export const AIResponsePresets = {
  archive: {
    success: '已成功将笔记归档到目标文件夹。',
    error: '归档过程中出现错误,请检查日志。',
    classifySuccess: {
      targetDir: 'Archives/2024',
      confidence: 0.95,
    } as ClassifyResult,
  },

  review: {
    summary: '# 笔记摘要\n\n这是一个关于...的笔记。',
    improvements: '## 改进建议\n\n1. ...\n2. ...',
    keywords: ['关键词1', '关键词2', '关键词3'],
  },

  research: {
    results: '## 研究结果\n\n根据您的问题,我找到以下信息...',
    noResults: '抱歉,没有找到相关信息。',
  },

  links: {
    found: '发现相关链接：\n- [[Note1]]\n- [[Note2]]',
    none: '未发现相关链接。',
  },
};

/**
 * 创建 AI Mock Helper 实例的工厂函数
 */
export function createAIMockHelper(fixtureDir?: string): AIMockHelper {
  return new AIMockHelper(fixtureDir);
}
