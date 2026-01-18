export const API_CONFIG = {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-v3.2',
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 30000
} as const;

export const API_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
} as const;
