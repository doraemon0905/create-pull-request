import { JiraTicket } from './jira';
import { GitChanges } from './git';
import { PullRequestTemplate } from './github';
export interface GenerateDescriptionOptions {
    jiraTicket: JiraTicket;
    gitChanges: GitChanges;
    template?: PullRequestTemplate;
    diffContent?: string;
    prTitle?: string;
}
export interface GeneratedPRContent {
    title: string;
    body: string;
    summary?: string;
}
export declare class CopilotService {
    private client;
    constructor();
    generatePRDescription(options: GenerateDescriptionOptions): Promise<GeneratedPRContent>;
    private generateSummary;
    private buildPrompt;
    private callCopilotAPI;
    private parseCopilotResponse;
    private extractTitle;
    private generateFallbackDescription;
    private getFileRelevanceDescription;
    private generateFallbackSummary;
    private generateShortTitle;
    private getActionFromIssueType;
    private extractSubjectFromSummary;
}
//# sourceMappingURL=copilot.d.ts.map