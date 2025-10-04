import { GitHubService } from '../services/github';
import { getConfig } from '../utils/config';

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
jest.mock('../utils/config');
jest.mock('simple-git');
jest.mock('node:fs');
jest.mock('node:path');

// Get the mocked Octokit from the mock
const { Octokit } = jest.requireMock('@octokit/rest');
const MockedOctokit = Octokit as jest.MockedClass<any>;
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
        return path === '.github/PULL_REQUEST_TEMPLATE.md';
      });

      jest.mocked(mockedFs.readFileSync).mockImplementation((path: any) => {
        if (path === '.github/PULL_REQUEST_TEMPLATE.md') {
          return mockContent;
        }
        throw new Error('File not found');
      });

      const result = await githubService.getPullRequestTemplates();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'PULL_REQUEST_TEMPLATE.md',
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

    it('should skip templates that fail to load', async () => {
      const _templateDir = '.github/PULL_REQUEST_TEMPLATE';

      // Mock readdirSync to return files
      jest.mocked(mockedFs.readdirSync).mockReturnValue(['template1.md', 'template2.md'] as any);

      // Mock existsSync to return false for all files (simulating tryLoadTemplate returning null)
      jest.mocked(mockedFs.existsSync).mockReturnValue(false);

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

  describe('findExistingPullRequest', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should find existing pull request', async () => {
      const mockResponse = {
        data: [
          {
            id: 123,
            number: 1,
            title: 'Existing PR',
            html_url: 'https://github.com/testowner/testrepo/pull/1'
          }
        ]
      };

      mockOctokit.rest.pulls.list.mockResolvedValue(mockResponse);

      const result = await githubService.findExistingPullRequest(mockRepo, 'feature/test');

      expect(result).toEqual(mockResponse.data[0]);
      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        head: 'testowner:feature/test',
        state: 'open'
      });
    });

    it('should return null when no existing pull request found', async () => {
      const mockResponse = {
        data: []
      };

      mockOctokit.rest.pulls.list.mockResolvedValue(mockResponse);

      const result = await githubService.findExistingPullRequest(mockRepo, 'feature/test');

      expect(result).toBeNull();
    });

    it('should return null when API call fails', async () => {
      mockOctokit.rest.pulls.list.mockRejectedValue(new Error('API Error'));

      const result = await githubService.findExistingPullRequest(mockRepo, 'feature/test');

      expect(result).toBeNull();
    });
  });

  describe('updatePullRequest', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should update pull request successfully', async () => {
      const mockResponse = {
        data: {
          id: 123,
          number: 1,
          title: 'Updated PR',
          html_url: 'https://github.com/testowner/testrepo/pull/1'
        }
      };

      mockOctokit.rest.pulls.update.mockResolvedValue(mockResponse);

      const updateData = {
        title: 'Updated PR',
        body: 'Updated description'
      };

      const result = await githubService.updatePullRequest(mockRepo, 1, updateData);

      expect(result).toEqual(mockResponse.data);
      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 1,
        title: 'Updated PR',
        body: 'Updated description'
      });
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;

      mockOctokit.rest.pulls.update.mockRejectedValue(error);

      await expect(githubService.updatePullRequest(mockRepo, 1, { title: 'Updated' }))
        .rejects.toThrow('Authentication failed. Please check your GitHub token.');
    });

    it('should handle permission errors', async () => {
      const error = new Error('Forbidden');
      (error as any).status = 403;

      mockOctokit.rest.pulls.update.mockRejectedValue(error);

      await expect(githubService.updatePullRequest(mockRepo, 1, { title: 'Updated' }))
        .rejects.toThrow('Access denied. Please check your GitHub token permissions.');
    });

    it('should handle other API errors', async () => {
      const error = new Error('Not Found');
      (error as any).status = 404;

      mockOctokit.rest.pulls.update.mockRejectedValue(error);

      await expect(githubService.updatePullRequest(mockRepo, 1, { title: 'Updated' }))
        .rejects.toThrow('Pull request not found.');
    });

    it('should handle generic API errors', async () => {
      const error = new Error('Server Error');
      (error as any).status = 500;

      mockOctokit.rest.pulls.update.mockRejectedValue(error);

      await expect(githubService.updatePullRequest(mockRepo, 1, { title: 'Updated' }))
        .rejects.toThrow('GitHub API error: Server Error');
    });
  });

  describe('extractTemplateNameFromPath', () => {
    it('should extract filename from path with directory', () => {
      const result = (githubService as any).extractTemplateNameFromPath('.github/PULL_REQUEST_TEMPLATE.md');
      expect(result).toBe('PULL_REQUEST_TEMPLATE.md');
    });

    it('should return filename when no directory', () => {
      const result = (githubService as any).extractTemplateNameFromPath('template.md');
      expect(result).toBe('template.md');
    });
  });

  describe('validatePullRequestData', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    it('should validate all required fields', async () => {
      const invalidPR = {
        title: '',
        body: '',
        head: '',
        base: ''
      };

      await expect(githubService.createPullRequest(mockRepo, invalidPR))
        .rejects.toThrow('Pull request validation failed');
    });

    it('should validate title length limit', async () => {
      const longTitle = 'a'.repeat(300); // Assuming MAX_PR_TITLE_LENGTH is less than 300
      const invalidPR = {
        title: longTitle,
        body: 'Test description',
        head: 'feature/test',
        base: 'main'
      };

      await expect(githubService.createPullRequest(mockRepo, invalidPR))
        .rejects.toThrow('Title is too long');
    });
  });

  describe('createOrUpdatePullRequest', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    const mockPullRequest = {
      title: 'Test PR',
      body: 'Test description',
      head: 'feature/test',
      base: 'main',
      draft: false
    };

    it('should update existing pull request', async () => {
      const existingPR = {
        id: 123,
        number: 1,
        title: 'Existing PR',
        html_url: 'https://github.com/testowner/testrepo/pull/1'
      };

      const updatedPR = {
        id: 123,
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/testowner/testrepo/pull/1'
      };

      // Mock findExistingPullRequest to return existing PR
      jest.spyOn(githubService, 'findExistingPullRequest').mockResolvedValue(existingPR);
      jest.spyOn(githubService, 'updatePullRequest').mockResolvedValue(updatedPR);

      const result = await githubService.createOrUpdatePullRequest(mockRepo, mockPullRequest);

      expect(result).toEqual({ data: updatedPR, isUpdate: true });
      expect(githubService.findExistingPullRequest).toHaveBeenCalledWith(mockRepo, 'feature/test');
      expect(githubService.updatePullRequest).toHaveBeenCalledWith(mockRepo, 1, {
        title: 'Test PR',
        body: 'Test description',
        base: 'main',
        draft: false
      });
    });

    it('should create new pull request when none exists', async () => {
      const newPR = {
        id: 124,
        number: 2,
        title: 'Test PR',
        html_url: 'https://github.com/testowner/testrepo/pull/2'
      };

      // Mock findExistingPullRequest to return null
      jest.spyOn(githubService, 'findExistingPullRequest').mockResolvedValue(null);
      jest.spyOn(githubService, 'createPullRequest').mockResolvedValue(newPR);

      const result = await githubService.createOrUpdatePullRequest(mockRepo, mockPullRequest);

      expect(result).toEqual({ data: newPR, isUpdate: false });
      expect(githubService.findExistingPullRequest).toHaveBeenCalledWith(mockRepo, 'feature/test');
      expect(githubService.createPullRequest).toHaveBeenCalledWith(mockRepo, mockPullRequest);
    });
  });

  describe('createPullRequest generic error handling', () => {
    const mockRepo = {
      owner: 'testowner',
      repo: 'testrepo'
    };

    const mockPullRequest = {
      title: 'Test PR',
      body: 'Test description',
      head: 'feature/test',
      base: 'main',
      draft: false
    };

    it('should handle generic API errors', async () => {
      const error = new Error('Server Error');
      (error as any).status = 500;

      mockOctokit.rest.pulls.create.mockRejectedValue(error);

      await expect(githubService.createPullRequest(mockRepo, mockPullRequest))
        .rejects.toThrow('GitHub API error: Server Error');
    });
  });
});
