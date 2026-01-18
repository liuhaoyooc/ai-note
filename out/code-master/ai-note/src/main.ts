import { Plugin, Notice, App, PluginSettingTab, Setting } from 'obsidian';
import { PathManager } from './services/pathManager';
import { StorageService } from './services/storageService';
import { ObsidianHelper } from './utils/obsidianHelper';
import { ApiClient } from './services/apiClient';
import { AiNoteSettings, DEFAULT_SETTINGS } from './types/config';
import { SummarizerService } from './services/summarizerService';
import { ClassifierService } from './services/classifierService';
import { ReviewService } from './services/reviewService';
import { IdentityService } from './services/identityService';
import { ResearchService } from './services/researchService';
import { SchedulerService } from './services/schedulerService';

export default class AiNotePlugin extends Plugin {
    settings: AiNoteSettings;
    pathManager: PathManager;
    storage: StorageService;
    obsidianHelper: ObsidianHelper;
    apiClient: ApiClient;
    summarizerService: SummarizerService;
    classifierService: ClassifierService;
    reviewService: ReviewService;
    identityService: IdentityService;
    researchService: ResearchService;
    schedulerService: SchedulerService;

    // Status Bar items
    private statusBarItems: {
        archive?: import('obsidian').StatusBarBarItem;
        summary?: import('obsidian').StatusBarBarItem;
    } = {};

    async onload() {
        console.log('[AI Note] Loading plugin...');

        try {
            await this.loadSettings();

            const pluginDir = this.manifest.dir || 'plugins/ai-note';
            this.pathManager = new PathManager(pluginDir, '', this.settings.paths);
            console.log('[AI Note] PathManager created with plugin dir:', pluginDir);

            this.storage = new StorageService(this.app.vault, pluginDir, this.pathManager);
            await this.storage.initialize();
            console.log('[AI Note] Storage initialized');

            this.obsidianHelper = new ObsidianHelper(this.app.vault, this.app.metadataCache);

            this.apiClient = new ApiClient(this.settings.apiKey);
            console.log('[AI Note] API client created');

            this.summarizerService = new SummarizerService(
                this.apiClient,
                this.obsidianHelper,
                this.storage,
                this.pathManager
            );
            console.log('[AI Note] Summarizer service created');

            this.classifierService = new ClassifierService(
                this.obsidianHelper,
                this.storage,
                this.apiClient
            );
            console.log('[AI Note] Classifier service created');

            this.reviewService = new ReviewService(
                this.obsidianHelper,
                this.storage,
                this.apiClient,
                this.pathManager
            );
            console.log('[AI Note] Review service created');

            this.identityService = new IdentityService(
                this.obsidianHelper,
                this.storage,
                this.apiClient,
                this.pathManager
            );
            console.log('[AI Note] Identity service created');

            this.researchService = new ResearchService(
                this.obsidianHelper,
                this.storage,
                this.apiClient,
                this.pathManager
            );
            console.log('[AI Note] Research service created');

            // 初始化定时任务服务
            this.schedulerService = new SchedulerService(this);
            console.log('[AI Note] Scheduler service created');

            this.addCommands();
            console.log('[AI Note] Commands registered');

            this.addSettingTab(new AiNoteSettingTab(this.app, this));
            console.log('[AI Note] Settings tab added');

            this.addRibbonIcons();
            console.log('[AI Note] Ribbon icons added');

            this.registerStatusBarItems();
            console.log('[AI Note] Status bar items registered');

            // 启动定时任务
            this.schedulerService.start();
            console.log('[AI Note] Scheduler started');

            // 延迟检查补执行复盘
            this.schedulerService.checkAndRunMissedReviews();

            console.log('[AI Note] Plugin loaded successfully');
        } catch (error) {
            console.error('[AI Note] Error loading plugin:', error);
            new Notice('Failed to load AI Note plugin. Check console for details.');
        }
    }

    async onunload() {
        console.log('[AI Note] Unloading plugin...');

        // 停止定时任务
        if (this.schedulerService) {
            this.schedulerService.stop();
        }
    }

