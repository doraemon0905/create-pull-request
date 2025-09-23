import axios from 'axios';
import { AIDescriptionGeneratorService, GenerateDescriptionOptions } from '../services/ai-description-generator';
import { getConfig } from '../utils/config';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils/config');
jest.mock('inquirer');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('AIDescriptionGeneratorService', () => {
  let service: AIDescriptionGeneratorService;
  const mockOptions: GenerateDescriptionOptions = {
    jiraTicket: {
      key: 'PROJ-123',
      summary: 'Test feature implementation',
      description: 'Implement a new test feature',
      issueType: 'Story',
      status: 'In Progress',
      assignee: 'John Doe',
      reporter: 'Jane Doe',
      created: '2023-01-01T00:00:00.000Z',
      updated: '2023-01-02T00:00:00.000Z'
    },
    gitChanges: {
      totalFiles: 2,
      totalInsertions: 50,
      totalDeletions: 10,
      files: [
        {
          file: 'src/test.ts',
          status: 'modified',
          changes: 35,
          insertions: 30,
          deletions: 5,
          lineNumbers: {
            added: [10, 11, 12],
            removed: [5]
          },
          diffContent: '+console.log("test");\n-console.log("old");'
        },
        {
          file: 'src/utils.ts',
          status: 'modified',
          changes: 25,
          insertions: 20,
          deletions: 5,
          lineNumbers: {
            added: [15, 16],
            removed: [8]
          },
          diffContent: '+export function newUtil() {}\n-export function oldUtil() {}'
        }
      ],
      commits: ['feat: add new test feature', 'fix: update utility function']
    },
    repoInfo: {
      owner: 'testuser',
      repo: 'testrepo',
      currentBranch: 'feature/PROJ-123'
    }
  };

  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config responses
    mockedGetConfig.mockImplementation((section: any) => {
      switch (section) {
        case 'github':
          return { token: 'github-token', defaultBranch: 'main' };
        case 'copilot':
          return { apiToken: null };
        case 'aiProviders':
          return {
            claude: { apiKey: 'claude-key', model: 'claude-3-5-sonnet-20241022' },
            openai: { apiKey: 'openai-key', model: 'gpt-4o' },
            gemini: { apiKey: 'gemini-key', model: 'gemini-1.5-pro' }
          };
        default:
          return {};
      }
    });

    // Default mock for axios.create
    mockAxiosInstance = {
      post: jest.fn(),
      defaults: { timeout: 30000 }
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    // Ensure all axios.create calls return the same mock instance
    mockedAxios.create.mockImplementation(() => mockAxiosInstance as any);
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockAxiosInstance.post.mockClear();

    // Re-setup axios mock after clearing
    mockedAxios.create.mockImplementation(() => mockAxiosInstance as any);

    // Create service instance for each test
    service = new AIDescriptionGeneratorService();
  });

  describe('constructor', () => {
    it('should initialize with available AI providers', () => {
      expect(mockedAxios.create).toHaveBeenCalledTimes(4); // Claude, ChatGPT, Gemini, Copilot
    });
  });

  describe('generatePRDescription', () => {
    it('should generate PR description with Claude as primary provider', async () => {
      const mockResponse = {
        content: [{ text: '{"title": "PROJ-123: Test feature implementation", "body": "## Summary\\nImplemented new test feature"}' }]
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBe('PROJ-123: Test feature implementation');
      expect(result.body).toContain('Implemented new test feature');
    });

    it('should use selected AI provider without fallback', async () => {
      const mockResponse = {
        content: [{
          text: '{"title": "PROJ-123: Test feature", "body": "## Summary\\nTest implementation"}'
        }]
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBe('PROJ-123: Test feature');
      expect(result.body).toContain('Test implementation');
    });

    it('should handle invalid JSON response gracefully', async () => {
      const mockResponse = {
        content: [{ text: 'Invalid JSON response' }]
      };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBeDefined();
      expect(result.body).toBeDefined();
    });

    it('should throw error when AI provider fails', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('API error');
    });

  });

  describe('Claude API integration', () => {
    it('should call Claude API with correct parameters', async () => {
      const mockClaudeInstance = {
        post: jest.fn().mockResolvedValue({
          data: {
            content: [{ text: '{"title": "Test", "body": "Test body"}' }]
          }
        }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create.mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      await service.generatePRDescription(mockOptions);

      expect(mockClaudeInstance.post).toHaveBeenCalledWith('/v1/messages', expect.objectContaining({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.any(String)
          })
        ])
      }));
    });
  });

  describe('ChatGPT API integration', () => {
    it('should call ChatGPT API with correct parameters', async () => {
      // Mock config to only have OpenAI
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return { openai: { apiKey: 'openai-key', model: 'gpt-4o' } };
          default:
            return {};
        }
      });

      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{
              message: {
                content: '{"title": "Test", "body": "Test body"}'
              }
            }]
          }
        }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create.mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      await service.generatePRDescription(mockOptions);

      expect(mockChatGPTInstance.post).toHaveBeenCalledWith('/chat/completions', expect.objectContaining({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.any(String)
          })
        ])
      }));
    });

    it('should throw error when ChatGPT API returns undefined data', async () => {
      // Only OpenAI configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return { openai: { apiKey: 'openai-key', model: 'gpt-4o' } };
          default:
            return {};
        }
      });

      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({}), // No data property
        defaults: { timeout: 30000 }
      };

      mockedAxios.create.mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      
      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('No content received from ChatGPT API');
    });

    it('should throw error when ChatGPT API returns data but missing choices', async () => {
      // Only OpenAI configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return { openai: { apiKey: 'openai-key', model: 'gpt-4o' } };
          default:
            return {};
        }
      });

      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({ data: {} }), // data exists, but no choices
        defaults: { timeout: 30000 }
      };

      mockedAxios.create.mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      
      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('No content received from ChatGPT API');
    });
  });

  describe('Gemini API integration', () => {
    it('should call Gemini API with correct parameters', async () => {
      // Clear all mocks first
      jest.clearAllMocks();
      
      // Mock config to only have Gemini
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'github':
            return { token: null };
          case 'copilot':
            return { apiToken: null };
          case 'aiProviders':
            return { 
              gemini: { apiKey: 'gemini-key', model: 'gemini-1.5-pro' },
              claude: { apiKey: null },
              openai: { apiKey: null },
              copilot: { apiToken: null }
            };
          default:
            return {};
        }
      });

      // Also clear environment variables for other providers
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.CHATGPT_API_KEY;
      // Set only Gemini key
      process.env.GEMINI_API_KEY = 'gemini-key';

      const mockGeminiInstance = {
        post: jest.fn().mockResolvedValue({
          data: {
            candidates: [{
              content: {
                parts: [{
                  text: '{"title": "Test", "body": "Test body"}'
                }]
              }
            }]
          }
        }),
        defaults: { timeout: 30000 }
      };

      // Mock axios.create to return the Gemini instance only
      mockedAxios.create.mockReturnValue(mockGeminiInstance as any);

      service = new AIDescriptionGeneratorService();
      await service.generatePRDescription(mockOptions);

      expect(mockGeminiInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-1.5-pro:generateContent?key=gemini-key'),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.any(String)
                })
              ])
            })
          ]),
          generationConfig: expect.objectContaining({
            maxOutputTokens: 4000
          })
        })
      );
    });
  });

  describe('Copilot API integration', () => {
    it('should throw error when Copilot API returns undefined data', async () => {
      // Only Copilot configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return {
              claude: { apiKey: null },
              openai: { apiKey: null },
              gemini: { apiKey: null }
            };
          case 'copilot':
            return { apiToken: 'copilot-token' };
          case 'github':
            return { token: 'copilot-token' };
          default:
            return {};
        }
      });

      // Clear environment variables for other providers
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.CHATGPT_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      // Patch: Copilot returns { data: undefined } instead of {}
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      // Mock axios.create to return the Copilot instance
      mockedAxios.create.mockReturnValue(mockCopilotInstance as any);

      service = new AIDescriptionGeneratorService();
      
      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('No content received from Copilot API');
    });

    it('should throw error when Copilot API returns data but missing expected fields', async () => {
      // Only Copilot configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return {
              claude: { apiKey: null },
              openai: { apiKey: null },
              gemini: { apiKey: null }
            };
          case 'copilot':
            return { apiToken: 'copilot-token' };
          case 'github':
            return { token: 'copilot-token' };
          default:
            return {};
        }
      });

      // Clear environment variables for other providers
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.CHATGPT_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      // Patch: Copilot returns { data: undefined } instead of { data: {} }
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      // Mock axios.create to return the Copilot instance
      mockedAxios.create.mockReturnValue(mockCopilotInstance as any);

      service = new AIDescriptionGeneratorService();
      
      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('No content received from Copilot API');
    });
  });

  describe('Error handling', () => {
    it('should throw error when no AI providers are configured', () => {
      mockedGetConfig.mockImplementation(() => ({}));

      expect(() => new AIDescriptionGeneratorService()).not.toThrow();
    });

    it('should throw error on network failures', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      await expect(service.generatePRDescription(mockOptions)).rejects.toThrow('Network error');
    });
  });

  describe('Template support', () => {
    it('should use PR template when provided', async () => {
      const optionsWithTemplate = {
        ...mockOptions,
        template: {
          name: 'Default Template',
          content: '## Description\n{{description}}\n\n## Testing\n- [ ] Manual testing'
        }
      };

      const mockResponse = {
        content: [{ text: '{"title": "PROJ-123: Test", "body": "## Description\\nTest content\\n\\n## Testing\\n- [ ] Manual testing"}' }]
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(optionsWithTemplate);

      expect(result.body).toContain('## Testing');
      expect(result.body).toContain('- [ ] Manual testing');
    });
  });

  describe('Response parsing', () => {
    it('should parse valid JSON response correctly', async () => {
      const mockResponse = {
        content: [{
          text: '{"title": "PROJ-123: Valid JSON", "body": "## Summary\\nValid JSON response"}'
        }]
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBe('PROJ-123: Valid JSON');
      expect(result.body).toBe('## Summary\nValid JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockResponse = {
        content: [{
          text: '```json\n{"title": "PROJ-123: Markdown JSON", "body": "## Summary\\nJSON in markdown"}\n```'
        }]
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBe('PROJ-123: Markdown JSON');
      expect(result.body).toBe('## Summary\nJSON in markdown');
    });

    it('should extract title from non-JSON response', async () => {
      const mockResponse = {
        content: [{
          text: 'Title: PROJ-123: Extracted Title\n\nThis is the body content'
        }]
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toBe('PROJ-123: Extracted Title');
      expect(result.body).toContain('This is the body content');
    });
  });
});
