import { BaseAIProvider } from './base.js';
import { API_URLS, DEFAULT_MODELS } from '../../constants/index.js';
export class ChatGPTProvider extends BaseAIProvider {
    constructor(apiKey, model) {
        super('chatgpt', apiKey, model);
    }
    getDefaultModel() {
        return DEFAULT_MODELS.OPENAI;
    }
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`
        };
    }
    getApiUrl() {
        return `${API_URLS.OPENAI_BASE_URL}/chat/completions`;
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
            throw new Error('No content received from ChatGPT API');
        }
        return response.choices[0].message.content;
    }
}
//# sourceMappingURL=chatgpt.js.map