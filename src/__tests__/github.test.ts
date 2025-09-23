import { Octokit } from '@octokit/rest';
import { GitHubService } from '../services/github';
import { getConfig } from '../utils/config';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('../utils/config');
jest.mock('simple-git');
jest.mock('node:fs');
jest.mock('node:path');

const MockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

// Import mocked fs and path
import * as fs from 'node:fs';
import * as path from 'node:path';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

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

    // Reset file system mocks
    jest.clearAllMocks();

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
    it('should get pull request templates successfully from local file system', async () => {
      const mockContent = '## Description\n{{description}}';

      // Mock file system to return template exists and content
      jest.mocked(mockedFs.existsSync).mockImplementation((path: any) => {
        return path === '.github/pull_request_template.md';
      });

      jest.mocked(mockedFs.readFileSync).mockImplementation((path: any) => {
        if (path === '.github/pull_request_template.md') {
          return mockContent;
        }
        throw new Error('File not found');
      });

      const result = await githubService.getPullRequestTemplates();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'pull_request_template.md',
        content: mockContent
      });
    });

    it('should return empty array when no templates found', async () => {
      // Mock file system to return no templates exist
      jest.mocked(mockedFs.existsSync).mockReturnValue(false);

      const result = await githubService.getPullRequestTemplates();

      expect(result).toEqual([]);
    });

    it('should handle file system errors gracefully', async () => {
      // Mock file system to exist but throw error on read
      jest.mocked(mockedFs.existsSync).mockReturnValue(true);
      jest.mocked(mockedFs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await githubService.getPullRequestTemplates();

      expect(result).toEqual([]);
    });

    it('should handle multiple templates in directory', async () => {
      const templateDir = '.github/PULL_REQUEST_TEMPLATE';

      // Mock first check for individual templates (none exist, but directory and files exist)
      jest.mocked(mockedFs.existsSync).mockImplementation((path: any) => {
        if (path === templateDir) return true;
        if (path === `${templateDir}/template1.md`) return true;
        if (path === `${templateDir}/template2.md`) return true;
        return false;
      });

      // Mock directory reading
      jest.mocked(mockedFs.readdirSync).mockReturnValue(['template1.md', 'template2.md', 'notmd.txt'] as any);

      // Mock path.join
      jest.mocked(mockedPath.join).mockImplementation((dir: string, file: string) => `${dir}/${file}`);

      // Mock reading individual template files
      jest.mocked(mockedFs.readFileSync).mockImplementation((path: any) => {
        if (path === `${templateDir}/template1.md`) return 'Template 1 content';
        if (path === `${templateDir}/template2.md`) return 'Template 2 content';
        throw new Error('File not found');
      });

      const result = await githubService.getPullRequestTemplates();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'template1.md',
        content: 'Template 1 content'
      });
      expect(result[1]).toEqual({
        name: 'template2.md',
        content: 'Template 2 content'
      });
    });
  });
});
