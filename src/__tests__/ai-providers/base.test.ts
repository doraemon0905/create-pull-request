import axios, { AxiosInstance } from 'axios';
import { BaseAIProvider, AIProvider } from '../../services/ai-providers/base.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a concrete implementation for testing
class TestAIProvider extends BaseAIProvider {
  constructor(apiKey: string, model?: string) {
    super('claude' as AIProvider, apiKey, model);
  }

  getDefaultModel(): string {
    return 'test-model';
  }

  getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey
    };
  }

  getApiUrl(): string {
    return 'https://api.test.com/v1/test';
  }

  buildRequestBody(prompt: string): any {
    return {
      model: this.model,
      prompt: prompt
    };
  }

  extractContentFromResponse(response: any): string {
    return response.content || 'test response';
  }
}

describe('BaseAIProvider', () => {
  let provider: TestAIProvider;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      defaults: {
        headers: {
          common: {},
          get: {},
          post: {},
          put: {},
          patch: {},
          delete: {}
        }
      },
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() }
      },
      request: jest.fn(),
      getUri: jest.fn()
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    provider = new TestAIProvider('test-api-key', 'custom-model');
  });

  describe('constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(provider['provider']).toBe('claude');
      expect(provider['apiKey']).toBe('test-api-key');
      expect(provider['model']).toBe('custom-model');
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new TestAIProvider('test-key');
      expect(defaultProvider['model']).toBe('test-model');
    });

    it('should create axios client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 3000000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key'
        }
      });
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        data: { content: 'Generated content' }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generateContent('test prompt');

      expect(result).toEqual({
        content: 'Generated content',
        provider: 'claude'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.test.com/v1/test',
        {
          model: 'custom-model',
          prompt: 'test prompt'
        }
      );
    });

    it('should handle API errors with 401 status', async () => {
      const error = new Error('Request failed with status code 401');
      (error as any).response = {
        status: 401,
        data: { error: { message: 'Unauthorized' } }
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('Authentication failed for claude. Please check your API key.');
    });

    it('should handle API errors with 429 status', async () => {
      const error = new Error('Request failed with status code 429');
      (error as any).response = {
        status: 429,
        data: { error: { message: 'Rate limit exceeded' } }
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('Rate limit exceeded for claude. Please try again later.');
    });

    it('should handle API errors with 500 status', async () => {
      const error = new Error('Request failed with status code 500');
      (error as any).response = {
        status: 500,
        data: { error: { message: 'Server error' } }
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('claude API server error. Please try again later.');
    });

    it('should handle generic API errors', async () => {
      const error = new Error('Request failed with status code 400');
      (error as any).response = {
        status: 400,
        data: { error: { message: 'Bad request' } }
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('claude API error: Bad request');
    });

    it('should handle timeout errors', async () => {
      const error = new Error('timeout of 3000000ms exceeded');
      (error as any).code = 'ECONNABORTED';

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('claude API timeout. Please try again.');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('claude API error: Network error');
    });

    it('should handle API errors without error message in response data', async () => {
      const error = new Error('Request failed with status code 400');
      (error as any).response = {
        status: 400,
        data: {}
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.generateContent('test prompt'))
        .rejects.toThrow('claude API error: Request failed with status code 400');
    });
  });

  describe('abstract methods', () => {
    it('should implement getDefaultModel', () => {
      expect(provider.getDefaultModel()).toBe('test-model');
    });

    it('should implement getHeaders', () => {
      expect(provider.getHeaders()).toEqual({
        'x-api-key': 'test-api-key'
      });
    });

    it('should implement getApiUrl', () => {
      expect(provider.getApiUrl()).toBe('https://api.test.com/v1/test');
    });

    it('should implement buildRequestBody', () => {
      const body = provider.buildRequestBody('test prompt');
      expect(body).toEqual({
        model: 'custom-model',
        prompt: 'test prompt'
      });
    });

    it('should implement extractContentFromResponse', () => {
      const content = provider.extractContentFromResponse({ content: 'test' });
      expect(content).toBe('test');
    });
  });
});
