import inquirer from 'inquirer';
import { getConfig } from '../../utils/config.js';
import { ClaudeProvider } from './claude.js';
import { ChatGPTProvider } from './chatgpt.js';
import { GeminiProvider } from './gemini.js';
import { CopilotProvider } from './copilot.js';
export class AIProviderManager {
    constructor() {
        this.providers = new Map();
        this.selectedProvider = null;
        this.initializeProviders();
    }
    initializeProviders() {
        let githubConfig;
        let copilotConfig;
        try {
            githubConfig = getConfig('github');
        }
        catch {
            githubConfig = null;
        }
        try {
            copilotConfig = getConfig('copilot');
        }
        catch {
            copilotConfig = null;
        }
        // Try to get AI providers config
        let aiProvidersConfig;
        try {
            aiProvidersConfig = getConfig('aiProviders');
        }
        catch {
            // Fallback to environment variables if config doesn't exist
            aiProvidersConfig = null;
        }
        // Claude client (primary AI provider)
        const claudeKey = aiProvidersConfig?.claude?.apiKey ||
            process.env.ANTHROPIC_API_KEY ||
            process.env.CLAUDE_API_KEY;
        if (claudeKey) {
            this.providers.set('claude', new ClaudeProvider(claudeKey, aiProvidersConfig?.claude?.model));
        }
        // ChatGPT client
        const chatgptKey = aiProvidersConfig?.openai?.apiKey ||
            process.env.OPENAI_API_KEY ||
            process.env.CHATGPT_API_KEY;
        if (chatgptKey) {
            this.providers.set('chatgpt', new ChatGPTProvider(chatgptKey, aiProvidersConfig?.openai?.model));
        }
        // Gemini client
        const geminiKey = aiProvidersConfig?.gemini?.apiKey ||
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY;
        if (geminiKey) {
            this.providers.set('gemini', new GeminiProvider(geminiKey, aiProvidersConfig?.gemini?.model));
        }
        // GitHub Copilot client
        const copilotKey = copilotConfig?.apiToken || githubConfig?.token;
        if (copilotKey) {
            this.providers.set('copilot', new CopilotProvider(copilotKey));
        }
    }
    async selectProvider() {
        if (this.selectedProvider) {
            return this.selectedProvider;
        }
        const availableProviders = Array.from(this.providers.keys());
        if (availableProviders.length === 0) {
            throw new Error('No AI providers configured. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or configure GitHub Copilot.');
        }
        // If only one provider available, use it
        if (availableProviders.length === 1) {
            this.selectedProvider = availableProviders[0];
            return this.selectedProvider;
        }
        // Prompt user to select if multiple providers available
        const { selectedProvider } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedProvider',
                message: 'Multiple AI providers available. Please select one:',
                choices: availableProviders.map(provider => ({
                    name: this.getProviderDisplayName(provider),
                    value: provider
                }))
            }
        ]);
        this.selectedProvider = selectedProvider;
        return this.selectedProvider;
    }
    async generateContent(prompt, provider) {
        const selectedProvider = provider || await this.selectProvider();
        const aiProvider = this.providers.get(selectedProvider);
        if (!aiProvider) {
            throw new Error(`Provider ${selectedProvider} not available`);
        }
        try {
            const response = await aiProvider.generateContent(prompt);
            return response.content;
        }
        catch (error) {
            // If the selected provider fails and we have other providers, try fallback
            if (!provider && this.providers.size > 1) {
                const fallbackProviders = Array.from(this.providers.keys()).filter(p => p !== selectedProvider);
                for (const fallbackProvider of fallbackProviders) {
                    try {
                        const fallbackResponse = await this.providers.get(fallbackProvider).generateContent(prompt);
                        return fallbackResponse.content;
                    }
                    catch (fallbackError) {
                        // Continue to next fallback provider
                        continue;
                    }
                }
            }
            throw error;
        }
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    hasProvider(provider) {
        return this.providers.has(provider);
    }
    getProviderDisplayName(provider) {
        const names = {
            claude: 'Claude (Anthropic)',
            chatgpt: 'ChatGPT (OpenAI)',
            gemini: 'Gemini (Google)',
            copilot: 'GitHub Copilot'
        };
        return names[provider];
    }
}
//# sourceMappingURL=manager.js.map