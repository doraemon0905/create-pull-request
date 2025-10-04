import axios from 'axios';
import { ClaudeProvider } from '../../services/ai-providers/claude.js';
import { DEFAULT_MODELS } from '../../constants/index.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      post: jest.fn(),
      defaults: { headers: { common: {} } }
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    provider = new ClaudeProvider('test-api-key', 'claude-3-sonnet');
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider['provider']).toBe('claude');
      expect(provider['apiKey']).toBe('test-api-key');
      expect(provider['model']).toBe('claude-3-sonnet');
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new ClaudeProvider('test-key');
      expect(defaultProvider['model']).toBe(DEFAULT_MODELS.CLAUDE);
    });

    it('should create axios client with correct headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 3000000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01'
        }
      });
    });
  });

  describe('getDefaultModel', () => {
    it('should return default Claude model', () => {
      expect(provider.getDefaultModel()).toBe(DEFAULT_MODELS.CLAUDE);
    });
  });

  describe('getHeaders', () => {
    it('should return Claude-specific headers', () => {
      const headers = provider.getHeaders();
      expect(headers).toEqual({
        'x-api-key': 'test-api-key',
        'anthropic-version': '2023-06-01'
      });
    });
  });

  describe('getApiUrl', () => {
    it('should return Claude API URL', () => {
      expect(provider.getApiUrl()).toBe('https://api.anthropic.com/v1/messages');
    });
  });

  describe('buildRequestBody', () => {
    it('should build correct request body', () => {
      const body = provider.buildRequestBody('test prompt');
      
      expect(body).toEqual({
        model: 'claude-3-sonnet',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: 'test prompt'
          }
        ]
      });
    });
  });

  describe('extractContentFromResponse', () => {
    it('should extract content from valid response', () => {
      const response = {
        content: [
          { text: 'Generated response' }
        ]
      };
      
      const content = provider.extractContentFromResponse(response);
      expect(content).toBe('Generated response');
    });

    it('should throw error for invalid response', () => {
      const response = {
        content: []
      };
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Claude API');
    });

    it('should throw error for missing content', () => {
      const response = {};
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Claude API');
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        data: {
          content: [
            { text: 'Generated content' }
          ]
        }
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generateContent('test prompt');

      expect(result).toEqual({
        content: 'Generated content',
        provider: 'claude'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: 'test prompt'
            }
          ]
        }
      );
    });
  });
});