    async loadSettings() {
        try {
            const savedData = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
            console.log('[AI Note] Settings loaded');
        } catch (error) {
            console.error('[AI Note] Error loading settings:', error);
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    async saveSettings() {
        try {
            this.apiClient.updateApiKey(this.settings.apiKey);
            await this.saveData(this.settings);
            console.log('[AI Note] Settings saved');
        } catch (error) {
            console.error('[AI Note] Error saving settings:', error);
            new Notice('Failed to save settings');
        }
    }

    addCommands() {
        try {
            this.addCommand({
                id: 'archive-files',
                name: 'Archive files',
                callback: () => this.executeArchive()
            });

            this.addCommand({
                id: 'generate-daily-review',
                name: 'Generate daily review',
                callback: () => this.generateDailyReview()
            });

            this.addCommand({
                id: 'generate-weekly-review',
                name: 'Generate weekly review',
                callback: () => this.generateWeeklyReview()
            });

            this.addCommand({
                id: 'generate-research',
                name: 'Generate research',
                callback: () => this.generateResearch()
            });
        } catch (error) {
            console.error('[AI Note] Error adding commands:', error);
            new Notice('Failed to register commands');
        }
    }

    addRibbonIcons() {
        try {
            this.addRibbonIcon('box-archive', 'Archive files', () => this.executeArchive());
            this.addRibbonIcon('list-checks', 'Generate review', () => this.generateDailyReview());
            this.addRibbonIcon('search', 'Generate research', () => this.generateResearch());
        } catch (error) {
            console.error('[AI Note] Error adding ribbon icons:', error);
            new Notice('Failed to add ribbon icons');
        }
    }

    registerStatusBarItems() {
        // 注册归档状态栏
        this.statusBarItems.archive = this.addStatusBarItem();
        this.statusBarItems.archive.setText('归档');

        // 注册摘要状态栏
        this.statusBarItems.summary = this.addStatusBarItem();
        this.statusBarItems.summary.setText('摘要');
    }

    async executeArchive() {
        console.log('[AI Note] Archive command executed');

        if (!this.settings.apiKey) {
            new Notice('Please configure API Key in plugin settings first');
            return;
        }

        this.statusBarItems.archive?.setText('开始归档...');

        try {
            // Step 1: Always generate summaries first (shared foundation)
            const { summaryStats } = await this.summarizerService.run((message) => {
                this.statusBarItems.archive?.setText(message);
            });

            console.log('[AI Note] Summarization results:', `${summaryStats.new_summaries} new, ${summaryStats.updated_summaries} updated, ${summaryStats.failed} failed`);

            // Step 2: Generate folder summaries
            await this.summarizerService.generateFolderSummaries((message) => {
                this.statusBarItems.archive?.setText(message);
            });

            const folderSummaries = await this.summarizerService.getFolderSummaries();

            // Step 3: AI classify files for archiving
            this.statusBarItems.archive?.setText('AI 分类中...');

            const files = await this.obsidianHelper.getAllMarkdownFiles();

            const rootFiles = files.filter(f => {
                const inRoot = !f.path.includes('/');
                const notHidden = !this.pathManager.isHiddenDirectory(
                    f.path,
                    this.settings.archiving.hiddenDirectories
                );
                return inRoot && notHidden;
            });

            const unsortedDir = this.pathManager.unsortedDir;
            const unsortedFiles = files.filter(f => {
                return f.path.startsWith(unsortedDir + '/');
            });

            const filesToClassify = [...rootFiles, ...unsortedFiles];

            const { decisions } = await this.classifierService.classifyFiles(
                filesToClassify.map(f => f.path),
                folderSummaries,
                (message) => {
                    this.statusBarItems.archive?.setText(message);
                }
            );

            // Step 4: Move confident files
            const confidentFiles = decisions.filter(d => !d.uncertain && d.confidence >= 0.7);
            if (confidentFiles.length > 0) {
                const movedFiles = confidentFiles.map(d => ({
                    path: d.path,
                    targetDir: d.targetDir
                }));

                const total = movedFiles.length;
                for (let i = 0; i < movedFiles.length; i++) {
                    this.statusBarItems.archive?.setText(`归档中: ${i + 1}/${total}`);
                    await this.handleManualArchive([movedFiles[i]]);
                }

                const movedFilesForUpdate = movedFiles.map(f => ({
                    from: f.path,
                    to: `${f.targetDir}/${f.path.split('/').pop()}`
                }));
                await this.summarizerService.updateFolderSummariesForMovedFiles(movedFilesForUpdate);

                this.statusBarItems.archive?.setText(`归档完成: ${total} 个文件`);
                setTimeout(() => {
                    this.statusBarItems.archive?.setText('归档');
                }, 5000);
            }

            // Step 5: Move uncertain files to unsorted
            const uncertainFiles = decisions.filter(d => d.uncertain);

            if (uncertainFiles.length > 0) {
                const movedUncertainFiles = uncertainFiles.map(d => ({
                    path: d.path,
                    targetDir: unsortedDir
                }));

                const total = movedUncertainFiles.length;
                for (let i = 0; i < movedUncertainFiles.length; i++) {
                    this.statusBarItems.archive?.setText(`移至待整理: ${i + 1}/${total}`);
                    await this.handleManualArchive([movedUncertainFiles[i]]);
                }

                const movedFilesForUpdate = movedUncertainFiles.map(f => ({
                    from: f.path,
                    to: `${f.targetDir}/${f.path.split('/').pop()}`
                }));
                await this.summarizerService.updateFolderSummariesForMovedFiles(movedFilesForUpdate);

                this.statusBarItems.archive?.setText(`${total} 个文件已移至待整理`);
                setTimeout(() => {
                    this.statusBarItems.archive?.setText('归档');
                }, 3000);
            }

        } catch (error) {
            console.error('[AI Note] Archive error:', error);
            this.statusBarItems.archive?.setText('归档失败');
            setTimeout(() => {
                this.statusBarItems.archive?.setText('归档');
            }, 3000);
        }
    }

    async handleManualArchive(decisions: Array<{ path: string; targetDir: string }>): Promise<void> {
        console.log('[AI Note] Processing manual archive decisions...');

        for (const decision of decisions) {
            try {
                const fileObj = await this.obsidianHelper.findFile(decision.path);
                if (fileObj) {
                    const newPath = `${decision.targetDir}/${fileObj.basename}`;
                    await this.obsidianHelper.createFolder(decision.targetDir);
                    await this.obsidianHelper.moveFile(fileObj, newPath);
                    console.log(`[AI Note] Moved: ${decision.path} -> ${newPath}`);
                }
            } catch (error) {
                console.error(`[AI Note] Failed to move ${decision.path}:`, error);
            }
        }
    }

    async generateDailyReview() {
        console.log('[AI Note] Daily review command executed');

        this.statusBarItems.summary?.setText('开始复盘...');

        try {
            const reviewPath = await this.reviewService.generateDailyReview(this.settings.review.maxDiffLines);

            this.statusBarItems.summary?.setText('复盘完成');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

            return reviewPath;
        } catch (error) {
            console.error('[AI Note] Daily review error:', error);

            this.statusBarItems.summary?.setText('复盘失败');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

            throw error;
        }
    }

    async generateWeeklyReview() {
        console.log('[AI Note] Weekly review command executed');

        this.statusBarItems.summary?.setText('开始周复盘...');

        try {
            const reviewPath = await this.reviewService.generateWeeklyReview();

            this.statusBarItems.summary?.setText('周复盘完成');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

            return reviewPath;
        } catch (error) {
            console.error('[AI Note] Weekly review error:', error);

            this.statusBarItems.summary?.setText('周复盘失败');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

            throw error;
        }
    }

    async generateResearch() {
        console.log('[AI Note] Research command executed');

        if (!this.settings.apiKey) {
            this.statusBarItems.summary?.setText('需要配置 API Key');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);
            return;
        }

        try {
            // Step 1: Always generate summaries first (cache handles duplicates)
            this.statusBarItems.summary?.setText('扫描文件摘要...');
            const { summaryStats } = await this.summarizerService.run((message) => {
                this.statusBarItems.summary?.setText(message);
            });

            console.log(`[AI Note] Summary stats: ${summaryStats.new_summaries} new, ${summaryStats.updated_summaries} updated, ${summaryStats.failed} failed`);

            // Step 2: Generate folder summaries for better classification
            await this.summarizerService.generateFolderSummaries((message) => {
                this.statusBarItems.summary?.setText(message);
            });

            // Step 3: Check and auto-generate/update user identity
            let profile = await this.identityService.getProfile();
            const needsUpdate = await this.identityService.needsUpdate();

            // Define constant for maximum number of topics to process
            const MAX_TOPICS_TO_PROCESS = 3;

            if (!profile) {
                this.statusBarItems.summary?.setText('生成用户身份中...');
                const newProfile = await this.identityService.analyzeAndUpdate();
                if (!newProfile) {
                    const errorMsg = '身份生成失败-摘要不足:请先生成更多笔记摘要';
                    this.statusBarItems.summary?.setText(errorMsg);
                    new Notice(errorMsg);
                    setTimeout(() => {
                        this.statusBarItems.summary?.setText('摘要');
                    }, 3000);
                    return;
                }
                profile = newProfile;
                this.statusBarItems.summary?.setText('身份已生成');
            } else if (needsUpdate) {
                this.statusBarItems.summary?.setText('更新用户身份...');
                const updatedProfile = await this.identityService.analyzeAndUpdate();
                if (updatedProfile) {
                    profile = updatedProfile;
                    this.statusBarItems.summary?.setText('身份已更新');
                }
            }

            // Step 4: Generate research topics
            this.statusBarItems.summary?.setText('生成调研主题...');
            const topics = await this.researchService.generateTopics(profile);

            this.statusBarItems.summary?.setText(`生成 ${topics.length} 个调研报告`);

            // Step 5: Generate reports for top topics
            const selectedTopics = topics.slice(0, Math.min(MAX_TOPICS_TO_PROCESS, topics.length));
            for (let i = 0; i < selectedTopics.length; i++) {
                this.statusBarItems.summary?.setText(`生成报告 ${i + 1}/${selectedTopics.length}`);
                await this.researchService.generateReport(selectedTopics[i], profile);
            }

            this.statusBarItems.summary?.setText('调研完成');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

        } catch (error) {
            console.error('[AI Note] Research error:', error);

            this.statusBarItems.summary?.setText('调研失败');
            setTimeout(() => {
                this.statusBarItems.summary?.setText('摘要');
            }, 3000);

            throw error;
        }
    }
}

class AiNoteSettingTab extends PluginSettingTab {
    plugin: AiNotePlugin;

