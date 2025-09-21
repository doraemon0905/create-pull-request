import { createPullRequest, CreatePROptions } from '../commands/create-pr';
import { GitService } from '../services/git';
import { GitHubService } from '../services/github';
import { JiraService } from '../services/jira';
import { AIDescriptionGeneratorService } from '../services/ai-description-generator';
import { validateConfig } from '../utils/config';

// Mock dependencies
jest.mock('../services/jira');
jest.mock('../services/git');
jest.mock('../services/github');
jest.mock('../services/ai-description-generator');
jest.mock('../utils/config');
jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn()
  }
}));
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

const mockGitService = new GitService() as jest.Mocked<GitService>;
const mockGitHubService = new GitHubService() as jest.Mocked<GitHubService>;
const mockJiraService = new JiraService() as jest.Mocked<JiraService>;
const mockAIDescriptionService = new AIDescriptionGeneratorService() as jest.Mocked<AIDescriptionGeneratorService>;
const mockValidateConfig = validateConfig as jest.MockedFunction<typeof validateConfig>;

// Mock the GitService constructor to return our mock instance
(GitService as jest.MockedClass<typeof GitService>).mockImplementation(() => mockGitService);

// Mock the GitHubService constructor to return our mock instance
(GitHubService as jest.MockedClass<typeof GitHubService>).mockImplementation(() => mockGitHubService);

// Mock the JiraService constructor to return our mock instance
(JiraService as jest.MockedClass<typeof JiraService>).mockImplementation(() => mockJiraService);

// Mock the AIDescriptionGeneratorService constructor to return our mock instance
(AIDescriptionGeneratorService as jest.MockedClass<typeof AIDescriptionGeneratorService>).mockImplementation(() => mockAIDescriptionService);

describe('Create PR Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateConfig.mockReturnValue(true);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock inquirer
    const inquirer = require('inquirer');
    inquirer.default.prompt.mockResolvedValue({ action: 'create' });
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
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: []
      });
      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);
      mockJiraService.getTicket = jest.fn().mockResolvedValue({ key: 'PROJ-123', summary: 'Test ticket' });
      mockAIDescriptionService.generatePRDescription = jest.fn().mockResolvedValue({ title: 'Test PR', body: 'Test body' });

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
