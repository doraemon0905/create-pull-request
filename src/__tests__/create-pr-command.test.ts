import { Command } from 'commander';
import * as inquirer from 'inquirer';
import { createPRCommand } from '../commands/create-pr';
import { JiraService } from '../services/jira';
import { GitService } from '../services/git';
import { GitHubService } from '../services/github';
import { AIDescriptionGeneratorService } from '../services/ai-description-generator';
import { validateConfig } from '../utils/config';

// Mock dependencies
jest.mock('inquirer');
jest.mock('../services/jira');
jest.mock('../services/git');
jest.mock('../services/github');
jest.mock('../services/ai-description-generator');
jest.mock('../utils/config');

const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedJiraService = JiraService as jest.MockedClass<typeof JiraService>;
const mockedGitService = GitService as jest.MockedClass<typeof GitService>;
const mockedGitHubService = GitHubService as jest.MockedClass<typeof GitHubService>;
const mockedAIService = AIDescriptionGeneratorService as jest.MockedClass<typeof AIDescriptionGeneratorService>;
const mockedValidateConfig = validateConfig as jest.MockedFunction<typeof validateConfig>;

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation()
};

describe('Create PR Command', () => {
  let mockJiraService: jest.Mocked<JiraService>;
  let mockGitService: jest.Mocked<GitService>;
  let mockGitHubService: jest.Mocked<GitHubService>;
  let mockAIService: jest.Mocked<AIDescriptionGeneratorService>;
  let command: Command;

  const mockJiraTicket = {
    key: 'PROJ-123',
    summary: 'Test feature implementation',
    description: 'Implement a new test feature',
    issueType: 'Story',
    status: 'In Progress',
    assignee: 'John Doe',
    priority: 'High',
    created: '2023-01-01T00:00:00.000Z',
    updated: '2023-01-02T00:00:00.000Z'
  };

  const mockGitChanges = {
    totalFiles: 2,
    totalInsertions: 30,
    totalDeletions: 5,
    files: [
      {
        file: 'src/test.ts',
        status: 'modified',
        insertions: 20,
        deletions: 3,
        lineNumbers: { added: [10, 11], removed: [5] },
        diffContent: '+console.log("test");'
      },
      {
        file: 'src/utils.ts',
        status: 'added',
        insertions: 10,
        deletions: 2,
        lineNumbers: { added: [1, 2, 3], removed: [] },
        diffContent: '+export function newUtil() {}'
      }
    ],
    commits: ['feat: add new feature', 'fix: update utils']
  };

  const mockRepositoryInfo = {
    owner: 'testowner',
    repo: 'testrepo'
  };

  const mockPRTemplate = {
    content: '## Description\n{{description}}\n\n## Testing\n- [ ] Manual testing',
    path: '.github/pull_request_template.md'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(consoleSpy).forEach(spy => spy.mockClear());

    // Mock service instances
    mockJiraService = {
      getTicket: jest.fn(),
      validateConnection: jest.fn()
    } as any;

    mockGitService = {
      getCurrentBranch: jest.fn(),
      getTicketFromBranch: jest.fn(),
      getChanges: jest.fn(),
      getRemoteOriginUrl: jest.fn(),
      isGitRepository: jest.fn()
    } as any;

    mockGitHubService = {
      parseRepositoryUrl: jest.fn(),
      createPullRequest: jest.fn(),
      getPullRequestTemplate: jest.fn()
    } as any;

    mockAIService = {
      generatePRDescription: jest.fn()
    } as any;

    // Mock service constructors
    mockedJiraService.mockImplementation(() => mockJiraService);
    mockedGitService.mockImplementation(() => mockGitService);
    mockedGitHubService.mockImplementation(() => mockGitHubService);
    mockedAIService.mockImplementation(() => mockAIService);

    // Mock config validation
    mockedValidateConfig.mockReturnValue(true);

    // Create command instance
    command = createPRCommand();
  });

  afterAll(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Command configuration', () => {
    it('should configure command with correct name and description', () => {
      expect(command.name()).toBe('create-pr');
      expect(command.description()).toContain('Create a pull request');
    });

    it('should have correct options', () => {
      const options = command.options;
      const optionNames = options.map(opt => opt.long);

      expect(optionNames).toContain('--ticket');
      expect(optionNames).toContain('--base');
      expect(optionNames).toContain('--title');
      expect(optionNames).toContain('--skip-ai');
      expect(optionNames).toContain('--dry-run');
    });
  });

  describe('Command execution', () => {
    beforeEach(() => {
      // Setup default mocks for successful execution
      mockGitService.isGitRepository.mockResolvedValue(true);
      mockGitService.getCurrentBranch.mockResolvedValue('feature/PROJ-123');
      mockGitService.getTicketFromBranch.mockResolvedValue('PROJ-123');
      mockGitService.getChanges.mockResolvedValue(mockGitChanges);
      mockGitService.getRemoteOriginUrl.mockResolvedValue('https://github.com/testowner/testrepo.git');
      
      mockJiraService.getTicket.mockResolvedValue(mockJiraTicket);
      
      mockGitHubService.parseRepositoryUrl.mockReturnValue(mockRepositoryInfo);
      mockGitHubService.getPullRequestTemplate.mockResolvedValue(mockPRTemplate);
      mockGitHubService.createPullRequest.mockResolvedValue({
        number: 123,
        url: 'https://github.com/testowner/testrepo/pull/123',
        title: 'PROJ-123: Test feature implementation',
        body: 'Test PR description'
      });

      mockAIService.generatePRDescription.mockResolvedValue({
        title: 'PROJ-123: Test feature implementation',
        body: '## Description\nImplement new test feature\n\n## Testing\n- [ ] Manual testing'
      });
    });

    it('should execute successfully with ticket from branch', async () => {
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockGitService.isGitRepository).toHaveBeenCalled();
      expect(mockGitService.getTicketFromBranch).toHaveBeenCalled();
      expect(mockJiraService.getTicket).toHaveBeenCalledWith('PROJ-123');
      expect(mockGitService.getChanges).toHaveBeenCalledWith('main');
      expect(mockAIService.generatePRDescription).toHaveBeenCalled();
      expect(mockGitHubService.createPullRequest).toHaveBeenCalled();
    });

    it('should execute with explicit ticket option', async () => {
      await command.parseAsync(['node', 'test', '--ticket', 'PROJ-456'], { from: 'user' });

      expect(mockJiraService.getTicket).toHaveBeenCalledWith('PROJ-456');
      expect(mockGitService.getTicketFromBranch).not.toHaveBeenCalled();
    });

    it('should execute with custom base branch', async () => {
      await command.parseAsync(['node', 'test', '--base', 'develop'], { from: 'user' });

      expect(mockGitService.getChanges).toHaveBeenCalledWith('develop');
    });

    it('should execute with custom title', async () => {
      const customTitle = 'Custom PR Title';
      await command.parseAsync(['node', 'test', '--title', customTitle], { from: 'user' });

      expect(mockGitHubService.createPullRequest).toHaveBeenCalledWith(
        mockRepositoryInfo,
        'feature/PROJ-123',
        'main',
        customTitle,
        expect.any(String)
      );
    });

    it('should skip AI generation when --skip-ai flag is used', async () => {
      await command.parseAsync(['node', 'test', '--skip-ai'], { from: 'user' });

      expect(mockAIService.generatePRDescription).not.toHaveBeenCalled();
      expect(mockGitHubService.createPullRequest).toHaveBeenCalledWith(
        mockRepositoryInfo,
        'feature/PROJ-123',
        'main',
        expect.stringContaining('PROJ-123'),
        expect.any(String)
      );
    });

    it('should perform dry run without creating PR', async () => {
      await command.parseAsync(['node', 'test', '--dry-run'], { from: 'user' });

      expect(mockAIService.generatePRDescription).toHaveBeenCalled();
      expect(mockGitHubService.createPullRequest).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    });
  });

  describe('Error handling', () => {
    it('should handle invalid configuration', async () => {
      mockedValidateConfig.mockReturnValue(false);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('configuration is invalid')
      );
    });

    it('should handle non-git repository', async () => {
      mockGitService.isGitRepository.mockResolvedValue(false);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('not a Git repository')
      );
    });

    it('should handle missing ticket in branch name', async () => {
      mockGitService.getTicketFromBranch.mockResolvedValue(null);

      // Mock inquirer to provide ticket
      mockedInquirer.prompt.mockResolvedValue({ ticketKey: 'PROJ-789' });

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockedInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'ticketKey',
            message: expect.stringContaining('Jira ticket')
          })
        ])
      );
      expect(mockJiraService.getTicket).toHaveBeenCalledWith('PROJ-789');
    });

    it('should handle Jira ticket not found', async () => {
      const jiraError = new Error('Ticket not found');
      (jiraError as any).response = { status: 404 };
      mockJiraService.getTicket.mockRejectedValue(jiraError);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch Jira ticket')
      );
    });

    it('should handle missing remote origin', async () => {
      mockGitService.getRemoteOriginUrl.mockResolvedValue(null);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('remote origin URL')
      );
    });

    it('should handle invalid GitHub URL', async () => {
      mockGitHubService.parseRepositoryUrl.mockReturnValue(null);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid GitHub URL')
      );
    });

    it('should handle AI service failures gracefully', async () => {
      mockAIService.generatePRDescription.mockRejectedValue(new Error('AI service unavailable'));

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('AI description generation failed')
      );
      expect(mockGitHubService.createPullRequest).toHaveBeenCalled();
    });

    it('should handle PR creation failures', async () => {
      const ghError = new Error('Pull request creation failed');
      (ghError as any).response = { status: 422 };
      mockGitHubService.createPullRequest.mockRejectedValue(ghError);

      await expect(command.parseAsync(['node', 'test'], { from: 'user' }))
        .rejects.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create pull request')
      );
    });
  });

  describe('Interactive prompts', () => {
    it('should prompt for ticket when not found', async () => {
      mockGitService.getTicketFromBranch.mockResolvedValue(null);
      mockedInquirer.prompt.mockResolvedValue({ ticketKey: 'PROJ-999' });

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockedInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'input',
            name: 'ticketKey',
            message: expect.any(String),
            validate: expect.any(Function)
          })
        ])
      );
    });

    it('should prompt for base branch confirmation', async () => {
      mockedInquirer.prompt.mockResolvedValue({ 
        baseBranch: 'develop',
        confirmCreate: true 
      });

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockedInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'baseBranch',
            message: expect.stringContaining('base branch')
          })
        ])
      );
    });

    it('should prompt for PR creation confirmation', async () => {
      mockedInquirer.prompt.mockResolvedValue({ confirmCreate: true });

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockedInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'confirmCreate',
            message: expect.stringContaining('Create pull request')
          })
        ])
      );
    });

    it('should abort when user declines to create PR', async () => {
      mockedInquirer.prompt.mockResolvedValue({ confirmCreate: false });

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockGitHubService.createPullRequest).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
    });
  });

  describe('Template handling', () => {
    it('should use PR template when available', async () => {
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockGitHubService.getPullRequestTemplate).toHaveBeenCalled();
      expect(mockAIService.generatePRDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          template: mockPRTemplate
        })
      );
    });

    it('should work without PR template', async () => {
      mockGitHubService.getPullRequestTemplate.mockResolvedValue(null);

      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockAIService.generatePRDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          template: undefined
        })
      );
    });
  });

  describe('Output formatting', () => {
    it('should display success message with PR URL', async () => {
      await command.parseAsync(['node', 'test'], { from: 'user' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Pull request created successfully')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/testowner/testrepo/pull/123')
      );
    });

    it('should display dry run information', async () => {
      await command.parseAsync(['node', 'test', '--dry-run'], { from: 'user' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Title:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Body:')
      );
    });
  });
});