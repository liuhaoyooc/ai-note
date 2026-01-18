# 测试配置说明

## Vitest 配置

项目的 Vitest 配置位于 `vitest.config.ts`。

### 配置项说明

```typescript
{
  test: {
    globals: true,        // 启用全局测试 API（describe, it, expect 等）
    environment: 'node',  // 使用 Node.js 环境
    setupFiles: ['./tests/setup.ts'],  // 全局设置文件
    coverage: {
      provider: 'v8',     // 使用 v8 覆盖率提供者
      reporter: ['text', 'json', 'html'],  // 覆盖率报告格式
      exclude: [          // 排除的文件/目录
        'node_modules/',
        'tests/',
        '*.test.ts',
      ],
    },
    include: ['tests/**/*.test.ts'],  // 包含的测试文件
    testTimeout: 30000,   // 测试超时时间（30秒）
    hookTimeout: 30000,   // 钩子超时时间（30秒）
  },
  resolve: {
    alias: {
      '@': './src',       // 源代码别名
      '@tests': './tests', // 测试代码别名
    },
  },
}
```

## 测试脚本

在 `package.json` 中定义的测试脚本：

```json
{
  "scripts": {
    "test": "vitest",                              // 监视模式
    "test:run": "vitest run",                      // 单次运行
    "test:coverage": "vitest run --coverage",      // 生成覆盖率
    "test:ui": "vitest --ui",                      // 启动 UI
    "test:ai:real": "AI_MODE=real vitest",         // 真实 AI 模式
    "test:p0": "vitest run --grep '@P0'",          // P0 测试
    "test:p1": "vitest run --grep '@P1'",          // P1 测试
    "test:p2": "vitest run --grep '@P2'"           // P2 测试
  }
}
```

## 使用示例

### 运行所有测试

```bash
npm test
```

### 运行特定类别的测试

```bash
# 单元测试
npm test -- tests/unit

# 集成测试
npm test -- tests/integration

# 边界测试
npm test -- tests/boundary
```

### 运行特定测试文件

```bash
npm test -- tests/unit/services/noteService.test.ts
```

### 运行匹配名称的测试

```bash
# 运行所有包含 "archive" 的测试
npm test -- -t archive

# 运行所有 P0 测试
npm run test:p0
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录中。

### 启动 Vitest UI

```bash
npm run test:ui
```

这将启动一个 Web 界面，可以交互式地运行和查看测试。

## 测试别名

在测试文件中可以使用以下别名：

- `@` - 指向 `src/` 目录
- `@tests` - 指向 `tests/` 目录

示例：

```typescript
import { someFunction } from '@/utils/helper';
import { createTestVault } from '@tests/helpers/vaultHelper';
```

## 全局设置

全局测试设置在 `tests/setup.ts` 中定义。

### 全局变量

- `global.obsidian` - Mock 的 Obsidian API
- `global.TestUtils` - 测试工具函数

### 测试工具函数

```typescript
// 等待指定时间
await TestUtils.wait(1000);

// 创建临时目录
const tempDir = TestUtils.createTempDir('test');

// 清理临时目录
TestUtils.cleanupTempDir(tempDir);
```

## AI 模式

### Mock 模式（默认）

```bash
npm test
```

使用录制的 AI 响应或预设响应。

### 真实 AI 模式

```bash
npm run test:ai:real
```

调用真实的 AI API 并自动录制响应。

## 覆盖率目标

建议的测试覆盖率目标：

- **语句覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 80%
- **行覆盖率**: > 80%

## 测试最佳实践

1. **测试隔离**: 每个测试应该独立运行
2. **清理资源**: 使用 `afterEach` 清理测试资源
3. **使用辅助工具**: 利用 `@tests/helpers` 中的工具
4. **描述性名称**: 使用清晰的测试描述
5. **AAA 模式**: Arrange（准备）- Act（执行）- Assert（断言）
6. **测试边界情况**: 不仅测试正常情况，还要测试边界情况

## 调试测试

### 使用 console.log

```typescript
it('should do something', () => {
  console.log('Debug info');
  expect(result).toBe(expected);
});
```

### 使用 Vitest UI

```bash
npm run test:ui
```

UI 提供可视化的测试结果和代码覆盖率。

### 使用 debugger

```typescript
it('should do something', () => {
  debugger;  // 设置断点
  expect(result).toBe(expected);
});
```

然后使用 Node.js 调试器运行：

```bash
node --inspect-brk node_modules/.bin/vitest run
```

## CI/CD 集成

在 CI/CD 环境中运行测试：

```yaml
# GitHub Actions 示例
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## 常见问题

### 测试超时

如果测试超时，可以在测试文件中增加超时时间：

```typescript
it('should handle long operation', async () => {
  // 测试代码
}, 60000);  // 60 秒超时
```

### 模块未找到

确保在 `vitest.config.ts` 中配置了正确的别名。

### TypeScript 错误

确保 `tsconfig.json` 包含测试文件的配置。

## 扩展阅读

- [Vitest 官方文档](https://vitest.dev/)
- [测试最佳实践](https://vitest.dev/guide/why.html)
