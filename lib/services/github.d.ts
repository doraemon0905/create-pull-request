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
    private client;
    private git;
    constructor();
    getCurrentRepo(): Promise<GitHubRepo>;
    getPullRequestTemplates(repo: GitHubRepo): Promise<PullRequestTemplate[]>;
    createPullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<any>;
    getCurrentBranch(): Promise<string>;
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=github.d.ts.map