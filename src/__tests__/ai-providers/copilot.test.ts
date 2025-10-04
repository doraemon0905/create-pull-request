import axios from 'axios';
import { CopilotProvider } from '../../services/ai-providers/copilot.js';
import { getConfig } from '../../utils/config.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/config.js');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('CopilotProvider', () => {
  let provider: CopilotProvider;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
      defaults: { headers: { common: {} } }
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    mockedGetConfig.mockReturnValue({
      github: {
        token: 'test-github-token',
        defaultBranch: 'main'
      },
      copilot: {
        apiToken: 'test-copilot-token'
      }
    } as any);

    provider = new CopilotProvider('test-api-key', 'copilot-chat');
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider['provider']).toBe('copilot');
      expect(provider['apiKey']).toBe('test-api-key');
      expect(provider['model']).toBe('copilot-chat');
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new CopilotProvider('test-key');
      expect(defaultProvider['model']).toBe('copilot-chat');
    });

    it('should create axios client with correct headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 3000000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2023-07-07',
          'User-Agent': 'create-pr-cli'
        }
      });
    });
  });

  describe('getDefaultModel', () => {
    it('should return default Copilot model', () => {
      expect(provider.getDefaultModel()).toBe('copilot-chat');
    });
  });

  describe('getHeaders', () => {
    it('should return Copilot-specific headers', () => {
      const headers = provider.getHeaders();
      expect(headers).toEqual({
        'Authorization': 'Bearer test-api-key',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2023-07-07',
        'User-Agent': 'create-pr-cli'
      });
    });
  });

  describe('getApiUrl', () => {
    it('should return Copilot API URL', () => {
      expect(provider.getApiUrl()).toBe('https://api.github.com/copilot_internal/v2/completions');
    });
  });

  describe('buildRequestBody', () => {
    it('should build correct request body', () => {
      const body = provider.buildRequestBody('test prompt');

      expect(body).toEqual({
        model: 'copilot-chat',
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
        .toThrow('No content received from Copilot API');
    });

    it('should throw error for missing choices', () => {
      const response = {};

      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Copilot API');
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
        .toThrow('No content received from Copilot API');
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
        provider: 'copilot'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.github.com/copilot_internal/v2/completions',
        {
          model: 'copilot-chat',
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
