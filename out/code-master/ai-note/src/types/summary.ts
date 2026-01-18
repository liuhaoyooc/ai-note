export type TimeBucket = 'd15' | 'd45' | 'd180' | 'beyond';

export interface FileSummary {
    file_id: string;
    file_path: string;
    summary: string;
    keywords: string[];
    time_bucket: TimeBucket;
    generated_at: string;
    file_mtime: number;
}

export interface SummaryStatistics {
    total_files: number;
    new_summaries: number;
    updated_summaries: number;
    skipped: number;
    failed: number;
    corrupted_cleaned: number;
    orphaned_cleaned: number;
}

export interface FileSummaryInput {
    path: string;
    content: string;
}

export interface FileSummaryOutput {
    summary: string;
    keywords: string[];
}
