import { createPullRequest, CreatePROptions } from '../commands/create-pr';
import { JiraService } from '../services/jira';
import { GitService } from '../services/git';
import { GitHubService } from '../services/github';
import { AIDescriptionGeneratorService } from '../services/ai-description-generator';
import { validateConfig } from '../utils/config';

// Mock dependencies
jest.mock('../services/jira');
jest.mock('../services/git');
jest.mock('../services/github');
jest.mock('../services/ai-description-generator');
jest.mock('../utils/config');
jest.mock('inquirer');
jest.mock('ora', () => ({
  __esModule: true,
  default: () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: ''
  })
}));

const mockJiraService = new JiraService() as jest.Mocked<JiraService>;
const mockGitService = new GitService() as jest.Mocked<GitService>;
const mockGitHubService = new GitHubService() as jest.Mocked<GitHubService>;
const mockAIService = new AIDescriptionGeneratorService() as jest.Mocked<AIDescriptionGeneratorService>;
const mockValidateConfig = validateConfig as jest.MockedFunction<typeof validateConfig>;

describe('Create PR Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateConfig.mockReturnValue(true);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPullRequest', () => {
    const mockOptions: CreatePROptions = {
      jira: 'PROJ-123',
      base: 'main',
      title: 'Test PR',
      dryRun: false,
      draft: false
    };

    it('should be a function', () => {
      expect(typeof createPullRequest).toBe('function');
    });

    it('should handle dry run mode', async () => {
      const dryRunOptions: CreatePROptions = {
        ...mockOptions,
        dryRun: true
      };

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true); // Mock that 'main' branch exists
      
      // Test should not throw for dry run
      await expect(createPullRequest(dryRunOptions)).resolves.toBeUndefined();
    });

    it('should handle missing configuration gracefully', async () => {
      mockValidateConfig.mockReturnValue(false);

      await expect(createPullRequest(mockOptions)).rejects.toThrow();
    });

    it('should handle git repository validation errors', async () => {
      mockGitService.validateRepository = jest.fn().mockRejectedValue(new Error('Not a git repository'));

      await expect(createPullRequest(mockOptions)).rejects.toThrow();
    });

    it('should handle options with required properties', () => {
      const validOptions: CreatePROptions = {
        jira: 'PROJ-123'
      };

      expect(validOptions).toHaveProperty('jira');
      expect(typeof createPullRequest).toBe('function');
    });
  });

  describe('CreatePROptions interface', () => {
    it('should accept valid options', () => {
      const options: CreatePROptions = {
        jira: 'PROJ-123',
        base: 'main',
        title: 'Test title',
        dryRun: true,
        draft: false
      };

      expect(options.jira).toBe('PROJ-123');
      expect(options.base).toBe('main');
      expect(options.title).toBe('Test title');
      expect(options.dryRun).toBe(true);
      expect(options.draft).toBe(false);
    });

    it('should accept partial options', () => {
      const options: CreatePROptions = {
        jira: 'PROJ-123'
      };

      expect(options.jira).toBe('PROJ-123');
      expect(options.base).toBeUndefined();
      expect(options.title).toBeUndefined();
      expect(options.dryRun).toBeUndefined();
      expect(options.draft).toBeUndefined();
    });
  });
});