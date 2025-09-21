import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import { GitService } from '../services/git';
import { REGEX_PATTERNS } from '../constants';

// Mock dependencies
jest.mock('simple-git');

const mockedSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;

describe('GitService', () => {
  let gitService: GitService;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGit = {
      status: jest.fn(),
      diff: jest.fn(),
      log: jest.fn(),
      raw: jest.fn(),
      revparse: jest.fn(),
      branch: jest.fn(),
      getRemotes: jest.fn(),
      remote: jest.fn()
    } as any;

    mockedSimpleGit.mockReturnValue(mockGit);
    gitService = new GitService();
  });

  describe('constructor', () => {
    it('should initialize simple-git instance', () => {
      expect(simpleGit).toHaveBeenCalledWith(process.cwd());
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockGit.revparse.mockResolvedValue('feature/PROJ-123-test-feature');

      const result = await gitService.getCurrentBranch();

      expect(result).toBe('feature/PROJ-123-test-feature');
      expect(mockGit.revparse).toHaveBeenCalledWith(['--abbrev-ref', 'HEAD']);
    });

    it('should handle git errors', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Git error'));

      await expect(gitService.getCurrentBranch()).rejects.toThrow('Git error');
    });
  });

  describe('getTicketFromBranch', () => {
    it('should extract ticket from branch name', async () => {
      mockGit.revparse.mockResolvedValue('feature/PROJ-123-implement-feature');

      const result = await gitService.getTicketFromBranch();

      expect(result).toBe('PROJ-123');
    });

    it('should extract ticket from different branch patterns', async () => {
      const testCases = [
        ['feature/ABC-456', 'ABC-456'],
        ['bugfix/XYZ-789-fix-issue', 'XYZ-789'],
        ['hotfix/TEST-1-urgent', 'TEST-1'],
        ['ABC-999/some-description', 'ABC-999'],
        ['develop', null],
        ['main', null],
        ['feature/no-ticket', null]
      ];

      for (const [branchName, expectedTicket] of testCases) {
        mockGit.revparse.mockResolvedValue(branchName);
        const result = await gitService.getTicketFromBranch();
        expect(result).toBe(expectedTicket);
      }
    });
  });

  describe('getChanges', () => {
    it('should return git changes with file details', async () => {
      const mockDiffResult: DiffResult = {
        files: [
          {
            file: 'src/test.ts',
            changes: 25,
            insertions: 20,
            deletions: 5,
            binary: false
          },
          {
            file: 'src/utils.ts',
            changes: 15,
            insertions: 10,
            deletions: 5,
            binary: false
          }
        ]
      } as DiffResult;

      const mockCommits = {
        all: [
          {
            hash: 'abc123',
            message: 'feat: implement new feature',
            author_name: 'Test User'
          },
          {
            hash: 'def456',
            message: 'fix: resolve bug',
            author_name: 'Test User'
          }
        ]
      };

      const mockDetailedDiff = `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,5 +1,8 @@
 export function test() {
+  console.log('new line');
   return true;
 }
+
+export function newFunction() {
+  return 'new';
+}`;

      mockGit.diff.mockResolvedValue(mockDiffResult);
      mockGit.log.mockResolvedValue(mockCommits as any);
      mockGit.raw.mockResolvedValue(mockDetailedDiff);

      const result = await gitService.getChanges('main');

      expect(result).toEqual({
        totalFiles: 2,
        totalInsertions: 30,
        totalDeletions: 10,
        files: [
          {
            file: 'src/test.ts',
            status: 'modified',
            insertions: 20,
            deletions: 5,
            lineNumbers: {
              added: [2, 6, 7, 8],
              removed: []
            },
            diffContent: expect.stringContaining('console.log(\'new line\');')
          },
          {
            file: 'src/utils.ts',
            status: 'modified',
            insertions: 10,
            deletions: 5,
            lineNumbers: { added: [], removed: [] },
            diffContent: ''
          }
        ],
        commits: [
          'feat: implement new feature',
          'fix: resolve bug'
        ]
      });

      expect(mockGit.diff).toHaveBeenCalledWith(['--numstat', 'main...HEAD']);
      expect(mockGit.log).toHaveBeenCalledWith(['main..HEAD']);
    });

    it('should handle files with different statuses', async () => {
      const mockDiffResult: DiffResult = {
        files: [
          {
            file: 'src/new.ts',
            changes: 10,
            insertions: 10,
            deletions: 0,
            binary: false
          },
          {
            file: 'src/deleted.ts',
            changes: 5,
            insertions: 0,
            deletions: 5,
            binary: false
          }
        ]
      } as DiffResult;

      mockGit.diff.mockResolvedValue(mockDiffResult);
      mockGit.log.mockResolvedValue({ all: [] } as any);
      mockGit.raw.mockResolvedValue('');

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('added');
      expect(result.files[1].status).toBe('deleted');
    });

    it('should handle binary files', async () => {
      const mockDiffResult: DiffResult = {
        files: [
          {
            file: 'assets/image.png',
            changes: 0,
            insertions: 0,
            deletions: 0,
            binary: true
          }
        ]
      } as DiffResult;

      mockGit.diff.mockResolvedValue(mockDiffResult);
      mockGit.log.mockResolvedValue({ all: [] } as any);
      mockGit.raw.mockResolvedValue('Binary files differ');

      const result = await gitService.getChanges('main');

      expect(result.files[0].status).toBe('modified');
      expect(result.files[0].diffContent).toBe('Binary files differ');
    });

    it('should handle empty changes', async () => {
      const mockDiffResult: DiffResult = {
        files: []
      } as DiffResult;

      mockGit.diff.mockResolvedValue(mockDiffResult);
      mockGit.log.mockResolvedValue({ all: [] } as any);

      const result = await gitService.getChanges('main');

      expect(result).toEqual({
        totalFiles: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        files: [],
        commits: []
      });
    });
  });

  describe('getRemoteOriginUrl', () => {
    it('should return remote origin URL', async () => {
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
            push: 'https://github.com/user/repo.git'
          }
        }
      ];

      mockGit.getRemotes.mockResolvedValue(mockRemotes as any);

      const result = await gitService.getRemoteOriginUrl();

      expect(result).toBe('https://github.com/user/repo.git');
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
    });

    it('should return null when no origin remote', async () => {
      const mockRemotes = [
        {
          name: 'upstream',
          refs: {
            fetch: 'https://github.com/upstream/repo.git',
            push: 'https://github.com/upstream/repo.git'
          }
        }
      ];

      mockGit.getRemotes.mockResolvedValue(mockRemotes as any);

      const result = await gitService.getRemoteOriginUrl();

      expect(result).toBeNull();
    });

    it('should handle git errors', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Git error'));

      await expect(gitService.getRemoteOriginUrl()).rejects.toThrow('Git error');
    });
  });

  describe('isGitRepository', () => {
    it('should return true for git repository', async () => {
      mockGit.raw.mockResolvedValue('true');

      const result = await gitService.isGitRepository();

      expect(result).toBe(true);
      expect(mockGit.raw).toHaveBeenCalledWith(['rev-parse', '--is-inside-work-tree']);
    });

    it('should return false for non-git directory', async () => {
      mockGit.raw.mockRejectedValue(new Error('Not a git repository'));

      const result = await gitService.isGitRepository();

      expect(result).toBe(false);
    });
  });

  describe('parseLineNumbers', () => {
    it('should parse added and removed line numbers from diff', () => {
      const diff = `@@ -1,5 +1,8 @@
 export function test() {
+  console.log('added line 2');
   return true;
-  console.log('removed line');
 }
+
+export function newFunction() {
+  return 'new';
+}`;

      const result = (gitService as any).parseLineNumbers(diff);

      expect(result.added).toEqual([2, 6, 7, 8]);
      expect(result.removed).toEqual([4]);
    });

    it('should handle multiple hunks', () => {
      const diff = `@@ -1,3 +1,4 @@
 line 1
+added line 2
 line 3
@@ -10,2 +11,3 @@
 line 10
+added line 12
 line 11`;

      const result = (gitService as any).parseLineNumbers(diff);

      expect(result.added).toEqual([2, 12]);
      expect(result.removed).toEqual([]);
    });

    it('should handle empty diff', () => {
      const result = (gitService as any).parseLineNumbers('');

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });

  describe('getFileStatus', () => {
    it('should determine correct file status', () => {
      expect((gitService as any).getFileStatus(10, 0)).toBe('added');
      expect((gitService as any).getFileStatus(0, 5)).toBe('deleted');
      expect((gitService as any).getFileStatus(10, 5)).toBe('modified');
      expect((gitService as any).getFileStatus(0, 0)).toBe('modified');
    });
  });

  describe('Integration with REGEX_PATTERNS', () => {
    it('should use REGEX_PATTERNS for ticket extraction', async () => {
      const testBranches = [
        'feature/PROJ-123',
        'bugfix/ABC-456-fix',
        'hotfix/XYZ-789',
        'invalid-branch'
      ];

      for (const branch of testBranches) {
        mockGit.revparse.mockResolvedValue(branch);
        const result = await gitService.getTicketFromBranch();
        
        const match = branch.match(REGEX_PATTERNS.JIRA_TICKET_FROM_BRANCH);
        const expected = match ? match[1] : null;
        
        expect(result).toBe(expected);
      }
    });
  });
});