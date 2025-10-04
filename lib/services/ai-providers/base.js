import axios from 'axios';
import { LIMITS, HEADERS } from '../../constants/index.js';
export class BaseAIProvider {
    constructor(provider, apiKey, model) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model || this.getDefaultModel();
        this.client = axios.create({
            timeout: LIMITS.API_TIMEOUT_MS,
            headers: {
                'Content-Type': HEADERS.JSON_CONTENT_TYPE,
                ...this.getHeaders()
            }
        });
    }
    async generateContent(prompt) {
        try {
            const requestBody = this.buildRequestBody(prompt);
            const response = await this.client.post(this.getApiUrl(), requestBody);
            const content = this.extractContentFromResponse(response.data);
            return {
                content,
                provider: this.provider
            };
        }
        catch (error) {
            this.handleApiError(error);
        }
    }
    handleApiError(error) {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.error?.message || error.message;
            if (status === 401) {
                throw new Error(`Authentication failed for ${this.provider}. Please check your API key.`);
            }
            else if (status === 429) {
                throw new Error(`Rate limit exceeded for ${this.provider}. Please try again later.`);
            }
            else if (status === 500) {
                throw new Error(`${this.provider} API server error. Please try again later.`);
            }
            else {
                throw new Error(`${this.provider} API error: ${message}`);
            }
        }
        else if (error.code === 'ECONNABORTED') {
            throw new Error(`${this.provider} API timeout. Please try again.`);
        }
        else {
            throw new Error(`${this.provider} API error: ${error.message}`);
        }
    }
}
//# sourceMappingURL=base.js.map