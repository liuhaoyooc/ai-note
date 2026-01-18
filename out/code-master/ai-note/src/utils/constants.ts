export const SECONDS_PER_DAY = 86400;

export const TIME_BUCKETS = {
    d15: 15,
    d45: 45,
    d180: 180,
    beyond: Infinity
} as const;

export const DEFAULT_EXCLUDE_DIRS = [
    'node_modules',
    '__pycache__',
    'venv',
    'env',
    'dist',
    'build',
    'out',
    'coverage',
    'target',
    'reviews',
    '.obsidian',
    '.ai-note'
];

export const DEFAULT_TEXT_EXTENSIONS = [
    '.md', '.txt',
    '.py', '.js', '.ts', '.jsx', '.tsx',
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs',
    '.java', '.kt', '.swift', '.rb', '.php',
    '.sh', '.bash', '.zsh',
    '.css', '.scss', '.less', '.html', '.xml'
];

export function getTimeBucket(modifiedTime: number, currentTime: number): 'd15' | 'd45' | 'd180' | 'beyond' {
    const daysDiff = (currentTime - modifiedTime) / SECONDS_PER_DAY;

    if (daysDiff <= TIME_BUCKETS.d15) {
        return 'd15';
    }
    if (daysDiff <= TIME_BUCKETS.d45) {
        return 'd45';
    }
    if (daysDiff <= TIME_BUCKETS.d180) {
        return 'd180';
    }
    return 'beyond';
}

export function shouldExcludePath(path: string, excludeDirs: string[], excludePatterns: string[]): boolean {
    const segments = path.split('/');

    for (const excludeDir of excludeDirs) {
        if (segments.includes(excludeDir)) {
            return true;
        }
    }

    for (const pattern of excludePatterns) {
        const regex = new RegExp(pattern);
        if (regex.test(path)) {
            return true;
        }
    }

    return false;
}

export function isTextFile(path: string, extensions: string[]): boolean {
    return extensions.some(ext => path.endsWith(ext));
}

export async function hashPathAndMtime(path: string, mtime: number): Promise<string> {
    const encoder = new TextEncoder();
    const data = `${path}|${mtime}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function formatDateTime(date: Date): string {
    return date.toISOString();
}
