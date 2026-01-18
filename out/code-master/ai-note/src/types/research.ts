export type PrimaryRole = 'developer' | 'pm' | 'designer' | 'other';

export type DeveloperSecondaryRole = 'frontend' | 'backend' | 'fullstack' | 'ai-ml' | 'devops';

export type SecondaryRole = DeveloperSecondaryRole | string;

export type PrimaryPurpose = 'product-development' | 'knowledge-base' | 'learning' | 'creative';

export type ContentAreaType = 'notes' | 'code' | 'assets';

export interface ContentArea {
    path: string;
    type: ContentAreaType;
    theme: string;
    techStack?: string[];
    fileCount?: number;
}

export interface ProjectComposition {
    hasNotes: boolean;
    hasCode: boolean;
    hasAssets: boolean;
    noteRatio: number;
    codeRatio: number;
}

export interface UserProfile {
    primaryRole: PrimaryRole;
    secondaryRole: SecondaryRole;
    currentFocus: string[];
    projectComposition: ProjectComposition;
    primaryPurpose: PrimaryPurpose;
    contentAreas: ContentArea[];
    lastAnalyzedAt: string;
    analysisVersion: number;
}

export type ResearchType = 'trending' | 'problem-solving' | 'deep-dive' | 'inspiration';

export type TopicSourceType = 'note' | 'code' | 'keyword';

export interface CandidateTopic {
    id: string;
    title: string;
    type: ResearchType;
    source: string;
    sourceType: TopicSourceType;
    confidence: number;
    keywords: string[];
    reason: string;
}

export interface DailyTopics {
    date: string;
    candidates: CandidateTopic[];
    selectedTopics: string[];
}

export interface ResearchHistoryItem {
    id: string;
    title: string;
    type: ResearchType;
    date: string;
    reportPath: string;
    keyPoints: string[];
    relatedKeywords: string[];
}

export interface ResearchHistoryIndex {
    topics: ResearchHistoryItem[];
    lastCleanupAt: string;
}

export interface ContentAnalysisResult {
    questions: string[];
    hotKeywords: string[];
    recentFocus: string[];
    codePatterns: string[];
    contentAreas: ContentArea[];
}

export interface DeduplicationResult {
    isDuplicate: boolean;
    overlapPercentage: number;
    suggestedAlternative?: string;
}

export interface ReportLengthConfig {
    min: number;
    max: number;
}

export interface ResearchConfig {
    enabled: boolean;
    dailyTime: string;
    topicsPerDay: number;
    models: {
        analysis: string;
        research: string;
    };
    deduplication: {
        keywordOverlapThreshold: number;
        strongDeduplicationDays: number;
        weakDeduplicationDays: number;
    };
    identity: {
        updateIntervalDays: number;
        fileChangeThreshold: number;
    };
    reportLength: {
        trending: ReportLengthConfig;
        'problem-solving': ReportLengthConfig;
        'deep-dive': ReportLengthConfig;
        inspiration: ReportLengthConfig;
    };
}

export const DEFAULT_RESEARCH_CONFIG: ResearchConfig = {
    enabled: true,
    dailyTime: '09:00',
    topicsPerDay: 3,
    models: {
        analysis: 'deepseek/deepseek-v3.2',
        research: 'openai/gpt-5.2'
    },
    deduplication: {
        keywordOverlapThreshold: 0.4,
        strongDeduplicationDays: 7,
        weakDeduplicationDays: 14
    },
    identity: {
        updateIntervalDays: 7,
        fileChangeThreshold: 20
    },
    reportLength: {
        trending: { min: 1500, max: 2500 },
        'problem-solving': { min: 800, max: 1500 },
        'deep-dive': { min: 1000, max: 2000 },
        inspiration: { min: 500, max: 800 }
    }
};

export interface IdentityAnalysisResponse {
    primaryRole: PrimaryRole;
    secondaryRole: SecondaryRole;
    currentFocus: string[];
    projectComposition: ProjectComposition;
    primaryPurpose: PrimaryPurpose;
    contentAreas: ContentArea[];
    confidence: number;
    reasoning: string;
}

export interface TopicGenerationResponse {
    title: string;
    type: ResearchType;
    source: string;
    sourceType: TopicSourceType;
    confidence: number;
    keywords: string[];
    reason: string;
}

export interface DeduplicationCheckResponse {
    isDuplicate: boolean;
    overlapPercentage: number;
    suggestedAlternative?: string;
}

export interface TopicSelectionResponse {
    selectedTopics: string[];
    reasoning: string;
}
