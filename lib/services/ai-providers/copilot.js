import { BaseAIProvider } from './base.js';
import { getConfig } from '../../utils/config.js';
export class CopilotProvider extends BaseAIProvider {
    constructor(apiKey, model) {
        super('copilot', apiKey, model);
    }
    getDefaultModel() {
        return 'copilot-chat';
    }
    getHeaders() {
        const githubConfig = getConfig('github');
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2023-07-07',
            'User-Agent': 'create-pr-cli'
        };
    }
    getApiUrl() {
        return 'https://api.github.com/copilot_internal/v2/completions';
    }
    buildRequestBody(prompt) {
        return {
            model: this.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.7
        };
    }
    extractContentFromResponse(response) {
        if (!response.choices || !response.choices[0]?.message?.content) {
            throw new Error('No content received from Copilot API');
        }
        return response.choices[0].message.content;
    }
}
//# sourceMappingURL=copilot.js.map