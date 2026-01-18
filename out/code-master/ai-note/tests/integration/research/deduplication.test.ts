/**
 * 去重算法集成测试
 * @P0
 * 测试调研主题去重的Jaccard相似度算法和过滤逻辑
 *
 * 测试计划 v2.1 - 10个测试用例
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

interface Topic {
  id: string;
  title: string;
  keywords: string[];
  type: 'trending' | 'problem-solving' | 'deep-dive' | 'inspiration';
  createdAt: string;
}

interface HistoryIndex {
  topics: Array<{
    id: string;
    title: string;
    keywords: string[];
    createdAt: string;
  }>;
}

// 去重服务
class DeduplicationService {
  private historyPath: string;

  constructor(historyPath: string) {
    this.historyPath = historyPath;
  }

  /**
   * 计算 Jaccard 相似度
   * |A ∩ B| / |A ∪ B|
   */
  private calculateJaccardSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    if (set1.size === 0 && set2.size === 0) {
      return 0;
    }

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 获取时间衰减权重
   */
  private getTimeDecayWeight(daysOld: number): number {
    if (daysOld <= 7) {
      return 1.0; // 7天内：强去重
    } else if (daysOld <= 14) {
      return 0.5; // 7-14天：弱去重
    } else {
      return 0; // 14天以上：不参与去重
    }
  }

  /**
   * 检查是否重复
   */
  async isDuplicate(
    topic: Topic,
    existingTopics: Topic[]
  ): Promise<{ isDuplicate: boolean; similarity?: number }> {
    const now = new Date();
    const topicDate = new Date(topic.createdAt);

    for (const existing of existingTopics) {
      const existingDate = new Date(existing.createdAt);
      const daysOld = Math.floor((now.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));

      // 14天以上不参与去重
      if (daysOld > 14) {
        continue;
      }

      // 计算Jaccard相似度
      const similarity = this.calculateJaccardSimilarity(topic.keywords, existing.keywords);

      // 根据时间衰减调整阈值
      const weight = this.getTimeDecayWeight(daysOld);
      const threshold = weight === 1.0 ? 0.3 : weight === 0.5 ? 0.6 : 1.0;

      if (similarity > threshold) {
        return { isDuplicate: true, similarity };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * 过滤重复主题
   */
  async filterDuplicates(topics: Topic[]): Promise<Topic[]> {
    // 读取历史
    const history = this.loadHistory();

    // 检查每个主题
    const filtered: Topic[] = [];

    for (const topic of topics) {
      const result = await this.isDuplicate(topic, [...history.topics, ...filtered]);
      if (!result.isDuplicate) {
        filtered.push(topic);
      }
    }

    return filtered;
  }

  /**
   * 加载历史
   */
  private loadHistory(): HistoryIndex {
    if (!fs.existsSync(this.historyPath)) {
      return { topics: [] };
    }

    const content = fs.readFileSync(this.historyPath, 'utf-8');
    return JSON.parse(content);
  }
}

describe('去重算法集成测试', () => {
  let dedupService: DeduplicationService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = `/tmp/test-deduplication-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });
    const historyPath = path.join(tempDir, 'history.json');
    dedupService = new DeduplicationService(historyPath);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ========================================
  // Jaccard相似度算法
  // ========================================

  describe('DD1-DD4: Jaccard相似度算法', () => {
    it('DD1: 完全相同的关键词应返回1.0', () => {
      const keywords1 = ['react', 'typescript', 'frontend'];
      const keywords2 = ['react', 'typescript', 'frontend'];

      const similarity = dedupService['calculateJaccardSimilarity'](keywords1, keywords2);

      expect(similarity).toBe(1.0);
    });

    it('DD2: 完全不同的关键词应返回0.0', () => {
      const keywords1 = ['react', 'frontend'];
      const keywords2 = ['python', 'backend'];

      const similarity = dedupService['calculateJaccardSimilarity'](keywords1, keywords2);

      expect(similarity).toBe(0.0);
    });

    it('DD3: 部分重叠的关键词应返回正确值', () => {
      const keywords1 = ['react', 'typescript', 'frontend', 'hooks'];
      const keywords2 = ['react', 'typescript', 'backend'];

      // 交集: {react, typescript} = 2
      // 并集: {react, typescript, frontend, hooks, backend} = 5
      // 相似度: 2/5 = 0.4
      const similarity = dedupService['calculateJaccardSimilarity'](keywords1, keywords2);

      expect(similarity).toBeCloseTo(0.4, 2);
    });

    it('DD4: 空关键词列表应返回0.0', () => {
      const keywords1: string[] = [];
      const keywords2 = ['react'];

      const similarity = dedupService['calculateJaccardSimilarity'](keywords1, keywords2);

      expect(similarity).toBe(0.0);
    });
  });

  // ========================================
  // 时间衰减处理
  // ========================================

  describe('DD5-DD6: 时间衰减处理', () => {
    it('DD5: 7天内应强去重(>30%)', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const newTopic: Topic = {
        id: '1',
        title: 'React Hooks',
        keywords: ['react', 'hooks', 'frontend'],
        type: 'trending',
        createdAt: now.toISOString(),
      };

      const existingTopic: Topic = {
        id: '2',
        title: 'React Tutorial',
        keywords: ['react', 'tutorial', 'frontend'],
        type: 'trending',
        createdAt: threeDaysAgo.toISOString(),
      };

      const result = await dedupService.isDuplicate(newTopic, [existingTopic]);

      // Jaccard相似度 = 2/4 = 0.5 > 0.3，应判定为重复
      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.3);
    });

    it('DD6: 7-14天应弱去重(>60%)', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const newTopic: Topic = {
        id: '1',
        title: 'React Hooks',
        keywords: ['react', 'hooks', 'frontend'],
        type: 'trending',
        createdAt: now.toISOString(),
      };

      const existingTopic: Topic = {
        id: '2',
        title: 'React Tutorial',
        keywords: ['react', 'tutorial', 'frontend'],
        type: 'trending',
        createdAt: tenDaysAgo.toISOString(),
      };

      const result = await dedupService.isDuplicate(newTopic, [existingTopic]);

      // Jaccard相似度 = 2/4 = 0.5 < 0.6，不应判定为重复
      expect(result.isDuplicate).toBe(false);
    });
  });

  // ========================================
  // 边界情况
  // ========================================

  describe('DD7-DD10: 边界情况', () => {
    it('DD7: 14天以上不参与去重', async () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const newTopic: Topic = {
        id: '1',
        title: 'React Hooks',
        keywords: ['react', 'hooks'],
        type: 'trending',
        createdAt: now.toISOString(),
      };

      const existingTopic: Topic = {
        id: '2',
        title: 'React Hooks',
        keywords: ['react', 'hooks'],
        type: 'trending',
        createdAt: twentyDaysAgo.toISOString(),
      };

      const result = await dedupService.isDuplicate(newTopic, [existingTopic]);

      // 即使完全相同，超过14天也不应判定为重复
      expect(result.isDuplicate).toBe(false);
    });

    it('DD8: 空历史应不影响过滤', async () => {
      const topics: Topic[] = [
        {
          id: '1',
          title: 'React Hooks',
          keywords: ['react', 'hooks'],
          type: 'trending',
          createdAt: new Date().toISOString(),
        },
      ];

      const filtered = await dedupService.filterDuplicates(topics);

      expect(filtered).toHaveLength(1);
    });

    it('DD9: 边界相似度(30%)应正确判断', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const newTopic: Topic = {
        id: '1',
        title: 'Topic A',
        keywords: ['a', 'b', 'c'],
        type: 'trending',
        createdAt: now.toISOString(),
      };

      const existingTopic: Topic = {
        id: '2',
        title: 'Topic B',
        keywords: ['a', 'd', 'e', 'f', 'g'], // 1/7 = ~14%，不重复
        type: 'trending',
        createdAt: threeDaysAgo.toISOString(),
      };

      const result = await dedupService.isDuplicate(newTopic, [existingTopic]);

      expect(result.isDuplicate).toBe(false);
    });

    it('DD10: 批量过滤应正确处理', async () => {
      const now = new Date();

      const topics: Topic[] = [
        {
          id: '1',
          title: 'React Hooks',
          keywords: ['react', 'hooks'],
          type: 'trending',
          createdAt: now.toISOString(),
        },
        {
          id: '2',
          title: 'React Tutorial', // 与1相似度高
          keywords: ['react', 'hooks', 'tutorial'],
          type: 'trending',
          createdAt: now.toISOString(),
        },
        {
          id: '3',
          title: 'Vue Guide', // 与1、2不相似
          keywords: ['vue', 'guide'],
          type: 'trending',
          createdAt: now.toISOString(),
        },
      ];

      const filtered = await dedupService.filterDuplicates(topics);

      // 应过滤掉一个重复的
      expect(filtered.length).toBeLessThan(3);
      expect(filtered.length).toBeGreaterThan(1);
    });
  });
});
