import type {
    CandidateTopic,
    ResearchHistoryItem,
    DeduplicationResult,
    DeduplicationCheckResponse
} from '../types/research';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';
import { PathManager } from './pathManager';
import { DEFAULT_RESEARCH_CONFIG } from '../types/research';

const STRONG_DEDUP_DAYS = 7;
const WEAK_DEDUP_DAYS = 14;
const KEYWORD_OVERLAP_THRESHOLD = 0.4;

export class DeduplicationService {
    private storage: StorageService;
    private apiClient: ApiClient;
    private pathManager: PathManager;
    private config = DEFAULT_RESEARCH_CONFIG.deduplication;

    constructor(storage: StorageService, apiClient: ApiClient, pathManager: PathManager) {
        this.storage = storage;
        this.apiClient = apiClient;
        this.pathManager = pathManager;
        console.log('[DeduplicationService] Initialized');
    }

    /**
     * 过滤重复主题
     * @param candidates 候选主题列表
     * @returns 过滤后的主题列表
     */
    async filterDuplicates(candidates: CandidateTopic[]): Promise<CandidateTopic[]> {
        const history = await this.getRecentHistory(this.config.weakDeduplicationDays);

        if (history.length === 0) {
            console.log('[DeduplicationService] No history found, skipping deduplication');
            return candidates;
        }

        const filtered: CandidateTopic[] = [];

        for (const candidate of candidates) {
            const isDuplicate = await this.checkDuplicate(candidate, history);
            if (!isDuplicate.isDuplicate) {
                filtered.push(candidate);
            } else {
                console.log(`[DeduplicationService] Filtered duplicate: ${candidate.title} (overlap: ${isDuplicate.overlapPercentage}%)`);

                if (isDuplicate.suggestedAlternative) {
                    const alternative = this.createAlternativeTopic(candidate, isDuplicate.suggestedAlternative);
                    filtered.push(alternative);
                }
            }
        }

        console.log(`[DeduplicationService] Filtered ${candidates.length - filtered.length} duplicates`);
        return filtered;
    }

    /**
     * 检查单个主题是否重复
     */
    private async checkDuplicate(
        candidate: CandidateTopic,
        history: ResearchHistoryItem[]
    ): Promise<DeduplicationResult> {
        for (const historyItem of history) {
            const keywordOverlap = this.calculateKeywordOverlap(
                candidate.keywords,
                historyItem.relatedKeywords
            );

            if (keywordOverlap < this.config.keywordOverlapThreshold) {
                continue;
            }

            const daysSinceResearch = this.getDaysSince(historyItem.date);
            const threshold = daysSinceResearch <= STRONG_DEDUP_DAYS
                ? 0.3
                : 0.6;

            if (keywordOverlap >= threshold) {
                console.log(`[DeduplicationService] High overlap detected: ${candidate.title} vs ${historyItem.title}`);
                const aiResult = await this.checkWithAI(candidate, historyItem);
                if (aiResult.isDuplicate) {
                    return aiResult;
                }
            }
        }

        return { isDuplicate: false, overlapPercentage: 0 };
    }

    /**
     * 计算关键词重叠度 (Jaccard 相似系数)
     */
    private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
        const set1 = new Set(keywords1.map(k => k.toLowerCase()));
        const set2 = new Set(keywords2.map(k => k.toLowerCase()));

        let intersection = 0;
        for (const k of set1) {
            if (set2.has(k)) intersection++;
        }

        const union = new Set([...set1, ...set2]).size;
        return union > 0 ? intersection / union : 0;
    }

    /**
     * 计算距离今天的天数
     */
    private getDaysSince(dateStr: string): number {
        const date = new Date(dateStr);
        const now = new Date();
        return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    }

    /**
     * 使用 AI 进行语义去重判断
     */
    private async checkWithAI(
        candidate: CandidateTopic,
        historyItem: ResearchHistoryItem
    ): Promise<DeduplicationResult> {
        const prompt = `判断以下两个主题是否本质上在讨论同一件事：

主题A（已调研）：
- 标题：${historyItem.title}
- 类型：${historyItem.type}
- 核心知识点：${historyItem.keyPoints.join(', ')}
- 调研日期：${historyItem.date}

主题B（候选）：
- 标题：${candidate.title}
- 类型：${candidate.type}
- 推荐理由：${candidate.reason}

请回答（JSON 格式）：
{
  "isDuplicate": true/false,
  "overlapPercentage": 0-100,
  "suggestedAlternative": "如果重复，建议一个不同但相关的调研角度（可选）"
}

请直接返回 JSON 对象，不要包含其他描述文字。`;

        try {
            const response = await this.apiClient.chat(prompt, { expectJson: true });
            const result = JSON.parse(response) as DeduplicationCheckResponse;

            return {
                isDuplicate: result.isDuplicate,
                overlapPercentage: result.overlapPercentage,
                suggestedAlternative: result.suggestedAlternative
            };
        } catch (error) {
            console.error('[DeduplicationService] AI deduplication check failed:', error);
            return { isDuplicate: false, overlapPercentage: 0 };
        }
    }

    /**
     * 创建替代主题
     */
    private createAlternativeTopic(
        original: CandidateTopic,
        alternativeTitle: string
    ): CandidateTopic {
        return {
            ...original,
            id: `${original.id}-alt`,
            title: alternativeTitle,
            reason: `基于 "${original.title}" 的替代角度`
        };
    }

    /**
     * 获取最近的调研历史
     */
    private async getRecentHistory(days: number): Promise<ResearchHistoryItem[]> {
        const historyPath = this.pathManager.getResearchHistoryIndexPath();
        const history = await this.storage.readJson<{ topics: ResearchHistoryItem[] }>(historyPath);

        if (!history || !history.topics) {
            return [];
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return history.topics.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    }
}
