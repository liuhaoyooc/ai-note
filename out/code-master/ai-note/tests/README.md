# AI Note 测试基础设施

## 概述

这是 AI Note 项目的完整测试基础设施，使用 Vitest 作为测试框架。

## 目录结构

```
tests/
├── integration/          # 集成测试
│   ├── archive/         # 归档功能测试
│   ├── review/          # 评审功能测试
│   ├── research/        # 研究功能测试
│   ├── links/           # 链接功能测试
│   └── core/            # 核心功能测试
├── unit/                # 单元测试
│   └── services/        # 服务层单元测试
├── boundary/            # 边界测试
│   ├── data-consistency.test.ts
│   ├── concurrency.test.ts
│   ├── file-system.test.ts
│   └── time-boundary.test.ts
├── helpers/             # 测试辅助工具
│   ├── aiMock.ts        # AI Mock/录制工具
│   ├── vaultHelper.ts   # Vault 操作辅助
│   ├── testPlugin.ts    # 测试用 Plugin 类
│   └── testDataBuilder.ts # 测试数据构建器
├── fixtures/            # 测试数据
│   ├── notes/           # 示例笔记
│   ├── ai-responses/    # AI 响应录制
│   └── snapshots/       # 快照数据
└── setup.ts             # 全局测试设置
```

## 测试脚本

在项目根目录的 `package.json` 中已配置以下测试脚本：

```bash
# 运行所有测试（监视模式）
npm test

# 运行所有测试（单次）
npm run test:run

# 运行测试并生成覆盖率报告
npm run test:coverage

# 启动 Vitest UI
npm run test:ui

# 使用真实 AI 模式运行测试
npm run test:ai:real

# 按优先级运行测试
npm run test:p0  # 仅运行 P0 测试
npm run test:p1  # 仅运行 P1 测试
npm run test:p2  # 仅运行 P2 测试
```

## 测试辅助工具

### 1. AIMock - AI Mock 和录制工具

```typescript
import { createAIMock } from '@tests/helpers/aiMock';

// 创建 AI Mock
const aiMock = createAIMock('archive-scenario');

// Mock AI 请求
const response = await aiMock.mockAIRequest('Archive this note');

// 录制模式
if (process.env.AI_MODE === 'real') {
  // 将调用真实 AI 并录制响应
}
```

### 2. TestVaultHelper - Vault 操作辅助

```typescript
import { createTestVault, TestVaultPresets } from '@tests/helpers/vaultHelper';

// 创建测试 Vault
const vault = await createTestVault();

// 使用预设配置
const vault = await createTestVault('my-vault', TestVaultPresets.basic);

// 创建笔记
vault.createNote('test.md', '# Test Note');

// 读取笔记
const content = vault.readNote('test.md');

// 清理
vault.cleanup();
```

### 3. TestPlugin - 测试用 Plugin

```typescript
import { createTestPlugin } from '@tests/helpers/testPlugin';
import { createTestVault } from '@tests/helpers/vaultHelper';

const vault = await createTestVault();
const plugin = createTestPlugin(vault);

// 使用 plugin.app 访问 Mock 的 Obsidian API
const file = plugin.app.vault.getAbstractFileByPath('test.md');

// 清理
plugin.cleanup();
```

### 4. NoteDataBuilder - 测试数据构建器

```typescript
import { createNoteBuilder, TestDataPresets } from '@tests/helpers/testDataBuilder';

// 使用构建器创建笔记数据
const noteData = createNoteBuilder('test.md')
  .withTitle('Test Note')
  .withFrontmatter('author', 'Test User')
  .withTags(['test', 'example'])
  .withParagraph('Some content')
  .withTasks([
    { text: 'Task 1', completed: false },
    { text: 'Task 2', completed: true },
  ])
  .build();

// 使用预设
const noteData = TestDataPresets.fullNote();
```

## 测试优先级

使用注释标记测试优先级：

