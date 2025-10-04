import simpleGit, { SimpleGit } from 'simple-git';
import { GitService } from '../services/git';

// Mock dependencies
jest.mock('simple-git');

const mockedSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;

describe('GitService', () => {
  let gitService: GitService;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGit = {
      branch: jest.fn(),
      diffSummary: jest.fn(),
      log: jest.fn(),
      diff: jest.fn(),
      status: jest.fn(),
      checkIsRepo: jest.fn(),
      getRemotes: jest.fn(),
      push: jest.fn()
    } as any;

    mockedSimpleGit.mockReturnValue(mockGit);
    gitService = new GitService();
  });

  describe('constructor', () => {
    it('should initialize simple-git', () => {
      expect(mockedSimpleGit).toHaveBeenCalled();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const mockBranchResult = {
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      };

      mockGit.branch.mockResolvedValue(mockBranchResult as any);

      const result = await gitService.getCurrentBranch();

      expect(result).toBe('feature/test-branch');
      expect(mockGit.branch).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockGit.branch.mockRejectedValue(new Error('Git error'));

      await expect(gitService.getCurrentBranch()).rejects.toThrow(
        'Git error'
      );
    });
  });

  describe('validateRepository', () => {
    it('should validate repository successfully', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true as any);

      await expect(gitService.validateRepository()).resolves.toBeUndefined();
      expect(mockGit.checkIsRepo).toHaveBeenCalled();
    });

    it('should throw error for invalid repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false as any);

      await expect(gitService.validateRepository()).rejects.toThrow(
        'Not in a git repository'
      );
    });

    it('should handle git errors', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('Git command failed'));

      await expect(gitService.validateRepository()).rejects.toThrow(
        'Git command failed'
      );
    });
  });

  describe('hasUncommittedChanges', () => {
    it('should return true when there are uncommitted changes', async () => {
      const mockStatus = {
        modified: ['file1.ts'],
        created: ['file2.ts'],
        deleted: [],
        staged: [],
        not_added: [],
        conflicted: [],
        files: ['file1.ts', 'file2.ts']
      };

      mockGit.status.mockResolvedValue(mockStatus as any);

      const result = await gitService.hasUncommittedChanges();

      expect(result).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should return false when repository is clean', async () => {
      const mockStatus = {
        modified: [],
        created: [],
        deleted: [],
        staged: [],
        not_added: [],
        conflicted: [],
        files: []
      };

      mockGit.status.mockResolvedValue(mockStatus as any);

      const result = await gitService.hasUncommittedChanges();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockGit.status.mockRejectedValue(new Error('Git status failed'));

      await expect(gitService.hasUncommittedChanges()).rejects.toThrow(
        'Git status failed'
      );
    });
  });

  describe('branchExists', () => {
    it('should return true for existing branch', async () => {
      const mockBranches = {
        all: [
          'main',
          'remotes/origin/feature/test-branch',
          'feature/local-branch'
        ],
        branches: {},
        current: 'main'
      };

      mockGit.branch.mockResolvedValue(mockBranches as any);

      const result = await gitService.branchExists('test-branch');

      expect(result).toBe(true);
      expect(mockGit.branch).toHaveBeenCalledWith(['-a']);
    });

    it('should return false for non-existing branch', async () => {
      const mockBranches = {
        all: [
          'main',
          'remotes/origin/feature/other-branch'
        ],
        branches: {},
        current: 'main'
      };

      mockGit.branch.mockResolvedValue(mockBranches as any);

      const result = await gitService.branchExists('non-existing');

      expect(result).toBe(false);
    });

    it('should return false when branch listing fails', async () => {
      mockGit.branch.mockRejectedValue(new Error('Branch listing failed'));

      const result = await gitService.branchExists('test-branch');

      expect(result).toBe(false);
    });
  });

  describe('getChanges', () => {
    const mockDiffSummary = {
      changed: 2,
      insertions: 15,
      deletions: 5,
      files: [
        {
          file: 'src/test.ts',
          changes: 10,
          insertions: 8,
          deletions: 2,
          binary: false
        },
        {
          file: 'src/utils.ts',
          changes: 10,
          insertions: 7,
          deletions: 3,
          binary: false
        }
      ]
    };

    const mockLogResult = {
      all: [
        { message: 'feat: add new feature' },
        { message: 'fix: bug fix' }
      ],
      latest: null,
      total: 2
    };

    beforeEach(() => {
      mockGit.branch.mockResolvedValue({
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      } as any);

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue(mockLogResult as any);
    });

    it('should get changes successfully', async () => {
      const result = await gitService.getChanges('main');

      expect(result).toEqual({
        totalFiles: 2,
        totalInsertions: 15,
        totalDeletions: 5,
        files: [
          {
            file: 'src/test.ts',
            status: 'modified',
            changes: 10,
            insertions: 8,
            deletions: 2
          },
          {
            file: 'src/utils.ts',
            status: 'modified',
            changes: 10,
            insertions: 7,
            deletions: 3
          }
        ],
        commits: ['feat: add new feature', 'fix: bug fix']
      });

      expect(mockGit.diffSummary).toHaveBeenCalledWith(['main...HEAD']);
      expect(mockGit.log).toHaveBeenCalledWith({ from: 'main', to: 'HEAD' });
    });

    it('should throw error when comparing branch with itself', async () => {
      mockGit.branch.mockResolvedValue({
        current: 'main',
        all: ['main']
      } as any);

      await expect(gitService.getChanges('main')).rejects.toThrow(
        "Cannot compare branch with itself. Current branch is 'main'. Please checkout a feature branch."
      );
    });

    it('should handle git errors', async () => {
      mockGit.diffSummary.mockRejectedValue(new Error('Git diff failed'));

      await expect(gitService.getChanges('main')).rejects.toThrow(
        'Git diff failed'
      );
    });

    it('should handle individual file diff failures gracefully', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 5,
        deletions: 2,
        files: [
          {
            file: 'src/test.ts',
            changes: 7,
            insertions: 5,
            deletions: 2,
            binary: false
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.diff.mockRejectedValue(new Error('Individual file diff failed'));

      const result = await gitService.getChanges('main', true);

      expect(result.files[0].diffContent).toBeUndefined();
      expect(result.files[0].lineNumbers).toBeUndefined();
    });

    it('should handle files without insertions property', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 0,
        deletions: 0,
        files: [
          {
            file: 'src/test.ts',
            deletions: 2,
            changes: 2,
            binary: false
            // Missing insertions property
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].insertions).toBe(0);
      expect(result.files[0].deletions).toBe(2);
      expect(result.files[0].changes).toBe(2);
    });

    it('should handle files without deletions property', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 5,
        deletions: 0,
        files: [
          {
            file: 'src/test.ts',
            insertions: 5,
            changes: 5,
            binary: false
            // Missing deletions property
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].insertions).toBe(5);
      expect(result.files[0].deletions).toBe(0);
      expect(result.files[0].changes).toBe(5);
    });

    it('should handle files without changes property', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 5,
        deletions: 2,
        files: [
          {
            file: 'src/test.ts',
            insertions: 5,
            deletions: 2,
            binary: false
            // Missing changes property
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].insertions).toBe(5);
      expect(result.files[0].deletions).toBe(2);
      expect(result.files[0].changes).toBe(0);
    });
  });

  describe('getDiffContent', () => {
    it('should get diff content successfully', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n+added line\n-removed line';
      mockGit.diff.mockResolvedValue(mockDiff);

      const result = await gitService.getDiffContent('main');

      expect(result).toBe(mockDiff);
      expect(mockGit.diff).toHaveBeenCalledWith(['main...HEAD']);
    });

    it('should truncate large diffs', async () => {
      const lines = Array(1000).fill('line').join('\n');
      mockGit.diff.mockResolvedValue(lines);

      const result = await gitService.getDiffContent('main', 100);

      expect(result).toContain('... (diff truncated for brevity)');
    });

    it('should handle errors gracefully', async () => {
      mockGit.diff.mockRejectedValue(new Error('Git diff failed'));

      await expect(gitService.getDiffContent('main')).rejects.toThrow(
        'Git diff failed'
      );
    });
  });

  describe('pushCurrentBranch', () => {
    it('should push current branch successfully', async () => {
      mockGit.branch.mockResolvedValue({
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      } as any);

      mockGit.push.mockResolvedValue(undefined as any);

      await gitService.pushCurrentBranch();

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature/test-branch', ['--set-upstream']);
    });

    it('should handle push errors', async () => {
      mockGit.branch.mockResolvedValue({
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      } as any);

      mockGit.push.mockRejectedValue(new Error('Push failed'));

      await expect(gitService.pushCurrentBranch()).rejects.toThrow(
        'Push failed'
      );
    });
  });

  describe('mapGitStatus', () => {
    beforeEach(() => {
      mockGit.branch.mockResolvedValue({
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      } as any);
    });

    it('should map binary files as modified', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 0,
        deletions: 0,
        files: [
          {
            file: 'image.png',
            changes: 0,
            insertions: 0,
            deletions: 0,
            binary: true
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('modified');
    });

    it('should map renamed files correctly', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 5,
        deletions: 5,
        files: [
          {
            file: 'old-name.ts => new-name.ts',
            changes: 10,
            insertions: 5,
            deletions: 5,
            binary: false
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('renamed');
    });

    it('should map added files correctly', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 10,
        deletions: 0,
        files: [
          {
            file: 'new-file.ts',
            changes: 10,
            insertions: 10,
            deletions: 0,
            binary: false
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('added');
    });

    it('should map deleted files correctly', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 0,
        deletions: 10,
        files: [
          {
            file: 'deleted-file.ts',
            changes: 10,
            insertions: 0,
            deletions: 10,
            binary: false
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('deleted');
    });

    it('should map modified files correctly', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 5,
        deletions: 3,
        files: [
          {
            file: 'modified-file.ts',
            changes: 8,
            insertions: 5,
            deletions: 3,
            binary: false
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('modified');
    });
  });

  describe('extractLineNumbers', () => {
    beforeEach(() => {
      mockGit.branch.mockResolvedValue({
        current: 'feature/test-branch',
        all: ['main', 'feature/test-branch']
      } as any);
    });

    it('should extract line numbers from diff content', async () => {
      const mockDiffSummary = {
        changed: 1,
        insertions: 3,
        deletions: 2,
        files: [
          {
            file: 'test.ts',
            changes: 5,
            insertions: 3,
            deletions: 2,
            binary: false
          }
        ]
      };

      const mockDiff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,4 +1,6 @@
 line1
-line2
+line2 modified
+line3 added
 line4
+line5 added
@@ -10,3 +12,5 @@
 line10
-line11
+line11 modified
+line12 added`;

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary as any);
      mockGit.log.mockResolvedValue({ all: [], latest: null, total: 0 } as any);
      mockGit.diff.mockResolvedValue(mockDiff);

      const result = await gitService.getChanges('main', true);

      expect(result.files[0].lineNumbers).toBeDefined();
      expect(result.files[0].lineNumbers?.added).toContain(2);
      expect(result.files[0].lineNumbers?.added).toContain(3);
      expect(result.files[0].lineNumbers?.added).toContain(5);
      expect(result.files[0].lineNumbers?.removed).toContain(2);
      expect(result.files[0].lineNumbers?.removed).toContain(11);
    });
  });
});
