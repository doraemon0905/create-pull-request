export interface GitHubRepo {
    owner: string;
    repo: string;
}
export interface PullRequest {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
}
export interface PullRequestTemplate {
    name: string;
    content: string;
}
export declare class GitHubService {
    private octokit;
    private git;
    constructor();
    getCurrentRepo(): Promise<GitHubRepo>;
    getPullRequestTemplates(repo: GitHubRepo): Promise<PullRequestTemplate[]>;
    findExistingPullRequest(repo: GitHubRepo, branch: string): Promise<any | null>;
    updatePullRequest(repo: GitHubRepo, pullNumber: number, pullRequest: Partial<PullRequest>): Promise<any>;
    createOrUpdatePullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<{
        data: any;
        isUpdate: boolean;
    }>;
    createPullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<any>;
    private validatePullRequestData;
    getCurrentBranch(): Promise<string>;
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=github.d.ts.map