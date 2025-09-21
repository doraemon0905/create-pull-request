import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import { GitHubService, PullRequestTemplate, RepositoryInfo } from '../services/github';
import { getConfig } from '../utils/config';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('fs');
jest.mock('../utils/config');

const mockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('GitHubService', () => {
  let githubService: GitHubService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Octokit instance
    mockOctokit = {
      rest: {
        pulls: {
          create: jest.fn(),
          get: jest.fn(),
          update: jest.fn()
        },
        repos: {
          get: jest.fn(),
          getContent: jest.fn()
        }
      }
    } as any;

    mockedOctokit.mockImplementation(() => mockOctokit);

    // Mock config
    mockedGetConfig.mockReturnValue({
      token: 'github-token',
      defaultBranch: 'main'
    });

    githubService = new GitHubService();
  });

  describe('constructor', () => {
    it('should initialize Octokit with token from config', () => {
      expect(mockedOctokit).toHaveBeenCalledWith({
        auth: 'github-token'
      });
    });

    it('should throw error when no token provided', () => {
      mockedGetConfig.mockReturnValue({});

      expect(() => new GitHubService()).toThrow('GitHub token not found in configuration');
    });
  });

  describe('parseRepositoryUrl', () => {
    it('should parse HTTPS GitHub URL correctly', () => {
      const result = githubService.parseRepositoryUrl('https://github.com/owner/repo.git');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo'
      });
    });

    it('should parse SSH GitHub URL correctly', () => {
      const result = githubService.parseRepositoryUrl('git@github.com:owner/repo.git');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo'
      });
    });

    it('should parse URL without .git extension', () => {
      const result = githubService.parseRepositoryUrl('https://github.com/owner/repo');

      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo'
      });
    });

    it('should return null for invalid URL', () => {
      const result = githubService.parseRepositoryUrl('https://gitlab.com/owner/repo');

      expect(result).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const result = githubService.parseRepositoryUrl('not-a-url');

      expect(result).toBeNull();
    });
  });

  describe('createPullRequest', () => {
    const mockRepoInfo: RepositoryInfo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should create pull request successfully', async () => {
      const mockResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/testowner/testrepo/pull/123',
          title: 'Test PR',
          body: 'Test description'
        }
      };

      mockOctokit.rest.pulls.create.mockResolvedValue(mockResponse as any);

      const result = await githubService.createPullRequest(
        mockRepoInfo,
        'feature-branch',
        'main',
        'Test PR',
        'Test description'
      );

      expect(result).toEqual({
        number: 123,
        url: 'https://github.com/testowner/testrepo/pull/123',
        title: 'Test PR',
        body: 'Test description'
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        title: 'Test PR',
        body: 'Test description',
        head: 'feature-branch',
        base: 'main'
      });
    });

    it('should handle GitHub API errors', async () => {
      const error = new Error('GitHub API error');
      (error as any).status = 422;
      (error as any).response = {
        data: {
          message: 'Validation Failed',
          errors: [{ message: 'Pull request already exists' }]
        }
      };

      mockOctokit.rest.pulls.create.mockRejectedValue(error);

      await expect(
        githubService.createPullRequest(
          mockRepoInfo,
          'feature-branch',
          'main',
          'Test PR',
          'Test description'
        )
      ).rejects.toThrow('GitHub API error');
    });

    it('should handle network errors', async () => {
      mockOctokit.rest.pulls.create.mockRejectedValue(new Error('Network error'));

      await expect(
        githubService.createPullRequest(
          mockRepoInfo,
          'feature-branch',
          'main',
          'Test PR',
          'Test description'
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('getRepositoryInfo', () => {
    it('should fetch repository information successfully', async () => {
      const mockResponse = {
        data: {
          name: 'testrepo',
          full_name: 'testowner/testrepo',
          default_branch: 'main',
          private: false,
          description: 'Test repository'
        }
      };

      mockOctokit.rest.repos.get.mockResolvedValue(mockResponse as any);

      const result = await githubService.getRepositoryInfo('testowner', 'testrepo');

      expect(result).toEqual({
        name: 'testrepo',
        fullName: 'testowner/testrepo',
        defaultBranch: 'main',
        isPrivate: false,
        description: 'Test repository'
      });

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo'
      });
    });

    it('should handle repository not found', async () => {
      const error = new Error('Not Found');
      (error as any).status = 404;

      mockOctokit.rest.repos.get.mockRejectedValue(error);

      await expect(
        githubService.getRepositoryInfo('testowner', 'nonexistent')
      ).rejects.toThrow('Not Found');
    });
  });

  describe('getPullRequestTemplate', () => {
    it('should find and return PR template from default location', async () => {
      const templateContent = '## Description\n{{description}}\n\n## Testing\n- [ ] Manual testing';
      
      mockedFs.existsSync.mockImplementation((path: any) => {
        return path === '.github/pull_request_template.md';
      });
      
      mockedFs.readFileSync.mockReturnValue(templateContent);

      const result = await githubService.getPullRequestTemplate();

      expect(result).toEqual({
        content: templateContent,
        path: '.github/pull_request_template.md'
      });

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        '.github/pull_request_template.md',
        'utf8'
      );
    });

    it('should try multiple template locations', async () => {
      const templateContent = '## Summary\n{{summary}}';
      
      mockedFs.existsSync.mockImplementation((path: any) => {
        return path === 'pull_request_template.md';
      });
      
      mockedFs.readFileSync.mockReturnValue(templateContent);

      const result = await githubService.getPullRequestTemplate();

      expect(result).toEqual({
        content: templateContent,
        path: 'pull_request_template.md'
      });

      // Should check multiple paths
      expect(mockedFs.existsSync).toHaveBeenCalledWith('.github/pull_request_template.md');
      expect(mockedFs.existsSync).toHaveBeenCalledWith('.github/PULL_REQUEST_TEMPLATE.md');
      expect(mockedFs.existsSync).toHaveBeenCalledWith('pull_request_template.md');
    });

    it('should return null when no template found', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await githubService.getPullRequestTemplate();

      expect(result).toBeNull();
    });

    it('should handle file read errors', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await githubService.getPullRequestTemplate();

      expect(result).toBeNull();
    });

    it('should fetch template from GitHub API when local file not found', async () => {
      const templateContent = '## GitHub Template\n{{content}}';
      
      mockedFs.existsSync.mockReturnValue(false);
      
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(templateContent).toString('base64'),
          encoding: 'base64'
        }
      } as any);

      // Mock parseRepositoryUrl to return valid repo info
      jest.spyOn(githubService, 'parseRepositoryUrl').mockReturnValue({
        owner: 'testowner',
        repo: 'testrepo'
      });

      const result = await githubService.getPullRequestTemplate('https://github.com/testowner/testrepo');

      expect(result).toEqual({
        content: templateContent,
        path: '.github/pull_request_template.md'
      });
    });

    it('should handle GitHub API errors when fetching template', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      const error = new Error('Not Found');
      (error as any).status = 404;
      
      mockOctokit.rest.repos.getContent.mockRejectedValue(error);

      jest.spyOn(githubService, 'parseRepositoryUrl').mockReturnValue({
        owner: 'testowner',
        repo: 'testrepo'
      });

      const result = await githubService.getPullRequestTemplate('https://github.com/testowner/testrepo');

      expect(result).toBeNull();
    });
  });

  describe('validatePullRequestData', () => {
    it('should validate correct PR data', () => {
      const validData = {
        title: 'PROJ-123: Valid PR title',
        body: 'Valid PR description',
        head: 'feature-branch',
        base: 'main'
      };

      expect(() => githubService.validatePullRequestData(validData)).not.toThrow();
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        body: 'Description',
        head: 'feature-branch',
        base: 'main'
      };

      expect(() => githubService.validatePullRequestData(invalidData))
        .toThrow('Pull request title cannot be empty');
    });

    it('should reject title that is too long', () => {
      const invalidData = {
        title: 'A'.repeat(300),
        body: 'Description',
        head: 'feature-branch',
        base: 'main'
      };

      expect(() => githubService.validatePullRequestData(invalidData))
        .toThrow('Pull request title is too long');
    });

    it('should reject empty head branch', () => {
      const invalidData = {
        title: 'Valid title',
        body: 'Description',
        head: '',
        base: 'main'
      };

      expect(() => githubService.validatePullRequestData(invalidData))
        .toThrow('Head branch cannot be empty');
    });

    it('should reject empty base branch', () => {
      const invalidData = {
        title: 'Valid title',
        body: 'Description',
        head: 'feature-branch',
        base: ''
      };

      expect(() => githubService.validatePullRequestData(invalidData))
        .toThrow('Base branch cannot be empty');
    });

    it('should reject same head and base branch', () => {
      const invalidData = {
        title: 'Valid title',
        body: 'Description',
        head: 'main',
        base: 'main'
      };

      expect(() => githubService.validatePullRequestData(invalidData))
        .toThrow('Head and base branches cannot be the same');
    });
  });

  describe('Error handling', () => {
    it('should format GitHub API errors properly', async () => {
      const apiError = new Error('Validation Failed');
      (apiError as any).status = 422;
      (apiError as any).response = {
        data: {
          message: 'Validation Failed',
          errors: [
            { field: 'title', code: 'missing_field' },
            { field: 'body', code: 'too_long' }
          ]
        }
      };

      mockOctokit.rest.pulls.create.mockRejectedValue(apiError);

      try {
        await githubService.createPullRequest(
          { owner: 'test', repo: 'test' },
          'head',
          'base',
          'title',
          'body'
        );
      } catch (error) {
        expect(error).toBe(apiError);
      }
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      (rateLimitError as any).status = 403;
      (rateLimitError as any).response = {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1234567890'
        }
      };

      mockOctokit.rest.pulls.create.mockRejectedValue(rateLimitError);

      await expect(
        githubService.createPullRequest(
          { owner: 'test', repo: 'test' },
          'head',
          'base',
          'title',
          'body'
        )
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Integration with constants', () => {
    it('should use REGEX_PATTERNS for URL parsing', () => {
      const testUrls = [
        'https://github.com/owner/repo.git',
        'git@github.com:owner/repo.git',
        'https://github.com/owner/repo',
        'https://gitlab.com/owner/repo' // Should not match
      ];

      const results = testUrls.map(url => githubService.parseRepositoryUrl(url));

      expect(results[0]).toEqual({ owner: 'owner', repo: 'repo' });
      expect(results[1]).toEqual({ owner: 'owner', repo: 'repo' });
      expect(results[2]).toEqual({ owner: 'owner', repo: 'repo' });
      expect(results[3]).toBeNull();
    });
  });
});