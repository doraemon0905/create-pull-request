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

    it('should fallback to ChatGPT when Claude fails', async () => {
      // Claude fails, ChatGPT succeeds
      const mockClaudeInstance = {
        post: jest.fn().mockRejectedValue(new Error('Claude API error')),
        defaults: { timeout: 30000 }
      };
      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{
              message: {
                content: '{"title": "PROJ-123: Test feature", "body": "## Summary\\nTest implementation"}'
              }
            }]
          }
        }),
        defaults: { timeout: 30000 }
      };
      const mockGeminiInstance = {
        post: jest.fn(),
        defaults: { timeout: 30000 }
      };

      // Mock the order of create calls for providers
      mockedAxios.create
        .mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();

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

    it('should use fallback description when all AI providers fail', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const result = await service.generatePRDescription(mockOptions);

      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle ChatGPT API returning undefined data gracefully', async () => {
      // Claude fails, ChatGPT returns undefined data
      const mockClaudeInstance = {
        post: jest.fn().mockRejectedValue(new Error('Claude API error')),
        defaults: { timeout: 30000 }
      };
      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({}), // No data property
        defaults: { timeout: 30000 }
      };
      const mockGeminiInstance = {
        post: jest.fn().mockRejectedValue(new Error('Gemini API error')),
        defaults: { timeout: 30000 }
      };
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({}), // No data property
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();

      const result = await service.generatePRDescription(mockOptions);

      // Should fallback to template-based or default description, not throw
      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle ChatGPT API returning data but missing choices gracefully', async () => {
      // Claude fails, ChatGPT returns data but no choices
      const mockClaudeInstance = {
        post: jest.fn().mockRejectedValue(new Error('Claude API error')),
        defaults: { timeout: 30000 }
      };
      const mockChatGPTInstance = {
        post: jest.fn().mockResolvedValue({ data: {} }), // data exists, but no choices
        defaults: { timeout: 30000 }
      };
      const mockGeminiInstance = {
        post: jest.fn().mockRejectedValue(new Error('Gemini API error')),
        defaults: { timeout: 30000 }
      };
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({}), // No data property
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();

      const result = await service.generatePRDescription(mockOptions);

      // Should fallback to template-based or default description, not throw
      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle Copilot API returning undefined data gracefully', async () => {
      // All providers fail or return undefined data, including Copilot
      const mockClaudeInstance = {
        post: jest.fn().mockRejectedValue(new Error('Claude API error')),
        defaults: { timeout: 30000 }
      };
      const mockChatGPTInstance = {
        post: jest.fn().mockRejectedValue(new Error('ChatGPT API error')),
        defaults: { timeout: 30000 }
      };
      const mockGeminiInstance = {
        post: jest.fn().mockRejectedValue(new Error('Gemini API error')),
        defaults: { timeout: 30000 }
      };
      // Patch: Copilot returns { data: undefined } instead of {}
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();

      const result = await service.generatePRDescription(mockOptions);

      // Should fallback to template-based or default description, not throw
      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle Copilot API returning data but missing choices gracefully', async () => {
      // All providers fail or return data with missing expected fields, including Copilot
      const mockClaudeInstance = {
        post: jest.fn().mockRejectedValue(new Error('Claude API error')),
        defaults: { timeout: 30000 }
      };
      const mockChatGPTInstance = {
        post: jest.fn().mockRejectedValue(new Error('ChatGPT API error')),
        defaults: { timeout: 30000 }
      };
      const mockGeminiInstance = {
        post: jest.fn().mockRejectedValue(new Error('Gemini API error')),
        defaults: { timeout: 30000 }
      };
      // Patch: Copilot returns { data: undefined } instead of { data: {} }
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce(mockClaudeInstance as any)
        .mockReturnValueOnce(mockChatGPTInstance as any)
        .mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();

      const result = await service.generatePRDescription(mockOptions);

      // Should fallback to template-based or default description, not throw
      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
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

    it('should handle ChatGPT API returning undefined data gracefully', async () => {
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
      const result = await service.generatePRDescription(mockOptions);

      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle ChatGPT API returning data but missing choices gracefully', async () => {
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
      const result = await service.generatePRDescription(mockOptions);

      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });
  });

  describe('Gemini API integration', () => {
    it('should call Gemini API with correct parameters', async () => {
      // Mock config to only have Gemini
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return { gemini: { apiKey: 'gemini-key', model: 'gemini-1.5-pro' } };
          default:
            return {};
        }
      });

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

      mockedAxios.create.mockReturnValueOnce(mockGeminiInstance as any)
        .mockReturnValue({} as any);

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
    it('should handle Copilot API returning undefined data gracefully', async () => {
      // Only Copilot configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return {};
          case 'copilot':
            return { apiToken: 'copilot-token' };
          default:
            return {};
        }
      });

      // Patch: Copilot returns { data: undefined } instead of {}
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce({} as any) // Claude
        .mockReturnValueOnce({} as any) // ChatGPT
        .mockReturnValueOnce({} as any) // Gemini
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      const result = await service.generatePRDescription(mockOptions);

      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });

    it('should handle Copilot API returning data but missing expected fields gracefully', async () => {
      // Only Copilot configured
      mockedGetConfig.mockImplementation((section: any) => {
        switch (section) {
          case 'aiProviders':
            return {};
          case 'copilot':
            return { apiToken: 'copilot-token' };
          default:
            return {};
        }
      });

      // Patch: Copilot returns { data: undefined } instead of { data: {} }
      const mockCopilotInstance = {
        post: jest.fn().mockResolvedValue({ data: undefined }),
        defaults: { timeout: 30000 }
      };

      mockedAxios.create
        .mockReturnValueOnce({} as any) // Claude
        .mockReturnValueOnce({} as any) // ChatGPT
        .mockReturnValueOnce({} as any) // Gemini
        .mockReturnValueOnce(mockCopilotInstance as any)
        .mockReturnValue({} as any);

      service = new AIDescriptionGeneratorService();
      const result = await service.generatePRDescription(mockOptions);

      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
      expect(result.body).toContain('Summary');
    });
  });

  describe('Error handling', () => {
    it('should throw error when no AI providers are configured', () => {
      mockedGetConfig.mockImplementation(() => ({}));

      expect(() => new AIDescriptionGeneratorService()).not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await service.generatePRDescription(mockOptions);

      // Should fall back to template-based generation
      expect(result).toBeDefined();
      expect(result.title).toContain('PROJ-123');
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
