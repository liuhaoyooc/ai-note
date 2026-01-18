import type { CandidateTopic, UserProfile, ResearchType } from '../types/research';
import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';
import { PathManager } from './pathManager';
import { formatDate } from '../utils/dateHelper';
import { DeduplicationService } from './deduplicationService';
import { PromptLoader } from '../utils/promptsLoader';
import type { PromptVariables } from '../utils/promptTypes';

const RESEARCH_MODEL = 'openai/gpt-5.2';

export class ResearchService {
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private apiClient: ApiClient;
    private pathManager: PathManager;
    private deduplicationService: DeduplicationService;
    private promptLoader: PromptLoader;

    constructor(obsidianHelper: ObsidianHelper, storage: StorageService, apiClient: ApiClient, pathManager: PathManager) {
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.apiClient = apiClient;
        this.pathManager = pathManager;
        this.deduplicationService = new DeduplicationService(storage, apiClient, pathManager);
        this.promptLoader = new PromptLoader();
        console.log('[ResearchService] Initialized');
    }

    async generateTopics(profile: UserProfile): Promise<CandidateTopic[]> {
        console.log('[ResearchService] Generating research topics...');

        const prompt = await this.buildTopicPrompt(profile);

        try {
            const response = await this.apiClient.chat(prompt, { expectJson: true });
            const topics = JSON.parse(response);

            if (!Array.isArray(topics)) {
                console.error('[ResearchService] Invalid response format');
                return [];
            }

            const topicsWithIds = topics.map((t, index) => ({
                ...t,
                id: `${formatDate(new Date())}-topic-${index + 1}`
            }));

            console.log(`[ResearchService] Generated ${topicsWithIds.length} topics`);

            // 应用去重过滤
            const filteredTopics = await this.deduplicationService.filterDuplicates(topicsWithIds);

            return filteredTopics;
        } catch (error) {
            console.error('[ResearchService] Failed to generate topics:', error);
            throw error;
        }
    }

    async generateReport(topic: CandidateTopic, profile: UserProfile): Promise<string> {
        console.log(`[ResearchService] Generating research report for: ${topic.title}`);

        // 根据报告类型选择提示词 ID
        const promptId = this.getPromptIdForType(topic.type);
        const prompt = this.buildReportPrompt(promptId, topic, profile);

        // 获取提示词的 API 配置
        const apiConfig = this.promptLoader.getConfig(promptId);

        try {
            const report = await this.apiClient.chat(prompt, {
                model: apiConfig?.model || RESEARCH_MODEL,
                expectJson: false,
                maxTokens: apiConfig?.maxTokens || 8000,
                temperature: apiConfig?.temperature || 0.7,
                reasoning: {
                    effort: 'high'  // 使用高推理强度进行调研
                }
            });

            const reportPath = await this.saveReport(topic, report);

            const today = formatDate(new Date());
            const slug = this.slugify(topic.title);
            const historyItem = {
                id: `${today}-${slug}`,
                title: topic.title,
                type: topic.type,
                date: today,
                reportPath,
                keyPoints: this.extractKeyPoints(report),
                relatedKeywords: topic.keywords
            };

            await this.addToHistory(historyItem);

            console.log(`[ResearchService] Report saved to: ${reportPath}`);
            return reportPath;
        } catch (error) {
            console.error(`[ResearchService] Failed to generate report for ${topic.title}:`, error);
            throw error;
        }
    }

    private getPromptIdForType(type: ResearchType): string {
        switch (type) {
            case 'trending':
                return 'research.03-report-trending';
            case 'problem-solving':
                return 'research.04-report-problem-solving';
            case 'deep-dive':
                return 'research.05-report-deep-dive';
            case 'inspiration':
                return 'research.06-report-inspiration';
            default:
                return 'research.03-report-trending';
        }
    }

    private buildTopicPrompt(profile: UserProfile): string {
        // 提取技术栈列表（从 contentAreas 中收集）
        const techStackSet = new Set<string>();
        profile.contentAreas.forEach(area => {
            if (area.techStack) {
                area.techStack.forEach(tech => techStackSet.add(tech));
            }
        });

        // 构建内容区域描述（用于 QUESTIONS 和 HOT_KEYWORDS）
        const contentAreasDesc = profile.contentAreas.map(area =>
            `${area.path}: ${area.theme}${area.techStack ? ` (技术栈: ${area.techStack.join(', ')})` : ''}`
        ).join('\n');

        // 准备变量
        const variables: PromptVariables = {
            PRIMARY_ROLE: profile.primaryRole,
            SECONDARY_ROLE: profile.secondaryRole,
            CURRENT_FOCUS: profile.currentFocus.join(', '),
            PRIMARY_PURPOSE: profile.primaryPurpose,
            QUESTIONS: contentAreasDesc || '暂无',
            HOT_KEYWORDS: profile.currentFocus.join(', ') || '暂无',
            CODE_PATTERNS: Array.from(techStackSet).join(', ') || '暂无'
        };

        // 使用 PromptLoader 填充变量
        return this.promptLoader.fill('research.01-topic-generation' as any, variables);
    }

    private buildReportPrompt(promptId: string, topic: CandidateTopic, profile: UserProfile): string {
        // 准备变量
        const variables: PromptVariables = {
            PRIMARY_ROLE: profile.primaryRole,
            SECONDARY_ROLE: profile.secondaryRole,
            CURRENT_FOCUS: profile.currentFocus.join(', '),
            PRIMARY_PURPOSE: profile.primaryPurpose,
            TOPIC_TITLE: topic.title
        };

        // 使用 PromptLoader 填充变量
        return this.promptLoader.fill(promptId as any, variables);
    }

    private async saveReport(topic: CandidateTopic, content: string): Promise<string> {
        const today = formatDate(new Date());
        const slug = this.slugify(topic.title);
        const fullPath = this.pathManager.getResearchReportPath(today, slug);

        await this.storage.writeMarkdown(this.pathManager.researchReportsDir, `/${today}-${slug}.md`, content);
        return fullPath;
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5f\s_-]+/g, '-')
            .trim()
            .slice(0, 50);
    }

    private extractKeyPoints(report: string): string[] {
        const keyPoints: string[] = [];

        const headingMatches = report.match(/^#{1,3}\s+.+$/gm);
        if (headingMatches) {
            keyPoints.push(...headingMatches.map(h => h.replace(/^#{1,3}\s+/, '')));
        }

        const listMatches = report.match(/^[-*]\s+\*\s*(.+?)\*\*/gm);
        if (listMatches) {
            const points = listMatches.map(m => m.replace(/^[-*]\s+\*\s*|\*\*/g, '').trim());
            keyPoints.push(...points.filter((p: string) => p.length > 10));
        }

        return [...new Set(keyPoints)].slice(0, 10);
    }

    private async addToHistory(item: any): Promise<void> {
        const historyPath = this.pathManager.getResearchHistoryIndexPath();
        let history: { topics: any[]; lastCleanupAt?: string } = await this.storage.readJson<any>(historyPath) || { topics: [] };

        history.topics.push(item);
        history.lastCleanupAt = new Date().toISOString();

        await this.storage.writeJson(historyPath, history);
    }

    async getHistory(): Promise<any> {
        const historyPath = this.pathManager.getResearchHistoryIndexPath();
        return await this.storage.readJson<any>(historyPath) || { topics: [] };
    }
}
