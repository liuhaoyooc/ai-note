import { ObsidianHelper } from '../utils/obsidianHelper';
import { StorageService } from './storageService';
import { ApiClient } from './apiClient';

interface UncertainFile {
    path: string;
    reason: string;
    suggestions: string[];
}

interface ClassificationDecision {
    path: string;
    targetDir: string;
    confidence: number;
    reason: string;
    uncertain: boolean;
    suggestions: string[];
}

interface ClassificationStatistics {
    total_files: number;
    confident_archived: number;
    uncertain: number;
    available_folders_count: number;
    recent_files_moved: number;
}

export class ClassifierService {
    private obsidianHelper: ObsidianHelper;
    private storage: StorageService;
    private apiClient: ApiClient;
    private confidenceThreshold = 0.7;

    constructor(obsidianHelper: ObsidianHelper, storage: StorageService, apiClient: ApiClient) {
        this.obsidianHelper = obsidianHelper;
        this.storage = storage;
        this.apiClient = apiClient;
        console.log('[ClassifierService] Initialized');
    }

    async classifyFiles(
        files: string[],
        folderSummaries: Map<string, any>,
        progressCallback?: (message: string) => void
    ): Promise<{ decisions: ClassificationDecision[]; stats: ClassificationStatistics }> {
        console.log(`[ClassifierService] Classifying ${files.length} files...`);

        const decisions: ClassificationDecision[] = [];
        const stats: ClassificationStatistics = {
            total_files: files.length,
            confident_archived: 0,
            uncertain: 0,
            available_folders_count: folderSummaries.size,
            recent_files_moved: 0
        };

        const batchSize = 5;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(files.length / batchSize);
            progressCallback?.(`Processing classification batch ${batchNum}/${totalBatches}`);

            const batchDecisions = await this.classifyBatch(batch, folderSummaries);

            decisions.push(...batchDecisions);

            for (const decision of batchDecisions) {
                if (decision.uncertain) {
                    stats.uncertain++;
                } else if (decision.confidence >= this.confidenceThreshold) {
                    stats.confident_archived++;
                } else {
                    stats.recent_files_moved++;
                }
            }
        }

        console.log(`[ClassifierService] Classification complete: ${stats.confident_archived} confident, ${stats.uncertain} uncertain, ${stats.recent_files_moved} moved`);

        return { decisions, stats };
    }

    private async classifyBatch(
        files: string[],
        folderSummaries: Map<string, any>
    ): Promise<ClassificationDecision[]> {
        const fileContents: Array<{ path: string; content: string }> = [];

        for (const path of files) {
            const fileObj = await this.obsidianHelper.findFile(path);
            if (fileObj) {
                try {
                    const content = await this.obsidianHelper.getFileContent(fileObj);
                    const preview = content.substring(0, 500);
                    fileContents.push({ path, content: preview });
                } catch (error) {
                    console.error(`[ClassifierService] Error reading ${path}:`, error);
                }
            }
        }

        const prompt = this.buildClassificationPrompt(fileContents, folderSummaries);

        try {
            const response = await this.apiClient.chat(prompt, { expectJson: true });
            const results = this.parseClassificationResults(response);

            const decisions: ClassificationDecision[] = results.map((result, index) => ({
                path: fileContents[index].path,
                targetDir: result.targetDir,
                confidence: result.confidence,
                reason: result.reason,
                uncertain: result.uncertain || result.confidence < this.confidenceThreshold,
                suggestions: result.suggestions || []
            }));

            return decisions;
        } catch (error) {
            console.error('[ClassifierService] Classification failed:', error);
            return files.map(path => ({
                path,
                targetDir: '_Unsorted',
                confidence: 0,
                reason: 'Classification error',
                uncertain: true,
                suggestions: []
            }));
        }
    }

    private buildClassificationPrompt(
        files: Array<{ path: string; content: string }>,
        folderSummaries: Map<string, any>
    ): string {
        const availableFolders = Array.from(folderSummaries.entries()).map(([path, summary]) => {
            return `${path}\n  主题: ${summary.theme}\n  关键词: ${summary.keywords.join(', ')}`;
        }).join('\n\n');

        const filesList = files.map((f, i) => {
            const preview = f.content.substring(0, 300).replace(/\n/g, ' ');
            return `${i + 1}. ${f.path}\n   内容预览: ${preview}...`;
        }).join('\n\n');

        return `你是一个智能笔记归档助手。请根据文件内容，将其分类到最合适的现有文件夹中。

## 重要规则

1. **只使用现有文件夹**：从下面的"可用文件夹"列表中选择，不要创建新文件夹
2. **优先匹配主题**：根据文件夹的主题和关键词选择最匹配的
3. **低置信度处理**：如果找不到合适的文件夹（置信度 < 0.7），标记为不确定
4. **不要建议新文件夹**：只从现有文件夹中选择，即使都不完美匹配

## 可用文件夹
${availableFolders || '(暂无文件夹，所有文件都将标记为不确定)'}

## 需要分类的文件
${filesList}

## 返回格式

请为每个文件返回 JSON 对象：
{
  "targetDir": "目标文件夹路径（必须从上面的可用文件夹中选择）",
  "confidence": 0.0-1.0 之间的置信度，
  "reason": "分类理由，说明为什么选择这个文件夹",
  "uncertain": true/false（当置信度 < 0.7 或找不到合适文件夹时为 true）,
  "suggestions": ["备选文件夹1", "备选文件夹2"]（仅当 uncertain 为 true 时提供，按优先级排序）
}

返回 JSON 数组格式，按顺序对应输入文件列表。`;
    }

    private parseClassificationResults(response: string): Array<{
        targetDir: string;
        confidence: number;
        reason: string;
        uncertain?: boolean;
        suggestions?: string[];
    }> {
        try {
            const parsed = JSON.parse(response);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [];
        } catch (error) {
            console.error('[ClassifierService] Failed to parse classification response:', error);
            return [];
        }
    }
}
