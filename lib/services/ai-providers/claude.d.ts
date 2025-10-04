import { BaseAIProvider } from './base.js';
export declare class ClaudeProvider extends BaseAIProvider {
    constructor(apiKey: string, model?: string);
    getDefaultModel(): string;
    getHeaders(): Record<string, string>;
    getApiUrl(): string;
    buildRequestBody(prompt: string): any;
    extractContentFromResponse(response: any): string;
}
//# sourceMappingURL=claude.d.ts.map