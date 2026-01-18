# 测试快速开始指南

## 安装依赖

```bash
npm install
```

## 运行第一个测试

```bash
npm test
```

这将启动 Vitest 监视模式，运行所有测试。

## 创建你的第一个测试

### 1. 单元测试

在 `tests/unit/` 目录下创建测试文件：

```typescript
// tests/unit/example.test.ts
import { describe, it, expect } from 'vitest';

describe('My first test', () => {
  it('should add two numbers', () => {
    const result = 1 + 1;
    expect(result).toBe(2);
  });
});
```

### 2. 集成测试

在 `tests/integration/` 目录下创建测试文件：

```typescript
// tests/integration/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';

describe('My first integration test', () => {
  let vault: any;

  beforeEach(async () => {
    vault = await createTestVault('my-test');
  });

  it('should create and read a note', () => {
    vault.createNote('test.md', '# Test Note');
    expect(vault.noteExists('test.md')).toBe(true);

    const content = vault.readNote('test.md');
    expect(content).toContain('Test Note');

    vault.cleanup();
  });
});
```

## 使用测试辅助工具

### 创建测试数据

```typescript
import { createNoteBuilder } from '@tests/helpers/testDataBuilder';

const noteData = createNoteBuilder('my-note.md')
  .withTitle('My Note')
  .withParagraph('Some content')
  .withTags(['test', 'example'])
  .build();

vault.createNote(noteData.path, noteData.content);
```

### 使用预设数据

```typescript
import { TestDataPresets } from '@tests/helpers/testDataBuilder';

const noteData = TestDataPresets.simpleNote();
vault.createNote(noteData.path, noteData.content);
```

### Mock AI 响应

```typescript
import { createAIMock, AIResponsePresets } from '@tests/helpers/aiMock';

const aiMock = createAIMock('test-scenario');
const response = AIResponsePresets.archive.success;
```

## 运行特定测试

### 按文件

```bash
npm test -- tests/unit/example.test.ts
```

### 按测试名称

```bash
npm test -- -t "should add two numbers"
```

### 按类别

```bash
# 单元测试
npm test -- tests/unit

# 集成测试
npm test -- tests/integration

# 边界测试
npm test -- tests/boundary
```

## 生成覆盖率报告

```bash
npm run test:coverage
```

查看报告：

```bash
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## 使用 Vitest UI

```bash
npm run test:ui
```

然后在浏览器中打开 `http://localhost:51204/__vitest__/`。

## 调试测试

### 添加 console.log

```typescript
it('should do something', () => {
  const value = someFunction();
  console.log('Value:', value);
  expect(value).toBeDefined();
});
```

### 使用 debugger

```typescript
it('should do something', () => {
  debugger;  // 在这里设置断点
  const value = someFunction();
  expect(value).toBeDefined();
});
```

然后运行：

```bash
node --inspect-brk node_modules/.bin/vitest run tests/unit/example.test.ts
```

## 测试模板

### 基本模板

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature name', () => {
  beforeEach(() => {
    // 每个测试前的设置
  });

  afterEach(() => {
    // 每个测试后的清理
  });

  it('should do something', () => {
    // Arrange（准备）
    const input = 'test';

    // Act（执行）
    const result = processInput(input);

    // Assert（断言）
    expect(result).toBe('expected');
  });
});
```

### 异步测试模板

```typescript
import { describe, it, expect } from 'vitest';

describe('Async feature', () => {
  it('should handle async operations', async () => {
    // Arrange
    const asyncFunction = async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('result'), 100);
      });
    };

    // Act
    const result = await asyncFunction();

    // Assert
    expect(result).toBe('result');
  });
});
```

## 下一步

1. 阅读 [tests/README.md](./README.md) 了解完整的测试基础设施
2. 查看 [tests/TESTING.md](./TESTING.md) 了解详细的配置选项
3. 浏览现有的测试文件了解更多示例
4. 开始为你的功能编写测试！

## 获取帮助

- Vitest 文档: https://vitest.dev/
- 查看现有测试示例
- 提交 Issue 或 PR

## 常用命令速查

```bash
# 运行所有测试（监视模式）
npm test

# 运行所有测试（单次）
npm run test:run

# 生成覆盖率
npm run test:coverage

# 启动 UI
npm run test:ui

# 运行 P0 测试
npm run test:p0

# 运行特定文件
npm test -- tests/unit/example.test.ts

# 运行匹配的测试
npm test -- -t "test name"
```
