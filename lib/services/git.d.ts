export interface FileChange {
    file: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    insertions: number;
    deletions: number;
    changes: number;
    diffContent?: string;
    lineNumbers?: {
        added: number[];
        removed: number[];
    };
}
export interface GitChanges {
    files: FileChange[];
    totalInsertions: number;
    totalDeletions: number;
    totalFiles: number;
    commits: string[];
}
export declare class GitService {
    private git;
    constructor();
    getChanges(baseBranch?: string, includeDetailedDiff?: boolean): Promise<GitChanges>;
    getDiffContent(baseBranch?: string, maxLines?: number): Promise<string>;
    getCurrentBranch(): Promise<string>;
    validateRepository(): Promise<void>;
    hasUncommittedChanges(): Promise<boolean>;
    branchExists(branchName: string): Promise<boolean>;
    private mapGitStatus;
    private extractLineNumbers;
    pushCurrentBranch(): Promise<void>;
}
//# sourceMappingURL=git.d.ts.map