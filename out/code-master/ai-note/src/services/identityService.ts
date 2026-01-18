import type { UserProfile, ContentArea } from '../types/research';
import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';
import { PathManager } from './pathManager';
import { TFile } from 'obsidian';

const IDENTITY_VERSION = 1;
const MIN_SUMMARIES_FOR_ANALYSIS = 5;

export class IdentityService {
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private apiClient: ApiClient;
    private pathManager: PathManager;

    constructor(obsidianHelper: ObsidianHelper, storage: StorageService, apiClient: ApiClient, pathManager: PathManager) {
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.apiClient = apiClient;
        this.pathManager = pathManager;
        console.log('[IdentityService] Initialized');
    }

    async getProfile(): Promise<UserProfile | null> {
        const profilePath = this.pathManager.getIdentityPath();
        return await this.storage.readJson<UserProfile>(profilePath);
    }

    async needsUpdate(): Promise<boolean> {
        const profile = await this.getProfile();
        if (!profile) return true;

        const lastAnalyzed = new Date(profile.lastAnalyzedAt);
        const daysSinceLastAnalysis = (Date.now() - lastAnalyzed.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastAnalysis >= 7;
    }

    async analyzeAndUpdate(): Promise<UserProfile | null> {
        const summaries = await this.collectSummaries();
        if (summaries.length < MIN_SUMMARIES_FOR_ANALYSIS) {
            console.warn(`[IdentityService] Insufficient summaries (${summaries.length}/${MIN_SUMMARIES_FOR_ANALYSIS}), skipping analysis`);
            return null;
        }

        console.log(`[IdentityService] Analyzing ${summaries.length} summaries...`);

        const folderSummaries = await this.analyzeFolders();
        const contentAreas = await this.analyzeContentAreas();

        const prompt = this.buildAnalysisPrompt(summaries, folderSummaries, contentAreas);

        try {
            const response = await this.apiClient.chat(prompt, { expectJson: true });
            const analysisResult = JSON.parse(response);

            if (!this.validateAnalysisResult(analysisResult)) {
                console.error('[IdentityService] Invalid analysis result from AI');
                return null;
            }

            const profile: UserProfile = {
                primaryRole: analysisResult.primaryRole,
                secondaryRole: analysisResult.secondaryRole,
                currentFocus: analysisResult.currentFocus,
                projectComposition: analysisResult.projectComposition,
                primaryPurpose: analysisResult.primaryPurpose,
                contentAreas: contentAreas,
                lastAnalyzedAt: new Date().toISOString(),
                analysisVersion: IDENTITY_VERSION
            };

            await this.saveProfile(profile);
            console.log(`[IdentityService] Profile updated: ${profile.primaryRole}/${profile.secondaryRole}`);
            return profile;
        } catch (error) {
            console.error('[IdentityService] Analysis failed:', error);
            throw error;
        }
    }

    private async collectSummaries(): Promise<Array<{ path: string; summary: string; keywords: string[] }>> {
        const result: Array<{ path: string; summary: string; keywords: string[] }> = [];
        const cachePath = this.pathManager.summariesDir;

        try {
            const files = await this.storage.listCacheFiles(cachePath, 'json');

            for (const file of files) {
                try {
                    const summaryData = await this.storage.readJson<{ summary: string; keywords: string[] }>(file);
                    if (summaryData && summaryData.summary) {
                        result.push({
                            path: file.replace(cachePath, '').replace(/^\/+/, '').replace('.json', ''),
                            summary: summaryData.summary,
                            keywords: summaryData.keywords || []
                        });
                    }
                } catch (error) {
                    console.error(`[IdentityService] Error reading ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('[IdentityService] Error collecting summaries:', error);
        }

        return result;
    }

    private async analyzeFolders(): Promise<Map<string, { path: string; theme: string; keywords: string[] }>> {
        const folders = new Map<string, { path: string; theme: string; keywords: string[] }>();
        const rootFiles = await this.obsidianHelper.getAllMarkdownFiles();

        const dirMap = new Map<string, any[]>();
        for (const file of rootFiles) {
            const parts = file.path.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
            if (!dirMap.has(dir)) {
                dirMap.set(dir, []);
            }
            dirMap.get(dir)!.push(file);
        }

        for (const [dirPath, dirFiles] of dirMap) {
            if (dirPath !== '/' && !dirPath.startsWith('.ai-note')) {
                folders.set(dirPath, {
                    path: dirPath,
                    theme: `Files in ${dirPath}`,
                    keywords: ['notes', 'documents']
                });
            }
        }

        return folders;
    }

    private async analyzeContentAreas(): Promise<ContentArea[]> {
        const areas: ContentArea[] = [];
        const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp']);
        const noteExtensions = new Set(['.md', '.txt']);

        const rootFiles = await this.obsidianHelper.getAllMarkdownFiles();

        const dirMap = new Map<string, Set<string>>();
        for (const file of rootFiles) {
            const parts = file.path.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
            if (!dirMap.has(dir)) {
                dirMap.set(dir, new Set());
            }
            
            const ext = '.' + file.extension;
            if (codeExtensions.has(ext)) {
                dirMap.get(dir)!.add('code');
            } else if (noteExtensions.has(ext)) {
                dirMap.get(dir)!.add('notes');
            }
        }

        for (const [dirPath, types] of dirMap) {
            if (dirPath !== '/' && !dirPath.startsWith('.ai-note')) {
                const hasCode = types.has('code');
                const hasNotes = types.has('notes');

                if (hasCode && !hasNotes) {
                    areas.push({
                        path: dirPath,
                        type: 'code',
                        theme: `${dirPath} code`,
                        techStack: ['TypeScript', 'Obsidian']
                    });
                } else if (hasNotes && !hasCode) {
                    areas.push({
                        path: dirPath,
                        type: 'notes',
                        theme: `${dirPath} notes`
                    });
                } else if (hasCode && hasNotes) {
                    areas.push({
                        path: dirPath,
                        type: 'code',
                        theme: `${dirPath} mixed`,
                        techStack: ['TypeScript', 'Obsidian']
                    });
                }
            }
        }

        return areas;
    }

    private buildAnalysisPrompt(
        summaries: Array<{ path: string; summary: string; keywords: string[] }>,
        folderSummaries: Map<string, any>,
        contentAreas: ContentArea[]
    ): string {
        const workSummaries = summaries.slice(0, 30).map(s =>
            `- **${s.path}**: ${s.summary} (keywords: [${s.keywords.map(k => `"${k}"`).join(', ')}])`
        ).join('\n');

        const folderList = Array.from(folderSummaries.values()).map(f =>
            `- **${f.path}**: ${f.theme} ([${f.keywords.join(', ')}])`
        ).join('\n');

        const areaList = contentAreas.map(a =>
            `- **${a.path}**: 类型=${a.type}, 主题=${a.theme}${a.techStack ? `, 技术栈=[${a.techStack.join(', ')}]` : ''}`
        ).join('\n');

        return `请分析以下用户笔记库信息，推断用户的身份画像。

## 笔记摘要（最近 30 个）
${workSummaries}

## 文件夹主题
${folderList}

## 内容区域分析
${areaList}

请以 JSON 格式返回分析结果：
{
  "primaryRole": "developer" | "pm" | "designer" | "other"（一级身份：用户的主要职业身份）
  "secondaryRole": "frontend" | "backend" | "fullstack" | "ai-ml" | "devops" | string（二级身份：更具体的角色）
  "currentFocus": ["关注点1", "关注点2", "关注点3"]（当前的工作重点或兴趣方向，3-5 个）
  "projectComposition": {
    "hasNotes": boolean,
    "hasCode": boolean,
    "hasAssets": boolean,
    "noteRatio": number (0-1, 笔记占比),
    "codeRatio": number (0-1, 代码占比)
  },
  "primaryPurpose": "product-development" | "knowledge-base" | "learning" | "creative"（项目的主要用途）
  "contentAreas": [
    {
      "path": "路径",
      "type": "notes" | "code" | "assets",
      "theme": "主题描述",
      "techStack": ["技术1", "技术2"] (仅 code 类型需要)
    }
  ]
}

分析要求：
- primaryRole: 选择最符合的一级身份
- secondaryRole: 根据内容和项目组成选择最合适的二级身份
- currentFocus: 从笔记内容中提取 3-5 个当前关注的技术主题或工作方向
- projectComposition: 统计不同类型内容的比例
- primaryPurpose: 根据笔记主题和内容推断项目主要用途
- contentAreas: 分析每个主要目录的内容类型和主题`;
    }

    private validateAnalysisResult(result: any): boolean {
        return result &&
               result.primaryRole &&
               result.secondaryRole &&
               Array.isArray(result.currentFocus) &&
               result.projectComposition &&
               result.primaryPurpose &&
               Array.isArray(result.contentAreas);
    }

    private async saveProfile(profile: UserProfile): Promise<void> {
        await this.storage.writeJson(this.pathManager.getIdentityPath(), profile);
    }
}
