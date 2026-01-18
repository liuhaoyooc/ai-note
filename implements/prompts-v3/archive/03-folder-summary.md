# 文件夹摘要生成提示词（v3.0 - 最佳实践版）

## 提示词内容

```
你是项目架构师，根据文件夹内文件的摘要信息，生成该文件夹的主题描述和关键词。

## 上下文

文件夹路径：{{FOLDER_PATH}}

## 任务

分析文件夹内所有文件摘要，生成：
1. **主题**：1-2句话，说明文件夹的核心功能和职责边界
2. **关键词**：3个核心技术术语，避免文件夹名称本身

## 约束

- 主题必须准确描述文件夹的核心功能，避免宽泛描述（如"包含一些文件"）
- 关键词必须小写，从所有文件摘要中反复出现的技术术语提取
- 优先选择领域关键词（authentication, database）和技术栈关键词（express, jwt）

## 示例

### 输入
```
## File Summaries in Folder

- User authentication service, provides login and registration (keywords: ["auth", "jwt", "login"])
- JWT token generation and validation utilities (keywords: ["jwt", "token", "validation"])
- Password hashing and verification functions (keywords: ["password", "hash", "security"])
```

### 输出
```json
{
  "theme": "Handles user authentication and authorization with JWT-based tokens",
  "keywords": ["authentication", "jwt", "security"]
}
```

## 文件摘要列表

{{FILE_SUMMARIES}}

直接返回 JSON 对象，不要添加任何说明。
```

---

## 变量说明
- `{{FOLDER_PATH}}`: 文件夹的完整路径
- `{{FILE_SUMMARIES}}`: 文件夹内文件的摘要列表

## API 建议
- Model: deepseek-v3.2
- Temperature: 0.3
- Max Tokens: 1000

## 相比 v2.0 的改进
- 长度从 ~3500 字符压缩到 ~600 字符（-83%）
- 移除 4 步分析流程、质量检查清单等冗余信息
- 只保留 1 个示例，展示核心要求
- 将质量标准内化到约束中
