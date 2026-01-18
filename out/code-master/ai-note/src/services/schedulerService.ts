import { moment } from 'obsidian';

/**
 * 定时任务服务
 * 负责管理每日复盘、每周复盘的定时生成
 */
export class SchedulerService {
    private plugin: any;
    private dailyReviewInterval: number | null = null;
    private weeklyReviewInterval: number | null = null;
    private researchInterval: number | null = null;
    private statusBarItems: {
        archive?: import('obsidian').StatusBarBarItem;
        summary?: import('obsidian').StatusBarBarItem;
    };

    // 默认定时配置
    private dailyReviewTime = '21:00';  // 每天 21:00
    private weeklyReviewTime = '18:00';  // 每周五 18:00
    private researchTime = '09:00';  // 每天 09:00

    constructor(plugin: any) {
        this.plugin = plugin;
        this.statusBarItems = plugin.statusBarItems;
        console.log('[SchedulerService] Initialized');
    }

    /**
     * 启动所有定时任务
     */
    start(): void {
        console.log('[SchedulerService] Starting scheduled tasks...');

        // 启动每日复盘定时任务
        this.scheduleDailyReview();

        // 启动每周复盘定时任务
        this.scheduleWeeklyReview();

        // 启动调研生成定时任务
        this.scheduleResearch();

        console.log('[SchedulerService] All scheduled tasks started');
    }

    /**
     * 停止所有定时任务
     */
    stop(): void {
        console.log('[SchedulerService] Stopping scheduled tasks...');

        if (this.dailyReviewInterval) {
            window.clearInterval(this.dailyReviewInterval);
            this.dailyReviewInterval = null;
        }

        if (this.weeklyReviewInterval) {
            window.clearInterval(this.weeklyReviewInterval);
            this.weeklyReviewInterval = null;
        }

        if (this.researchInterval) {
            window.clearInterval(this.researchInterval);
            this.researchInterval = null;
        }

        console.log('[SchedulerService] All scheduled tasks stopped');
    }

    /**
     * 更新定时配置
     */
    updateConfig(config: {
        dailyReviewTime?: string;
        weeklyReviewTime?: string;
        researchTime?: string;
    }): void {
        if (config.dailyReviewTime) {
            this.dailyReviewTime = config.dailyReviewTime;
        }
        if (config.weeklyReviewTime) {
            this.weeklyReviewTime = config.weeklyReviewTime;
        }
        if (config.researchTime) {
            this.researchTime = config.researchTime;
        }

        // 重启定时任务
        this.stop();
        this.start();
    }

    /**
     * 定时每日复盘
     */
    private scheduleDailyReview(): void {
        const checkAndRun = () => {
            const now = moment();
            const scheduledTime = moment(this.dailyReviewTime, 'HH:mm');

            // 如果当前时间接近定时时间 (1分钟误差范围内)
            if (now.diff(scheduledTime, 'minutes') >= 0 &&
                now.diff(scheduledTime, 'minutes') < 1) {
                console.log('[SchedulerService] Triggering daily review...');
                this.plugin.generateDailyReview();
            }
        };

        // 每分钟检查一次
        this.dailyReviewInterval = window.setInterval(checkAndRun, 60 * 1000);
        console.log(`[SchedulerService] Daily review scheduled at ${this.dailyReviewTime}`);
    }

    /**
     * 定时每周复盘
     */
    private scheduleWeeklyReview(): void {
        const checkAndRun = () => {
            const now = moment();
            const scheduledTime = moment(this.weeklyReviewTime, 'HH:mm');

            // 检查是否是周五 (5) 且时间匹配
            if (now.day() === 5 &&
                now.diff(scheduledTime, 'minutes') >= 0 &&
                now.diff(scheduledTime, 'minutes') < 1) {
                console.log('[SchedulerService] Triggering weekly review...');
                this.plugin.generateWeeklyReview();
            }
        };

        // 每分钟检查一次
        this.weeklyReviewInterval = window.setInterval(checkAndRun, 60 * 1000);
        console.log(`[SchedulerService] Weekly review scheduled at ${this.weeklyReviewTime} on Fridays`);
    }

