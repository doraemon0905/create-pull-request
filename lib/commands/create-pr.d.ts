export interface CreatePROptions {
    jira?: string;
    base?: string;
    title?: string;
    dryRun?: boolean;
}
export declare function createPullRequest(options: CreatePROptions): Promise<void>;
//# sourceMappingURL=create-pr.d.ts.map