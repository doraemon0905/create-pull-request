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
}
export declare class CopilotService {
    private client;
    constructor();
    generatePRDescription(options: GenerateDescriptionOptions): Promise<GeneratedPRContent>;
    private buildPrompt;
    private callCopilotAPI;
    private parseCopilotResponse;
    private extractTitle;
    private generateFallbackDescription;
    private getFileRelevanceDescription;
}
//# sourceMappingURL=copilot.d.ts.map