    constructor(app: App, plugin: AiNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'AI Note Settings' });

        new Setting(containerEl)
            .setName('OpenRouter API Key')
            .setDesc('Enter your OpenRouter API Key')
            .addText(text => text
                .setPlaceholder('sk-or-...')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '路径配置' });

        new Setting(containerEl)
            .setName('复盘目录')
            .setDesc('每日和每周复盘报告的存储目录')
            .addText(text => text
                .setPlaceholder('复盘')
                .setValue(this.plugin.settings.paths.reviewsDir)
                .onChange(async (value) => {
                    this.plugin.settings.paths.reviewsDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('调研目录')
            .setDesc('主题调研报告的存储目录')
            .addText(text => text
                .setPlaceholder('调研')
                .setValue(this.plugin.settings.paths.researchDir)
                .onChange(async (value) => {
                    this.plugin.settings.paths.researchDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('待整理目录')
            .setDesc('不确定归档位置的笔记存放目录')
            .addText(text => text
                .setPlaceholder('待整理')
                .setValue(this.plugin.settings.paths.unsortedDir)
                .onChange(async (value) => {
                    this.plugin.settings.paths.unsortedDir = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '复盘设置' });

        new Setting(containerEl)
            .setName('最大 diff 行数')
            .setDesc('复盘报告中显示的最大差异行数')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(String(this.plugin.settings.review.maxDiffLines))
                .onChange(async (value) => {
                    this.plugin.settings.review.maxDiffLines = parseInt(value) || 1000;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('日边界')
            .setDesc('每日复盘的时间边界')
            .addDropdown(dropdown => dropdown
                .addOption('natural', '自然日 (00:00-24:00)')
                .addOption('rolling', '滚动日 (自定义范围)')
                .setValue(this.plugin.settings.review.dayBoundary)
                .onChange(async (value) => {
                    this.plugin.settings.review.dayBoundary = value as 'natural' | 'rolling';
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '归档设置' });

        new Setting(containerEl)
            .setName('隐藏目录')
            .setDesc('自动过滤的目录（以 . 开头，如 .obsidian）')
            .addText(text => text
                .setPlaceholder('.obsidian, .git')
                .setValue(this.plugin.settings.archiving.hiddenDirectories.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.archiving.hiddenDirectories =
                        value.split(',').map(s => s.trim()).filter(s => s);
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '调研设置' });

        new Setting(containerEl)
            .setName('启用调研')
            .setDesc('是否启用自动调研生成')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.research.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.research.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用定时器')
            .setDesc('是否启用定时生成调研')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.research.scheduler.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.research.scheduler.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('调研时间')
            .setDesc('每日调研生成时间 (HH:MM 格式, 24小时制)')
            .addText(text => text
                .setPlaceholder('10:00')
                .setValue(this.plugin.settings.research.scheduler.time)
                .onChange(async (value) => {
                    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                    if (timePattern.test(value)) {
                        this.plugin.settings.research.scheduler.time = value;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
