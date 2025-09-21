import { JiraTicket } from './jira';
import { GitChanges } from './git';
import { PullRequestTemplate } from './github';
export interface GenerateDescriptionOptions {
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
export interface GeneratedPRContent {
    title: string;
    body: string;
    summary?: string;
}
export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'copilot';
export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
}
export declare class AIDescriptionGeneratorService {
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
    private callClaudeAPI;
    private callChatGPTAPI;
    private callGeminiAPI;
    private callCopilotAPI;
    private parseAIResponse;
    private isValidJSON;
    private cleanJSONResponse;
    private extractContentFromResponse;
    private parseResponseContent;
    private extractTitle;
    private generateFallbackDescription;
    private getFileRelevanceDescription;
    private generateFallbackSummary;
    private generateEnhancedFallbackSummary;
    private generateShortTitle;
    private getActionFromIssueType;
    private extractSubjectFromSummary;
    private extractDiffSummary;
}
//# sourceMappingURL=ai-description-generator.d.ts.map