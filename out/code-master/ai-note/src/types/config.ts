export interface AiNoteSettings {
    apiKey: string;
    paths: {
        reviewsDir: string;
        researchDir: string;
        unsortedDir: string;
    };
    review: {
        maxDiffLines: number;
        dayBoundary: 'natural' | 'rolling';
    };
    research: {
        enabled: boolean;
        scheduler: {
            enabled: boolean;
            time: string;
        };
    };
    archiving: {
        hiddenDirectories: string[];
    };
}

export const DEFAULT_SETTINGS: AiNoteSettings = {
    apiKey: '',
    paths: {
        reviewsDir: '复盘',
        researchDir: '调研',
        unsortedDir: '待整理'
    },
    review: {
        maxDiffLines: 1000,
        dayBoundary: 'natural'
    },
    research: {
        enabled: true,
        scheduler: {
            enabled: true,
            time: '10:00'
        }
    },
    archiving: {
        hiddenDirectories: ['.obsidian', '.git']
    }
};
