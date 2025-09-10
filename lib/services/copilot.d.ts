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
export type AIProvider = 'chatgpt' | 'gemini' | 'copilot';
export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
}
export declare class CopilotService {
    private clients;
    private selectedProvider;
    constructor();
    private initializeClients;
    generatePRDescription(options: GenerateDescriptionOptions): Promise<GeneratedPRContent>;
    private selectAIProvider;
    private tryFallbackProviders;
    private generateSummary;
    private buildPrompt;
    private callAIAPI;
    private callChatGPTAPI;
    private callGeminiAPI;
    private callCopilotAPI;
    private parseAIResponse;
    private extractContentFromResponse;
    private parseResponseContent;
    private extractTitle;
    private generateFallbackDescription;
    private getFileRelevanceDescription;
    private generateFallbackSummary;
    private generateShortTitle;
    private getActionFromIssueType;
    private extractSubjectFromSummary;
}
//# sourceMappingURL=copilot.d.ts.map