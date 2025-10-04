import axios from 'axios';
import { GeminiProvider } from '../../services/ai-providers/gemini.js';
import { DEFAULT_MODELS } from '../../constants/index.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      post: jest.fn(),
      defaults: { headers: { common: {} } }
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    provider = new GeminiProvider('test-api-key', 'gemini-pro');
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider['provider']).toBe('gemini');
      expect(provider['apiKey']).toBe('test-api-key');
      expect(provider['model']).toBe('gemini-pro');
    });

    it('should use default model when not provided', () => {
      const defaultProvider = new GeminiProvider('test-key');
      expect(defaultProvider['model']).toBe(DEFAULT_MODELS.GEMINI);
    });

    it('should create axios client with correct headers', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 3000000,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': 'test-api-key'
        }
      });
    });
  });

  describe('getDefaultModel', () => {
    it('should return default Gemini model', () => {
      expect(provider.getDefaultModel()).toBe(DEFAULT_MODELS.GEMINI);
    });
  });

  describe('getHeaders', () => {
    it('should return Gemini-specific headers', () => {
      const headers = provider.getHeaders();
      expect(headers).toEqual({
        'x-goog-api-key': 'test-api-key'
      });
    });
  });

  describe('getApiUrl', () => {
    it('should return Gemini API URL with model', () => {
      expect(provider.getApiUrl()).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent');
    });
  });

  describe('buildRequestBody', () => {
    it('should build correct request body', () => {
      const body = provider.buildRequestBody('test prompt');
      
      expect(body).toEqual({
        contents: [
          {
            parts: [
              {
                text: 'test prompt'
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.7
        }
      });
    });
  });

  describe('extractContentFromResponse', () => {
    it('should extract content from valid response', () => {
      const response = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Generated response' }
              ]
            }
          }
        ]
      };
      
      const content = provider.extractContentFromResponse(response);
      expect(content).toBe('Generated response');
    });

    it('should throw error for invalid response', () => {
      const response = {
        candidates: []
      };
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Gemini API');
    });

    it('should throw error for missing candidates', () => {
      const response = {};
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Gemini API');
    });

    it('should throw error for missing content', () => {
      const response = {
        candidates: [
          {}
        ]
      };
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Gemini API');
    });

    it('should throw error for missing parts', () => {
      const response = {
        candidates: [
          {
            content: {}
          }
        ]
      };
      
      expect(() => provider.extractContentFromResponse(response))
        .toThrow('No content received from Gemini API');
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Generated content' }
                ]
              }
            }
          ]
        }
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generateContent('test prompt');

      expect(result).toEqual({
        content: 'Generated content',
        provider: 'gemini'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          contents: [
            {
              parts: [
                {
                  text: 'test prompt'
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4000,
            temperature: 0.7
          }
        }
      );
    });
  });
});

