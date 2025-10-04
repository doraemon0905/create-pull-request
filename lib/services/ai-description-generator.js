import { AIProviderManager } from './ai-providers/manager.js';
import { PromptBuilder } from './ai-providers/prompt-builder.js';
import { ResponseParser } from './ai-providers/response-parser.js';
export class AIDescriptionGeneratorService {
    constructor() {
        this.providerManager = new AIProviderManager();
        this.promptBuilder = new PromptBuilder();
        this.responseParser = new ResponseParser();
    }
    async generatePRDescription(options) {
        // Select AI provider
        const selectedProvider = await this.providerManager.selectProvider();
        // First, generate a summary using selected AI provider
        const summary = await this.generateSummary(options);
        // Build the prompt using the new PromptBuilder
        const prompt = this.promptBuilder.buildPrompt(options, summary);
        // Generate content using the provider manager
        const content = await this.providerManager.generateContent(prompt, selectedProvider);
        // Parse the response using the new ResponseParser
        const result = this.responseParser.parseAIResponse({ content }, selectedProvider);
        return {
            ...result,
            summary
        };
    }
    async generateSummary(_options) {
        const selectedProvider = await this.providerManager.selectProvider();
        // Create a simplified prompt for summary generation
        const summaryPrompt = `Generate a concise summary of the changes in this pull request based on the Jira ticket and file changes. Focus on the key modifications and their purpose.`;
        // Generate the summary using the provider manager
        const summary = await this.providerManager.generateContent(summaryPrompt, selectedProvider);
        return summary;
    }
}
//# sourceMappingURL=ai-description-generator.js.map