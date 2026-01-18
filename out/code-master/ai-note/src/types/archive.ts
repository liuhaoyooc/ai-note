export interface UncertainFile {
    path: string;
    reason: string;
    suggestions: string[];
}

export interface ArchiveDecision {
    path: string;
    targetDir: string;
}

export interface ClassificationDecision {
    path: string;
    targetDir: string;
    confidence: number;
    reason: string;
    uncertain: boolean;
    suggestions: string[];
}

export interface FolderInfo {
    path: string;
    description: string;
}

export interface ClassificationStatistics {
    total_files: number;
    confident_archived: number;
    uncertain: number;
    available_folders_count: number;
    recent_files_moved: number;
}

export interface ArchiveStatistics {
    success: number;
    failed: number;
    failed_files: Array<{ path: string; error: string }>;
}

export interface ArchiveResult {
    statistics: ArchiveStatistics;
}

export interface RecentFileMoveResult {
    moved: Array<{ path: string; newPath: string }>;
    skipped: Array<{ path: string; reason: string }>;
    failed: Array<{ path: string; error: string }>;
}

export interface FolderSummary {
    path: string;
    theme: string;
    keywords: string[];
    last_updated: string;
    sample_files: string[];
    file_count: number;
}

export interface NewFolderSuggestion {
    folder_name: string;
    theme: string;
    keywords: string[];
    confidence: number;
    reason: string;
}

export interface EnhancedClassificationDecision extends ClassificationDecision {
    new_folder?: NewFolderSuggestion;
}

export interface ArchiveInitializationStats {
    total_folders: number;
    initialized_summaries: number;
    failed_folders: string[];
}
