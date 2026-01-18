import { Notice } from 'obsidian';

const API_CONFIG = {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-v3.2',
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 30000
};

const API_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
};

export interface ApiCallOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    expectJson?: boolean;
    reasoning?: {
        effort?: 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';
        exclude?: boolean;
        enabled?: boolean;
    };
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    error?: {
        message: string;
    };
}

export class ApiClient {
    private apiKey: string;
    private config = API_CONFIG;

    constructor(apiKey: string) {
        this.apiKey = apiKey || '';
        console.log('[ApiClient] Initialized');
    }

    private ensureApiKey(): void {
        if (!this.apiKey) {
            throw new Error('Please configure API Key in plugin settings');
        }
    }

    private async callApi(prompt: string, options: ApiCallOptions = {}): Promise<string> {
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://obsidian.md',
                    'X-Title': 'AI Note Plugin'
                },
                body: JSON.stringify({
                    model: options.model || this.config.model,
                    messages: messages,
                    temperature: options.temperature ?? this.config.temperature,
                    max_tokens: options.maxTokens ?? this.config.maxTokens,
                    ...(options.reasoning && { reasoning: options.reasoning })
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${errorText}`);
            }

            const json: ChatResponse = await response.json();

            if (json.error) {
                throw new Error(json.error.message);
            } else if (json.choices && json.choices[0]) {
                return json.choices[0].message.content;
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('API request timeout');
            }
            throw error;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private stripMarkdownCodeBlocks(response: string): string {
        let cleaned = response;

        const codeBlockStartRegex = /^```(?:json)?\s*\n?/i;
        cleaned = cleaned.replace(codeBlockStartRegex, '');

        const codeBlockEndRegex = /\n?```\s*$/;
        cleaned = cleaned.replace(codeBlockEndRegex, '');

        return cleaned;
    }

    private isRetryableError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const message = error.message.toLowerCase();

        if (message.includes('api key')) {
            return false;
        }
        if (message.includes('quota') || message.includes('limit')) {
            return false;
        }
        if (message.includes('invalid model')) {
            return false;
        }

        if (message.includes('timeout')) {
            return true;
        }
        if (message.includes('network') || message.includes('econnrefused') || message.includes('fetch failed')) {
            return true;
        }
        if (message.includes('json') || message.includes('parse')) {
            return true;
        }

        return false;
    }

    async callApiWithRetry(prompt: string, options: ApiCallOptions = {}): Promise<string> {
        let lastError: Error | undefined;
        const { maxRetries, baseDelay, maxDelay } = API_RETRY_CONFIG;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.callApi(prompt, options);
                return response;
            } catch (error) {
                lastError = error as Error;

                if (!this.isRetryableError(error)) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                    console.warn(`[ApiClient] API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error);
                    await this.sleep(delay);
                }
            }
        }

        throw new Error(`API call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
    }

    async chat(prompt: string, options: ApiCallOptions = {}): Promise<string> {
        this.ensureApiKey();
        console.debug(`[ApiClient] Calling API with model: ${options.model || this.config.model}`);
        const response = await this.callApiWithRetry(prompt, options);
        console.debug(`[ApiClient] Response length: ${response.length} chars`);

        if (options.expectJson) {
            return this.stripMarkdownCodeBlocks(response);
        }

        return response;
    }

    updateApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        console.info('[ApiClient] API Key updated');
    }
}
