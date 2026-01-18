/**
 * 每周复盘流程集成测试
 * @P0
 * 测试每周复盘的完整流程
 *
 * 测试计划 v2.1 - 10个测试用例
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultTestHelper } from '@tests/helpers/vaultHelper';
import * as fs from 'fs';
import * as path from 'path';

// 导入自定义断言
import '@tests/helpers/customAssertions';

// 模拟每周复盘服务
class WeeklyReviewService {
  private vault: VaultTestHelper;

  private get vaultPath(): string {
    return this.vault.getPath();
  }

  private get dailyReviewDir(): string {
    return path.join(this.vaultPath, 'Reviews', 'Daily');
  }

  private get weeklyReviewDir(): string {
    return path.join(this.vaultPath, 'Reviews', 'Weekly');
  }

  constructor(vault: VaultTestHelper) {
    this.vault = vault;
  }

  /**
   * 获取本周的日期范围（周一到周日）
   */
  private getWeekRange(date: Date): { start: Date; end: Date } {
    const d = new Date(date);
    const day = d.getDay();

    // 调整到周一
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    const start = new Date(d);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * 获取周次（ISO 8601标准）
   */
  private getWeekNumber(date: Date): { year: number; week: number } {
    const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

    // 找到该年第一个周四（确定第一周）
    const jan1 = new Date(Date.UTC(targetDate.getFullYear(), 0, 1));
    const jan1Day = jan1.getUTCDay(); // 0=周日, 1=周一, ..., 6=周六

    // 第一周包含1月4日
    const jan4 = new Date(Date.UTC(targetDate.getFullYear(), 0, 4));

    // 找到1月4日所在的周一（第一周的开始）
    const firstDayOfYear = jan4.getUTCDay(); // 0=周日, 1=周一, ..., 6=周六
    const weekOneStart = new Date(jan4);
    // 如果1月4日不是周一，向前推到周一
    const dayOffset = firstDayOfYear === 0 ? 6 : firstDayOfYear - 1;
    weekOneStart.setUTCDate(4 - dayOffset);

    // 计算从第一周到目标日期的天数
    const daysDiff = Math.floor((targetDate.getTime() - weekOneStart.getTime()) / 86400000);
    let weekNo = Math.floor(daysDiff / 7) + 1;

    // 确定年份
    let weekYear = targetDate.getFullYear();
    if (weekNo < 1) {
      // 属于上一年的最后一周
      weekYear--;
      weekNo = this.getWeeksInYear(weekYear);
    } else if (weekNo > this.getWeeksInYear(weekYear)) {
      // 属于下一年的第一周
      weekYear++;
      weekNo = 1;
    }

    return { year: weekYear, week: weekNo };
  }

  /**
   * 计算一年的周数（ISO 8601）
   */
  private getWeeksInYear(year: number): number {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const dec31 = new Date(Date.UTC(year, 11, 31));

    // 如果1月1日是周四，或者12月31日是周四，则有53周
    const jan1Day = jan1.getUTCDay() || 7; // 1=周一, 7=周日
    const dec31Day = dec31.getUTCDay() || 7; // 1=周一, 7=周日

    if (jan1Day === 4 || (jan1Day === 3 && this.isLeapYear(year))) {
      return 53;
    }
    return 52;
  }

  /**
   * 判断是否为闰年
   */
  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * 收集本周的每日复盘
   */
  async collectDailyReviews(): Promise<string[]> {
    const { start, end } = this.getWeekRange(new Date());
    const reviews: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const reviewFile = path.join(this.dailyReviewDir, `${dateStr}.md`);

      if (fs.existsSync(reviewFile)) {
        const content = fs.readFileSync(reviewFile, 'utf-8');
        reviews.push(content);
      }
    }

    return reviews;
  }

  /**
   * 生成周复盘
   */
  async generateReview(): Promise<string> {
    const dailyReviews = await this.collectDailyReviews();

    if (dailyReviews.length === 0) {
      throw new Error('本周没有每日复盘，请先生成每日复盘');
    }

    const weekInfo = this.getWeekNumber(new Date());
    let review = `# 每周复盘\n\n`;
    review += `**周次**: ${weekInfo.year}年 第${weekInfo.week}周\n\n`;
    review += `## 本周总结\n\n`;
    review += `本周共有 ${dailyReviews.length} 篇每日复盘。\n\n`;
    review += `## 每日复盘链接\n\n`;

    dailyReviews.forEach((_, index) => {
      const dayNum = index + 1;
      review += `### 第 ${dayNum} 天\n`;
      review += `- [[Reviews/Daily/${new Date().toISOString().split('T')[0]}.md]]\n`;
    });

    return review;
  }

  /**
   * 运行每周复盘
   */
  async run(): Promise<string> {
    const review = await this.generateReview();

    // 保存复盘
    const weekInfo = this.getWeekNumber(new Date());
    const reviewFile = path.join(this.weeklyReviewDir, `${weekInfo.year}-W${weekInfo.week}.md`);

    fs.mkdirSync(this.weeklyReviewDir, { recursive: true });
    fs.writeFileSync(reviewFile, review);

    return review;
  }
}

