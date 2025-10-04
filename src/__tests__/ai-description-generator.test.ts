import { AIDescriptionGeneratorService, GenerateDescriptionOptions } from '../services/ai-description-generator.js';
import { AIProviderManager } from '../services/ai-providers/manager.js';
import { PromptBuilder } from '../services/ai-providers/prompt-builder.js';
import { ResponseParser } from '../services/ai-providers/response-parser.js';

// Mock the modular classes
jest.mock('../services/ai-providers/manager.js');
jest.mock('../services/ai-providers/prompt-builder.js');
jest.mock('../services/ai-providers/response-parser.js');

const MockedAIProviderManager = AIProviderManager as jest.MockedClass<typeof AIProviderManager>;
const MockedPromptBuilder = PromptBuilder as jest.MockedClass<typeof PromptBuilder>;
const MockedResponseParser = ResponseParser as jest.MockedClass<typeof ResponseParser>;

describe('AIDescriptionGeneratorService', () => {
  let service: AIDescriptionGeneratorService;
  let mockProviderManager: jest.Mocked<AIProviderManager>;
  let mockPromptBuilder: jest.Mocked<PromptBuilder>;
  let mockResponseParser: jest.Mocked<ResponseParser>;

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
      updated: '2023-01-02T00:00:00.000Z',
      parentTicket: null
    },
    gitChanges: {
      totalFiles: 2,
      totalInsertions: 50,
      totalDeletions: 10,
      commits: ['feat: add new feature', 'fix: bug fix'],
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
        }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockProviderManager = {
      selectProvider: jest.fn().mockResolvedValue('claude'),
      generateContent: jest.fn().mockResolvedValue('Generated content')
    } as any;

    mockPromptBuilder = {
      buildPrompt: jest.fn().mockReturnValue('Built prompt')
    } as any;

    mockResponseParser = {
      parseAIResponse: jest.fn().mockReturnValue({
        title: 'Test Title',
        body: 'Test Body',
        summary: 'Test Summary'
      })
    } as any;

    // Mock the constructors
    MockedAIProviderManager.mockImplementation(() => mockProviderManager);
    MockedPromptBuilder.mockImplementation(() => mockPromptBuilder);
    MockedResponseParser.mockImplementation(() => mockResponseParser);

    service = new AIDescriptionGeneratorService();
  });

  describe('constructor', () => {
    it('should initialize with modular classes', () => {
      expect(MockedAIProviderManager).toHaveBeenCalled();
      expect(MockedPromptBuilder).toHaveBeenCalled();
      expect(MockedResponseParser).toHaveBeenCalled();
    });
  });

  describe('generatePRDescription', () => {
    it('should generate PR description using modular classes', async () => {
      const result = await service.generatePRDescription(mockOptions);

      expect(mockProviderManager.selectProvider).toHaveBeenCalledTimes(2); // Once for summary, once for main generation
      expect(mockPromptBuilder.buildPrompt).toHaveBeenCalledWith(mockOptions, 'Generated content');
      expect(mockProviderManager.generateContent).toHaveBeenCalledTimes(2);
      expect(mockResponseParser.parseAIResponse).toHaveBeenCalledWith({ content: 'Generated content' }, 'claude');

      expect(result).toEqual({
        title: 'Test Title',
        body: 'Test Body',
        summary: 'Generated content'
      });
    });

    it('should handle errors from provider manager', async () => {
      mockProviderManager.selectProvider.mockRejectedValue(new Error('Provider error'));

      await expect(service.generatePRDescription(mockOptions))
        .rejects.toThrow('Provider error');
    });

    it('should handle errors from prompt builder', async () => {
      mockPromptBuilder.buildPrompt.mockImplementation(() => {
        throw new Error('Prompt builder error');
      });

      await expect(service.generatePRDescription(mockOptions))
        .rejects.toThrow('Prompt builder error');
    });

    it('should handle errors from response parser', async () => {
      mockResponseParser.parseAIResponse.mockImplementation(() => {
        throw new Error('Response parser error');
      });

      await expect(service.generatePRDescription(mockOptions))
        .rejects.toThrow('Response parser error');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary using provider manager', async () => {
      const summary = await (service as any).generateSummary(mockOptions);

      expect(mockProviderManager.selectProvider).toHaveBeenCalled();
      expect(mockProviderManager.generateContent).toHaveBeenCalledWith(
        'Generate a concise summary of the changes in this pull request based on the Jira ticket and file changes. Focus on the key modifications and their purpose.',
        'claude'
      );
      expect(summary).toBe('Generated content');
    });
  });
});
