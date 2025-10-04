import { createPullRequest, CreatePROptions } from '../commands/create-pr';
import { GitService } from '../services/git';
import { GitHubService } from '../services/github';
import { JiraService } from '../services/atlassian-facade';
import { AIDescriptionGeneratorService } from '../services/ai-description-generator';
import { validateConfig } from '../utils/config';

// Mock dependencies
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      repos: {
        get: jest.fn(),
        listPullRequestsAssociatedWithCommit: jest.fn(),
        createOrUpdateFileContents: jest.fn(),
        getContent: jest.fn()
      },
      pulls: {
        create: jest.fn(),
        update: jest.fn(),
        get: jest.fn()
      },
      git: {
        getRef: jest.fn()
      }
    }
  }))
}));
jest.mock('../services/atlassian-facade');
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
jest.mock('../utils/spinner.js', () => ({
  __esModule: true,
  createSpinner: () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: '',
    isSpinning: false
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

    it('should retry AI description generation when user chooses to retry', async () => {
      const inquirer = require('inquirer');

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true);
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: [],
        commits: []
      });
      mockGitService.getDiffContent = jest.fn().mockResolvedValue('mock diff content');
      mockGitService.pushCurrentBranch = jest.fn().mockResolvedValue(undefined);

      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);
      mockGitHubService.createOrUpdatePullRequest = jest.fn().mockResolvedValue({
        data: { html_url: 'http://github.com/test/pr/1', number: 1, title: 'Test PR' },
        isUpdate: false
      });

      mockJiraService.getTicket = jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Story',
        status: 'In Progress'
      });

      // Mock AI service to fail once, then succeed
      mockAIDescriptionService.generatePRDescription = jest.fn()
        .mockRejectedValueOnce(new Error('AI service failed'))
        .mockResolvedValueOnce({ title: 'Test PR', body: 'Test body', summary: 'Test summary' });

      // Mock inquirer to return retry choice, then create action
      inquirer.default.prompt
        .mockResolvedValueOnce({ retry: true }) // First prompt: retry choice
        .mockResolvedValueOnce({ action: 'create' }); // Second prompt: create action

      await expect(createPullRequest(mockOptions)).resolves.toBeUndefined();

      // Verify AI service was called twice (initial attempt + retry)
      expect(mockAIDescriptionService.generatePRDescription).toHaveBeenCalledTimes(2);
    });

    it('should not retry AI description generation when user chooses not to retry', async () => {
      const inquirer = require('inquirer');

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true);
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: [],
        commits: []
      });
      mockGitService.getDiffContent = jest.fn().mockResolvedValue('mock diff content');

      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);

      mockJiraService.getTicket = jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Story',
        status: 'In Progress'
      });

      // Mock AI service to fail
      const expectedError = new Error('AI service failed');
      mockAIDescriptionService.generatePRDescription = jest.fn().mockRejectedValue(expectedError);

      // Mock inquirer to return no retry choice
      inquirer.default.prompt.mockResolvedValueOnce({ retry: false });

      await expect(createPullRequest(mockOptions)).rejects.toThrow('AI service failed');

      // Verify AI service was called only once (no retry)
      expect(mockAIDescriptionService.generatePRDescription).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple retry attempts and succeed on the third attempt', async () => {
      const inquirer = require('inquirer');

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true);
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: [],
        commits: []
      });
      mockGitService.getDiffContent = jest.fn().mockResolvedValue('mock diff content');
      mockGitService.pushCurrentBranch = jest.fn().mockResolvedValue(undefined);

      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);
      mockGitHubService.createOrUpdatePullRequest = jest.fn().mockResolvedValue({
        data: { html_url: 'http://github.com/test/pr/1', number: 1, title: 'Test PR' },
        isUpdate: false
      });

      mockJiraService.getTicket = jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Story',
        status: 'In Progress'
      });

      // Mock AI service to fail three times, then succeed
      mockAIDescriptionService.generatePRDescription = jest.fn()
        .mockRejectedValueOnce(new Error('AI service failed'))
        .mockRejectedValueOnce(new Error('AI service failed again'))
        .mockRejectedValueOnce(new Error('AI service failed once more'))
        .mockResolvedValueOnce({ title: 'Test PR', body: 'Test body', summary: 'Test summary' });

      // Mock inquirer responses
      inquirer.default.prompt
        .mockResolvedValueOnce({ retry: true }) // Initial retry choice
        .mockResolvedValueOnce({ continueRetry: true }) // Continue after first retry failure
        .mockResolvedValueOnce({ continueRetry: true }) // Continue after second retry failure
        .mockResolvedValueOnce({ action: 'create' }); // Create action after success

      await expect(createPullRequest(mockOptions)).resolves.toBeUndefined();

      // Verify AI service was called 4 times (initial + 3 retries)
      expect(mockAIDescriptionService.generatePRDescription).toHaveBeenCalledTimes(4);
    });

    it('should give up retrying when user chooses not to continue after retry failure', async () => {
      const inquirer = require('inquirer');

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true);
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: [],
        commits: []
      });
      mockGitService.getDiffContent = jest.fn().mockResolvedValue('mock diff content');

      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);

      mockJiraService.getTicket = jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Story',
        status: 'In Progress'
      });

      // Mock AI service to fail twice
      const expectedError = new Error('AI service failed again');
      mockAIDescriptionService.generatePRDescription = jest.fn()
        .mockRejectedValueOnce(new Error('AI service failed'))
        .mockRejectedValueOnce(expectedError);

      // Mock inquirer responses
      inquirer.default.prompt
        .mockResolvedValueOnce({ retry: true }) // Initial retry choice
        .mockResolvedValueOnce({ continueRetry: false }); // Don't continue after first retry failure

      await expect(createPullRequest(mockOptions)).rejects.toThrow('AI service failed again');

      // Verify AI service was called twice (initial + 1 retry)
      expect(mockAIDescriptionService.generatePRDescription).toHaveBeenCalledTimes(2);
    });

    it('should throw error after all retry attempts are exhausted', async () => {
      const inquirer = require('inquirer');

      // Mock the basic methods needed
      mockGitService.validateRepository = jest.fn().mockResolvedValue(undefined);
      mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/PROJ-123');
      mockGitService.hasUncommittedChanges = jest.fn().mockResolvedValue(false);
      mockGitService.branchExists = jest.fn().mockResolvedValue(true);
      mockGitService.getChanges = jest.fn().mockResolvedValue({
        totalFiles: 2,
        totalInsertions: 10,
        totalDeletions: 5,
        files: [],
        commits: []
      });
      mockGitService.getDiffContent = jest.fn().mockResolvedValue('mock diff content');

      mockGitHubService.getCurrentRepo = jest.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' });
      mockGitHubService.getPullRequestTemplates = jest.fn().mockResolvedValue([]);

      mockJiraService.getTicket = jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Story',
        status: 'In Progress'
      });

      // Mock AI service to fail consistently
      const finalError = new Error('Final AI failure');
      mockAIDescriptionService.generatePRDescription = jest.fn()
        .mockRejectedValueOnce(new Error('AI service failed'))
        .mockRejectedValueOnce(new Error('AI service failed again'))
        .mockRejectedValueOnce(new Error('AI service failed once more'))
        .mockRejectedValueOnce(finalError);

      // Mock inquirer to continue retrying
      inquirer.default.prompt
        .mockResolvedValueOnce({ retry: true }) // Initial retry choice
        .mockResolvedValueOnce({ continueRetry: true }) // Continue after first retry failure
        .mockResolvedValueOnce({ continueRetry: true }); // Continue after second retry failure
      // No third prompt because max retries (3) are reached

      await expect(createPullRequest(mockOptions)).rejects.toThrow('Final AI failure');

      // Verify AI service was called 4 times (initial + 3 retries)
      expect(mockAIDescriptionService.generatePRDescription).toHaveBeenCalledTimes(4);
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
