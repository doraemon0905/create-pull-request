import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../../utils/config.js';
import { API_URLS, LIMITS, HEADERS, DEFAULT_MODELS } from '../../constants/index.js';

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

export abstract class BaseAIProvider {
  protected client: AxiosInstance;
  protected provider: AIProvider;
  protected apiKey: string;
  protected model: string;

  constructor(provider: AIProvider, apiKey: string, model?: string) {
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

  abstract getDefaultModel(): string;
  abstract getHeaders(): Record<string, string>;
  abstract getApiUrl(): string;
  abstract buildRequestBody(prompt: string): any;
  abstract extractContentFromResponse(response: any): string;

  async generateContent(prompt: string): Promise<AIResponse> {
    try {
      const requestBody = this.buildRequestBody(prompt);

      const response = await this.client.post(this.getApiUrl(), requestBody);

      const content = this.extractContentFromResponse(response.data);

      return {
        content,
        provider: this.provider
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  protected handleApiError(error: any): never {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;

      if (status === 401) {
        throw new Error(`Authentication failed for ${this.provider}. Please check your API key.`);
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded for ${this.provider}. Please try again later.`);
      } else if (status === 500) {
        throw new Error(`${this.provider} API server error. Please try again later.`);
      } else {
        throw new Error(`${this.provider} API error: ${message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`${this.provider} API timeout. Please try again.`);
    } else {
      throw new Error(`${this.provider} API error: ${error.message}`);
    }
  }
}
