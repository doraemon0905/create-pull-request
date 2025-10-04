import axios from 'axios';
import { ChatGPTProvider } from '../../services/ai-providers/chatgpt.js';
import { DEFAULT_MODELS } from '../../constants/index.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatGPTProvider', () => {
  let provider: ChatGPTProvider;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
      defaults: { headers: { common: {} } }
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    provider = new ChatGPTProvider('test-api-key', 'gpt-4');
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider['provider']).toBe('chatgpt');
      expect(provider['apiKey']).toBe('test-api-key');
      expect(provider['model']).toBe('gpt-4');
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new ChatGPTProvider('test-key');
      expect(defaultProvider['model']).toBe(DEFAULT_MODELS.OPENAI);
    });

    it('should create axios client with correct headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 3000000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        }
      });
    });
  });

  describe('getDefaultModel', () => {
    it('should return default ChatGPT model', () => {
      expect(provider.getDefaultModel()).toBe(DEFAULT_MODELS.OPENAI);
    });
  });

  describe('getHeaders', () => {
    it('should return ChatGPT-specific headers', () => {
      const headers = provider.getHeaders();
      expect(headers).toEqual({
        'Authorization': 'Bearer test-api-key'
      });
    });
  });

  describe('getApiUrl', () => {
    it('should return ChatGPT API URL', () => {
      expect(provider.getApiUrl()).toBe('https://api.openai.com/v1/chat/completions');
    });
  });

  describe('buildRequestBody', () => {
    it('should build correct request body', () => {
      const body = provider.buildRequestBody('test prompt');

      expect(body).toEqual({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'test prompt'
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      });
    });
  });

  describe('extractContentFromResponse', () => {
    it('should extract content from valid response', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Generated response'
            }
          }
        ]
      };

      const content = provider.extractContentFromResponse(response);
      expect(content).toBe('Generated response');
    });

    it('should throw error for invalid response', () => {
      const response = {
        choices: []
      };

      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from ChatGPT API');
    });

    it('should throw error for missing choices', () => {
      const response = {};

      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from ChatGPT API');
    });

    it('should throw error for missing message content', () => {
      const response = {
        choices: [
          {
            message: {}
          }
        ]
      };

      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from ChatGPT API');
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Generated content'
              }
            }
          ]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generateContent('test prompt');

      expect(result).toEqual({
        content: 'Generated content',
        provider: 'chatgpt'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'test prompt'
            }
          ],
          max_tokens: 4000,
          temperature: 0.7
        }
      );
    });
  });
});
