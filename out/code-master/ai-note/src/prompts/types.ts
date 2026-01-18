// 此文件由 scripts/sync-prompts.mjs 自动生成，请勿手动编辑

/**
 * 所有可用的提示词 ID
 */
export type PromptId =
    | 'README'
    | 'archive.01-file-summary'
    | 'archive.02-file-classification'
    | 'archive.03-folder-summary'
    | 'identity.01-identity-analysis'
    | 'research.01-topic-generation'
    | 'research.02-topic-selection'
    | 'research.03-report-trending'
    | 'research.04-report-problem-solving'
    | 'research.05-report-deep-dive'
    | 'research.06-report-inspiration'
    | 'review.01-daily-review'
    | 'review.02-first-run-review'
    | 'review.03-weekly-review';

/**
 * 提示词配置
 */
export interface PromptConfig {
    /** 提示词 ID */
    id: string;
    /** 提示词内容模板 */
    content: string;
    /** 变量列表 */
    variables: string[];
    /** API 模型（可选） */
    model?: string;
    /** Temperature（可选） */
    temperature?: number;
    /** Max Tokens（可选） */
    maxTokens?: number;
}

/**
 * 提示词索引
 */
export interface PromptsIndex {
    [key: string]: PromptConfig;
}

/**
 * 变量值的类型
 */
export type PromptVariables = Record<string, string | number | boolean | string[]>;
