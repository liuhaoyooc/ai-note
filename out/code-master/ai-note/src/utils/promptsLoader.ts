/**
 * 提示词加载器
 *
 * 从 src/prompts/index.json 读取提示词，并提供类型安全的访问接口
 *
 * 使用方式：
 * ```ts
 * import { PromptLoader } from './utils/promptsLoader';
 *
 * const loader = new PromptLoader();
 *
 * // 获取原始模板
 * const template = loader.getTemplate('research.topic-generation');
 *
 * // 填充变量
 * const filled = loader.fill('research.topic-generation', {
 *   PRIMARY_ROLE: 'developer',
 *   CURRENT_FOCUS: 'React'
 * });
 *
 * // 获取 API 配置
 * const config = loader.getConfig('research.topic-generation');
 * ```
 */

import type { PromptConfig, PromptId, PromptVariables, PromptsIndex } from './promptTypes';

const PROMPTS_INDEX: PromptsIndex = require('../prompts/index.json');

export interface PromptApiConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export class PromptLoader {
    private index: PromptsIndex;

    constructor() {
        this.index = PROMPTS_INDEX;
        console.log(`[PromptLoader] Loaded ${Object.keys(this.index).length} prompts`);
    }

    /**
     * 获取提示词原始模板
     */
    getTemplate(id: PromptId): string {
        const prompt = this.index[id];
        if (!prompt) {
            throw new Error(`Prompt not found: ${id}`);
        }
        return prompt.content;
    }

    /**
     * 填充提示词变量
     */
    fill(id: PromptId, variables: PromptVariables): string {
        let content = this.getTemplate(id);
        const prompt = this.index[id];

        // 验证所有必需的变量都已提供
        if (prompt.variables) {
            for (const v of prompt.variables) {
                if (!(v in variables)) {
                    console.warn(`[PromptLoader] Missing variable: ${v} for prompt: ${id}`);
                }
            }
        }

        // 替换变量
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            content = content.replaceAll(placeholder, String(value));
        }

        return content;
    }

    /**
     * 获取提示词的 API 配置
     */
    getConfig(id: PromptId): PromptApiConfig | null {
        const prompt = this.index[id];
        if (!prompt) {
            throw new Error(`Prompt not found: ${id}`);
        }

        const config: PromptApiConfig = {};
        if (prompt.model) config.model = prompt.model;
        if (prompt.temperature !== undefined) config.temperature = prompt.temperature;
        if (prompt.maxTokens !== undefined) config.maxTokens = prompt.maxTokens;

        return Object.keys(config).length > 0 ? config : null;
    }

    /**
     * 获取完整的提示词信息
     */
    getPrompt(id: PromptId): PromptConfig {
        const prompt = this.index[id];
        if (!prompt) {
            throw new Error(`Prompt not found: ${id}`);
        }
        return prompt;
    }

    /**
     * 列出所有提示词 ID
     */
    listIds(): PromptId[] {
        return Object.keys(this.index) as PromptId[];
    }

    /**
     * 按前缀过滤提示词
     */
    filterByPrefix(prefix: string): PromptId[] {
        return this.listIds().filter(id => id.startsWith(prefix));
    }
}

// 单例导出
export const promptLoader = new PromptLoader();
