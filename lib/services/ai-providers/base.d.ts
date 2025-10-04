import { AxiosInstance } from 'axios';
export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'copilot';
export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
}
export interface AIResponse {
    content: string;
    provider: AIProvider;
}
export declare abstract class BaseAIProvider {
    protected client: AxiosInstance;
    protected provider: AIProvider;
    protected apiKey: string;
    protected model: string;
    constructor(provider: AIProvider, apiKey: string, model?: string);
    abstract getDefaultModel(): string;
    abstract getHeaders(): Record<string, string>;
    abstract getApiUrl(): string;
    abstract buildRequestBody(prompt: string): any;
    abstract extractContentFromResponse(response: any): string;
    generateContent(prompt: string): Promise<AIResponse>;
    protected handleApiError(error: any): never;
}
//# sourceMappingURL=base.d.ts.map