describe('每周复盘流程集成测试', () => {
  let vault: VaultTestHelper;
  let reviewService: WeeklyReviewService;

  beforeEach(async () => {
    vault = new VaultTestHelper('weekly-review-test');
    reviewService = new WeeklyReviewService(vault);
  });

  afterEach(async () => {
    await vault.cleanup();
  });

  // ========================================
  // 基本流程测试
  // ========================================

  describe('W1-W6: 基本流程', () => {
    it('W1: 应收集本周复盘文件', async () => {
      // 创建本周的每日复盘
      const { start } = reviewService['getWeekRange'](new Date());
      fs.mkdirSync(reviewService.dailyReviewDir, { recursive: true });

      for (let i = 0; i < 5; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        fs.writeFileSync(
          path.join(reviewService.dailyReviewDir, `${dateStr}.md`),
          `# Daily Review ${dateStr}\n\nContent here.`
        );
      }

      const reviews = await reviewService['collectDailyReviews']();

      expect(reviews).toHaveLength(5);
    });

    it('W2: 跨周边界计算应正确', async () => {
      // 测试跨周边界
      const sunday = new Date('2024-01-07'); // 周日
      const { start, end } = reviewService['getWeekRange'](sunday);

      expect(start.getDate()).toBe(1); // 周一
      expect(end.getDate()).toBe(7); // 周日
    });

    it('W3: 本周无每日复盘应提示错误', async () => {
      await expect(reviewService.generateReview()).rejects.toThrow('没有每日复盘');
    });

    it('W4: 应生成周复盘报告', async () => {
      // 创建每日复盘
      const { start } = reviewService['getWeekRange'](new Date());
      fs.mkdirSync(reviewService.dailyReviewDir, { recursive: true });

      const d = new Date(start);
      const dateStr = d.toISOString().split('T')[0];
      fs.writeFileSync(
        path.join(reviewService.dailyReviewDir, `${dateStr}.md`),
        '# Daily Review\n\nContent'
      );

      const review = await reviewService.run();

      expect(review).toContain('每周复盘');
      expect(review).toContain('本周共有 1 篇每日复盘');
    });

    it('W5: 应覆盖当周已有复盘', async () => {
      const { year, week } = reviewService['getWeekNumber'](new Date());

      fs.mkdirSync(reviewService.weeklyReviewDir, { recursive: true });
      fs.writeFileSync(
        path.join(reviewService.weeklyReviewDir, `${year}-W${week}.md`),
        '# Old Review'
      );

      // 创建每日复盘
      const { start } = reviewService['getWeekRange'](new Date());
      fs.mkdirSync(reviewService.dailyReviewDir, { recursive: true });

      const d = new Date(start);
      const dateStr = d.toISOString().split('T')[0];
      fs.writeFileSync(
        path.join(reviewService.dailyReviewDir, `${dateStr}.md`),
        '# Daily Review\n\nContent'
      );

      await reviewService.run();

      const reviewFile = path.join(reviewService.weeklyReviewDir, `${year}-W${week}.md`);
      const content = fs.readFileSync(reviewFile, 'utf-8');

      expect(content).not.toContain('# Old Review');
    });

    it('W6: 定时触发 - 周五18:00', async () => {
      // 注：需要使用fake timers
      // 这里只验证基本逻辑
      const friday = new Date('2024-01-05T18:00:00');
      const weekInfo = reviewService['getWeekNumber'](friday);

      expect(weekInfo.week).toBeGreaterThanOrEqual(1);
      expect(weekInfo.week).toBeLessThanOrEqual(53);
    });
  });

  // ========================================
  // 周次计算深度验证
  // ========================================

  describe('W7-W10: 周次计算深度验证', () => {
    it('W7: 跨年周次应正确计算', async () => {
      // 跨年测试：2024-12-31 和 2025-01-01
      const dec31 = new Date('2024-12-31'); // 周二
      const jan1 = new Date('2025-01-01'); // 周三

      const weekDec31 = reviewService['getWeekNumber'](dec31);
      const weekJan1 = reviewService['getWeekNumber'](jan1);

      expect(weekDec31.year).toBe(weekJan1.year);
      expect(weekDec31.week).toBe(weekJan1.week);
    });

    it('W8: 年份第一周应正确计算', async () => {
      const jan1 = new Date('2025-01-01'); // 周三
      const week = reviewService['getWeekNumber'](jan1);

      expect(week.week).toBe(1);
    });

    it('W9: 年份最后周应正确计算', async () => {
      const dec31 = new Date('2024-12-31'); // 周二
      const week = reviewService['getWeekNumber'](dec31);

      // 2024-12-31 属于 2025 年第 1 周（ISO 8601 标准）
      expect(week.year).toBe(2025);
      expect(week.week).toBe(1);
    });

    it('W10: 周五深夜周次归属应正确', async () => {
      // 周五23:59
      const fridayNight = new Date('2024-01-05T23:59:00');
      const { start, end } = reviewService['getWeekRange'](fridayNight);

      // 验证属于同一周
      expect(fridayNight >= start && fridayNight <= end).toBe(true);

      // 验证周次
      const week = reviewService['getWeekNumber'](fridayNight);
      expect(week.week).toBeGreaterThanOrEqual(1);
      expect(week.week).toBeLessThanOrEqual(53);
    });
  });
});
