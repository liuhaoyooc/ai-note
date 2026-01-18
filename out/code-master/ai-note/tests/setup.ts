/**
 * Vitest 全局测试设置
 */

import { beforeEach, afterEach } from 'vitest';

// 全局测试钩子
beforeEach(() => {
  // 每个测试前的设置
  // 可以在这里初始化全局状态
});

afterEach(() => {
  // 每个测试后的清理
  // 可以在这里重置全局状态
});

// 模拟 Obsidian API
global.obsidian = {
  // 这里可以添加 Obsidian API 的 mock 实现
  apiVersion: '1.0.0',
  plugins: {
    enabledPlugins: new Set<string>(),
  },
};

// 设置全局测试环境变量
process.env.NODE_ENV = 'test';
process.env.AI_MODE = process.env.AI_MODE || 'mock';

// 添加全局测试工具函数
global.TestUtils = {
  /**
   * 等待指定时间
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 创建测试用的临时目录
   */
  createTempDir: (name: string): string => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = path.join(os.tmpdir(), `ai-note-test-${Date.now()}-${name}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },

  /**
   * 清理测试用的临时目录
   */
  cleanupTempDir: (dir: string) => {
    const fs = require('fs');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};

// 声明全局类型
declare global {
  var obsidian: any;
  var TestUtils: {
    wait: (ms: number) => Promise<void>;
    createTempDir: (name: string) => string;
    cleanupTempDir: (dir: string) => void;
  };
}
