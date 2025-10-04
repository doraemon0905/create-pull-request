import { JiraTicket } from '../atlassian-facade.js';
import { GitChanges } from '../git.js';
import { PullRequestTemplate } from '../github.js';
export interface PromptBuilderOptions {
    jiraTicket: JiraTicket;
    gitChanges: GitChanges;
    template?: PullRequestTemplate;
    diffContent?: string;
    prTitle?: string;
    repoInfo?: {
        owner: string;
        repo: string;
        currentBranch: string;
    };
}
export declare class PromptBuilder {
    buildPrompt(options: PromptBuilderOptions, summary?: string): string;
    private generateFileUrl;
    private generateLineUrl;
    private generateLineLinks;
    private getFileRelevanceDescription;
    private extractDiffSummary;
}
//# sourceMappingURL=prompt-builder.d.ts.map