export interface SnapshotEntry {
    hash: string;
    snapshotFile: string;
    modifiedTime: number;
}

export interface SnapshotIndex {
    lastSnapshotTime: string;
    files: Record<string, SnapshotEntry>;
}

export enum FileChangeType {
    ADDED = 'added',
    MODIFIED = 'modified',
    DELETED = 'deleted'
}

export interface FileChange {
    path: string;
    type: FileChangeType;
    oldHash?: string;
    newHash?: string;
    diff?: string;
}

export interface ChangeSummary {
    added: FileChange[];
    modified: FileChange[];
    deleted: FileChange[];
}

export interface ReviewConfig {
    enabled: boolean;
    dailyTime: string;
    weeklyDay: string;
    weeklyTime: string;
    dayBoundary: 'natural' | 'rolling';
    maxDiffLines: number;
    maxFilesForDetail: number;
}

export interface ReviewStats {
    totalFiles: number;
    addedFiles: number;
    modifiedFiles: number;
    deletedFiles: number;
    snapshotSize: number;
}

export interface ReviewInitializationStats {
    total_files: number;
    initialized_snapshots: number;
    failed_files: string[];
}
