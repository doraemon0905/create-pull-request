import { JiraTicket } from './atlassian-facade.js';
import { GitChanges } from './git.js';
import { PullRequestTemplate } from './github.js';
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
    private generateSummary;
    private buildPrompt;
    private callAIAPI;
    private getAIProvidersConfig;
    private getModelForProvider;
    private generateFileUrl;
    private generateLineUrl;
    private generateLineLinks;
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
    private getFileRelevanceDescription;
    private extractDiffSummary;
}
//# sourceMappingURL=ai-description-generator.d.ts.map