# 测试 Helpers 使用指南

本目录包含了 4 个测试辅助工具，用于简化测试编写。

## 文件列表

1. **aiMock.ts** - AI Mock/录制工具
2. **vaultHelper.ts** - 测试 Vault 操作
3. **testDataBuilder.ts** - 测试数据构建器
4. **testPlugin.ts** - 测试用 Plugin 类

## 使用方法

### 1. AI Mock Helper

用于模拟 AI 响应或录制真实的 AI 调用。

```typescript
import { AIMockHelper } from './helpers';

// 创建 Mock Helper
const aiMock = new AIMockHelper();

// Mock AI 分类响应
aiMock.mockClassify([
  { targetDir: 'Archives/2024', confidence: 0.95 }
]);

// 录制真实 AI 响应（需要设置 AI_MODE=real）
await aiMock.record('classify-1', async () => {
  return await realAI.classify(content);
});

// 回放录制的响应
const result = await aiMock.replay('classify-1');

// 获取 fixture 数据
const fixture = aiMock.getFixture('classify-response');
```

### 2. Vault Test Helper

用于创建和管理测试 Vault。

```typescript
import { VaultTestHelper } from './helpers';

// 创建测试 Vault
const vault = new VaultTestHelper('my-test');
await vault.createTestVault({
  root: {
    notes: ['Inbox/test.md'],
    folders: ['Archives', 'Reviews']
  }
});

// 创建笔记
await vault.createNote('test.md', '# Test\n\nContent');

// 读取笔记
const content = await vault.readNote('test.md');

// 清理
await vault.cleanup();
```

### 3. Test Data Builder

使用 Builder 模式创建测试数据。

```typescript
import { TestDataBuilder, NoteDataBuilder } from './helpers';

// 使用静态方法
const file = TestDataBuilder.note({
  path: 'test.md',
  title: 'Test Note'
});

const summary = TestDataBuilder.summary({
  keywords: ['test', 'example'],
  summary: 'Test summary'
});

// 使用构建器
const note = new NoteDataBuilder('test.md')
  .withTitle('Test Note')
  .withParagraph('Content here')
  .withTags(['test', 'example'])
  .withLinks(['OtherNote'])
  .build();

// 使用预设
const preset = TestDataPresets.simpleNote();
```

### 4. Test Plugin

测试用的 Plugin 类，提供 Mock App 对象。

```typescript
import { TestPlugin } from './helpers';

// 创建测试 Plugin
const plugin = new TestPlugin(vaultHelper);
await plugin.onload();

// 获取 Mock App
const app = plugin.app;
const vault = app.vault;
const metadataCache = app.metadataCache;

// 设置插件设置
plugin.setSettings({
  apiKey: 'test-key',
  paths: {
    reviewsDir: '复盘',
    researchDir: '调研',
    unsortedDir: '待整理'
  }
});

// 清理
await plugin.cleanup();
```

## 环境变量

- `AI_MODE=mock` - 使用 Mock 数据（默认）
- `AI_MODE=real` - 录制真实 AI 响应

## 类型导出

所有类型都通过 `index.ts` 统一导出：

```typescript
import {
  AIMockHelper,
  VaultTestHelper,
  TestDataBuilder,
  TestPlugin,
  type AIMockMode,
  type ClassifyResult,
  type NoteData,
  type TestSnapshot,
  type TestFolderSummary
} from './tests/helpers';
```

## 注意事项

1. 测试完成后记得调用 `cleanup()` 清理测试数据
2. 使用 Mock 模式时，确保所有 AI 调用都有对应的 fixture
3. Vault Helper 会创建临时目录，测试结束后会自动清理
4. 所有 Helper 都支持链式调用，提供更好的使用体验