```typescript
/**
 * 测试描述
 * @P0  // 高优先级 - 核心功能
 * @P1  // 中优先级 - 重要功能
 * @P2  // 低优先级 - 边缘情况
 */
```

## 编写测试

### 基本测试结构

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestVault } from '@tests/helpers/vaultHelper';

describe('功能名称', () => {
  let vault: any;

  beforeEach(async () => {
    vault = await createTestVault('test-scenario');
  });

  it('should do something', () => {
    // 测试代码
    expect(result).toBe(expected);
  });
});
```

### 使用测试数据

```typescript
import { TestDataPresets } from '@tests/helpers/testDataBuilder';

it('should handle tagged notes', () => {
  const noteData = TestDataPresets.taggedNote();
  vault.createNote(noteData.path, noteData.content);

  // 测试逻辑
});
```

### Mock AI 响应

```typescript
import { createAIMock } from '@tests/helpers/aiMock';

it('should use AI mock', async () => {
  const aiMock = createAIMock('test-scenario');
  const response = await aiMock.mockAIRequest('test prompt');

  expect(response).toBeDefined();
});
```

## 测试 Fixtures

### 示例笔记

位于 `tests/fixtures/notes/`：
- `simple-note.md` - 简单笔记
- `tagged-note.md` - 带标签的笔记
- `task-note.md` - 带任务列表的笔记

### AI 响应录制

位于 `tests/fixtures/ai-responses/`：
- `archive.json` - 归档功能响应
- `review.json` - 评审功能响应

### 快照数据

位于 `tests/fixtures/snapshots/`：
- `archive-operation.json` - 归档操作快照
- `review-operation.json` - 评审操作快照

## 边界测试

边界测试位于 `tests/boundary/` 目录，测试：

1. **数据一致性** (`data-consistency.test.ts`)
   - 重复操作的一致性
   - 并发修改
   - 数据丢失防护

2. **并发性** (`concurrency.test.ts`)
   - 快速连续操作
   - 并行读写
   - 竞态条件

3. **文件系统** (`file-system.test.ts`)
   - 超长文件名
   - 特殊字符
   - 大文件
   - 深层目录
   - Unicode 文件名

4. **时间边界** (`time-boundary.test.ts`)
   - 午夜边界
   - 年份转换
   - 月份转换
   - 时区差异

## 持续集成

在 CI/CD 环境中运行测试：

```bash
# 运行所有测试
npm run test:run

# 生成覆盖率报告
npm run test:coverage
```

## 最佳实践

1. **使用测试辅助工具**：利用 `helpers/` 中的工具简化测试代码
2. **清理资源**：在测试后调用 `cleanup()` 方法
3. **使用 beforeEach**：每个测试前创建新的测试环境
4. **标记优先级**：使用 `@P0`, `@P1`, `@P2` 标记测试优先级
5. **使用预设数据**：优先使用 `TestDataPresets` 中的预设
6. **测试边界情况**：确保测试覆盖各种边界条件
7. **Mock 外部依赖**：使用 `AIMock` 等 mock 工具

## 扩展测试

添加新测试时：

1. 在相应的目录创建测试文件
2. 使用 `.test.ts` 后缀
3. 导入必要的辅助工具
4. 编写测试用例
5. 运行测试验证

## 故障排除

### 测试失败

1. 检查测试环境是否正确设置
2. 确认所有依赖已安装
3. 查看错误日志和堆栈跟踪
4. 使用 `npm run test:ui` 启动 UI 调试

### Mock 问题

1. 确认 AI Mock 配置正确
2. 检查录制文件是否存在
3. 验证 Mock 数据格式

### Vault 操作问题

1. 确认测试 Vault 创建成功
2. 检查文件路径是否正确
3. 验证权限设置

## 贡献

添加新测试时，请：

1. 遵循现有测试结构
2. 使用测试辅助工具
3. 添加必要的 fixtures
4. 更新文档
5. 确保所有测试通过
