/**
 * 测试 Helpers 统一导出
 * 提供便捷的导入方式
 */

// AI Mock 和录制工具
export {
  AIMockHelper,
  createAIMockHelper,
  AIResponsePresets,
  type AIMockMode,
  type ClassifyResult,
} from './aiMock';

// Vault 操作 Helper
export {
  VaultTestHelper,
  createTestVault,
  TestVaultPresets,
  type TestVaultStructure,
} from './vaultHelper';

// 测试数据构建器
export {
  TestDataBuilder,
  NoteDataBuilder,
  TestDataPresets,
  createNoteBuilder,
  type NoteData,
} from './testDataBuilder';

// 测试用 Plugin 类
export {
  TestPlugin,
  createTestPlugin,
  wrapPlugin,
  type MockApp,
} from './testPlugin';
