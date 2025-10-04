import { AIProvider } from './base.js';
export declare class AIProviderManager {
    private providers;
    private selectedProvider;
    constructor();
    private initializeProviders;
    selectProvider(): Promise<AIProvider>;
    generateContent(prompt: string, provider?: AIProvider): Promise<string>;
    getAvailableProviders(): AIProvider[];
    hasProvider(provider: AIProvider): boolean;
    private getProviderDisplayName;
}
//# sourceMappingURL=manager.d.ts.map