    /**
     * 定时调研生成
     */
    private scheduleResearch(): void {
        const checkAndRun = () => {
            const now = moment();
            const scheduledTime = moment(this.researchTime, 'HH:mm');

            // 如果当前时间接近定时时间
            if (now.diff(scheduledTime, 'minutes') >= 0 &&
                now.diff(scheduledTime, 'minutes') < 1) {
                console.log('[SchedulerService] Triggering research generation...');

                // 检查是否启用调研
                if (this.plugin.settings?.research?.enabled !== false) {
                    this.plugin.generateResearch();
                }
            }
        };

        // 每分钟检查一次
        this.researchInterval = window.setInterval(checkAndRun, 60 * 1000);
        console.log(`[SchedulerService] Research generation scheduled at ${this.researchTime}`);
    }

    /**
     * 手动触发每日复盘 (用于测试)
     */
    async triggerDailyReview(): Promise<void> {
        console.log('[SchedulerService] Manually triggering daily review');
        await this.plugin.generateDailyReview();
    }

    /**
     * 手动触发每周复盘 (用于测试)
     */
    async triggerWeeklyReview(): Promise<void> {
        console.log('[SchedulerService] Manually triggering weekly review');
        await this.plugin.generateWeeklyReview();
    }

    /**
     * 手动触发调研生成 (用于测试)
     */
    async triggerResearch(): Promise<void> {
        console.log('[SchedulerService] Manually triggering research generation');
        await this.plugin.generateResearch();
    }

    /**
     * 启动时检查并补执行复盘
     */
    async checkAndRunMissedReviews(): Promise<void> {
        this.statusBarItems.summary?.setText('检查复盘状态...');
        console.log('[SchedulerService] Checking for missed reviews...');
        await this.delay(10000);  // 延迟10秒

        const now = moment();
        const dailyTime = moment(this.dailyReviewTime, 'HH:mm');
        const today = moment().startOf('day');
        const yesterday = moment().subtract(1, 'day').startOf('day');

        // 检查今天的复盘是否需要补执行
        const todayReviewPath = this.plugin.pathManager.getDailyReviewPath(
            today.format('YYYY-MM-DD')
        );
        const todayReviewExists = await this.plugin.storage.exists(todayReviewPath);

        if (now.isAfter(dailyTime) && !todayReviewExists) {
            // 今天时间已过且复盘不存在，补执行今天的复盘
            console.log('[SchedulerService] Running missed daily review for today');
            await this.plugin.generateDailyReview();
            return;
        }

        if (!todayReviewExists) {
            // 今天时间未到且复盘不存在，检查昨天的复盘
            const yesterdayReviewPath = this.plugin.pathManager.getDailyReviewPath(
                yesterday.format('YYYY-MM-DD')
            );
            const yesterdayReviewExists = await this.plugin.storage.exists(yesterdayReviewPath);

            if (!yesterdayReviewExists) {
                console.log('[SchedulerService] Running missed daily review for yesterday');
                await this.plugin.generateDailyReview();
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取下次执行时间
     */
    getNextRunTimes(): {
        dailyReview: string | null;
        weeklyReview: string | null;
        research: string | null;
    } {
        const now = moment();

        const dailyTime = moment(this.dailyReviewTime, 'HH:mm');
        if (now.isAfter(dailyTime)) {
            dailyTime.add(1, 'day');
        }

        const weeklyTime = moment(this.weeklyReviewTime, 'HH:mm');
        while (weeklyTime.day() !== 5 || weeklyTime.isBefore(now)) {
            weeklyTime.add(1, 'day');
        }

        const researchTime = moment(this.researchTime, 'HH:mm');
        if (now.isAfter(researchTime)) {
            researchTime.add(1, 'day');
        }

        return {
            dailyReview: dailyTime.format('YYYY-MM-DD HH:mm'),
            weeklyReview: weeklyTime.format('YYYY-MM-DD HH:mm'),
            research: researchTime.format('YYYY-MM-DD HH:mm')
        };
    }
}
