import { BaseAIProvider } from './base.js';
import { API_URLS, DEFAULT_MODELS } from '../../constants/index.js';
export class GeminiProvider extends BaseAIProvider {
    constructor(apiKey, model) {
        super('gemini', apiKey, model);
    }
    getDefaultModel() {
        return DEFAULT_MODELS.GEMINI;
    }
    getHeaders() {
        return {
            'x-goog-api-key': this.apiKey
        };
    }
    getApiUrl() {
        return `${API_URLS.GEMINI_BASE_URL}/models/${this.model}:generateContent`;
    }
    buildRequestBody(prompt) {
        return {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: 4000,
                temperature: 0.7
            }
        };
    }
    extractContentFromResponse(response) {
        if (!response.candidates || !response.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('No content received from Gemini API');
        }
        return response.candidates[0].content.parts[0].text;
    }
}
//# sourceMappingURL=gemini.js.map