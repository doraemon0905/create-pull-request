import { Octokit } from '@octokit/rest';
import { GitHubService } from '../services/github';
import { getConfig } from '../utils/config';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('../utils/config');
jest.mock('simple-git');

const MockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('GitHubService', () => {
  let githubService: GitHubService;
  let mockOctokit: any;

  const mockConfig = {
    token: 'test-token',
    defaultBranch: 'main'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a comprehensive mock for Octokit
    mockOctokit = {
      rest: {
        users: {
          getAuthenticated: jest.fn()
        },
        repos: {
          getContent: jest.fn()
        },
        pulls: {
          create: jest.fn(),
          update: jest.fn(),
          list: jest.fn()
        }
      }
    };

    MockedOctokit.mockImplementation(() => mockOctokit);
    mockedGetConfig.mockReturnValue(mockConfig);

    githubService = new GitHubService();
  });

  describe('constructor', () => {
    it('should initialize with GitHub token', () => {
      expect(MockedOctokit).toHaveBeenCalledWith({
        auth: 'test-token',
        userAgent: 'create-pr-cli'
      });
    });

    it('should throw error when token is missing', () => {
      mockedGetConfig.mockReturnValue({ token: '', defaultBranch: 'main' });

      expect(() => new GitHubService()).toThrow(
        'Missing GitHub token. Please run "create-pr setup" to configure your credentials.'
      );
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' }
      });

      const result = await githubService.validateConnection();

      expect(result).toBe(true);
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
    });

    it('should return false for authentication failures', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('Unauthorized'));

      const result = await githubService.validateConnection();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentRepo', () => {
    it('should get current repository info successfully', async () => {
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            push: 'https://github.com/testowner/testrepo.git'
          }
        }
      ];

      // Mock simple-git
      const mockGit = {
        getRemotes: jest.fn().mockResolvedValue(mockRemotes)
      };

      (githubService as any).git = mockGit;

      const result = await githubService.getCurrentRepo();

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo'
      });

      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
    });

    it('should handle missing origin remote', async () => {
      const mockGit = {
        getRemotes: jest.fn().mockResolvedValue([])
      };

      (githubService as any).git = mockGit;

      await expect(githubService.getCurrentRepo()).rejects.toThrow(
        'No origin remote found'
      );
    });

    it('should handle non-GitHub URLs', async () => {
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            push: 'https://gitlab.com/owner/repo.git'
          }
        }
      ];

      const mockGit = {
        getRemotes: jest.fn().mockResolvedValue(mockRemotes)
      };

      (githubService as any).git = mockGit;

      await expect(githubService.getCurrentRepo()).rejects.toThrow(
        'Unable to parse GitHub repository from remote URL'
      );
    });
  });

  describe('createPullRequest', () => {
    const mockPullRequest = {
      title: 'Test PR',
      body: 'Test description',
      head: 'feature/test',
      base: 'main',
      draft: false
    };

    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should create pull request successfully', async () => {
      const mockResponse = {
        data: {
          id: 123,
          number: 1,
          html_url: 'https://github.com/testowner/testrepo/pull/1'
        }
      };

      mockOctokit.rest.pulls.create.mockResolvedValue(mockResponse);

      const result = await githubService.createPullRequest(mockRepo, mockPullRequest);

      expect(result).toEqual(mockResponse.data);
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test PR',
        body: 'Test description',
        head: 'feature/test',
        base: 'main',
        draft: false
      });
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;

      mockOctokit.rest.pulls.create.mockRejectedValue(error);

      await expect(githubService.createPullRequest(mockRepo, mockPullRequest))
        .rejects.toThrow('Authentication failed. Please check your GitHub token.');
    });

    it('should handle permission errors', async () => {
      const error = new Error('Forbidden');
      (error as any).status = 403;

      mockOctokit.rest.pulls.create.mockRejectedValue(error);

      await expect(githubService.createPullRequest(mockRepo, mockPullRequest))
        .rejects.toThrow('Access denied. Please check your GitHub token permissions.');
    });

    it('should validate pull request data', async () => {
      const invalidPR = {
        title: '',
        body: 'Test description',
        head: 'feature/test',
        base: 'main'
      };

      await expect(githubService.createPullRequest(mockRepo, invalidPR))
        .rejects.toThrow('Pull request validation failed');
    });

    it('should prevent creating PR with same head and base', async () => {
      const invalidPR = {
        title: 'Test PR',
        body: 'Test description',
        head: 'main',
        base: 'main'
      };

      await expect(githubService.createPullRequest(mockRepo, invalidPR))
        .rejects.toThrow('Head branch cannot be the same as base branch');
    });
  });

  describe('getCurrentBranch', () => {
    it('should get current branch successfully', async () => {
      const mockGit = {
        branch: jest.fn().mockResolvedValue({
          current: 'feature/test-branch'
        })
      };

      (githubService as any).git = mockGit;

      const result = await githubService.getCurrentBranch();

      expect(result).toBe('feature/test-branch');
    });

    it('should handle git errors', async () => {
      const mockGit = {
        branch: jest.fn().mockRejectedValue(new Error('Git error'))
      };

      (githubService as any).git = mockGit;

      await expect(githubService.getCurrentBranch()).rejects.toThrow(
        'Git error'
      );
    });
  });

  describe('getPullRequestTemplates', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should get pull request templates successfully', async () => {
      const mockContent = Buffer.from('## Description\n{{description}}').toString('base64');

      mockOctokit.rest.repos.getContent.mockResolvedValueOnce({
        data: {
          type: 'file',
          content: mockContent
        }
      });

      const result = await githubService.getPullRequestTemplates(mockRepo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'pull_request_template.md',
        content: '## Description\n{{description}}'
      });
    });

    it('should return empty array when no templates found', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue({ status: 404 });

      const result = await githubService.getPullRequestTemplates(mockRepo);

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockOctokit.rest.repos.getContent.mockRejectedValue(new Error('API Error'));

      const result = await githubService.getPullRequestTemplates(mockRepo);

      expect(result).toEqual([]);
    });
  });
});
