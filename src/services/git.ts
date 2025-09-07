import { simpleGit, SimpleGit } from 'simple-git';

export interface FileChange {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;
  deletions: number;
  changes: number;
}

export interface GitChanges {
  files: FileChange[];
  totalInsertions: number;
  totalDeletions: number;
  totalFiles: number;
  commits: string[];
}

export class GitService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async getChanges(baseBranch: string = 'main'): Promise<GitChanges> {
    try {
      // Get current branch
      const currentBranch = await this.git.branch();
      const current = currentBranch.current;

      if (current === baseBranch) {
        throw new Error(`Cannot compare branch with itself. Current branch is '${baseBranch}'. Please checkout a feature branch.`);
      }

      // Get diff stats between base and current branch
      const diffSummary = await this.git.diffSummary([`${baseBranch}...HEAD`]);
      
      // Get commit messages
      const log = await this.git.log({ from: baseBranch, to: 'HEAD' });
      const commits = log.all.map(commit => commit.message);

      // Process file changes
      const files: FileChange[] = diffSummary.files.map(file => ({
        file: file.file,
        status: this.mapGitStatus(file),
        insertions: 'insertions' in file ? file.insertions : 0,
        deletions: 'deletions' in file ? file.deletions : 0,
        changes: 'changes' in file ? file.changes : 0
      }));

      return {
        files,
        totalInsertions: diffSummary.insertions,
        totalDeletions: diffSummary.deletions,
        totalFiles: files.length,
        commits
      };
    } catch (error) {
      throw new Error(`Failed to get git changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDiffContent(baseBranch: string = 'main', maxLines: number = 1000): Promise<string> {
    try {
      const diff = await this.git.diff([`${baseBranch}...HEAD`]);
      
      // Limit diff content to prevent overwhelming the AI
      const lines = diff.split('\n');
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') + '\n\n... (diff truncated for brevity)';
      }
      
      return diff;
    } catch (error) {
      throw new Error(`Failed to get diff content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.branch();
      return branch.current;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateRepository(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not in a git repository');
      }
    } catch (error) {
      throw new Error(`Git repository validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.files.length > 0;
    } catch (error) {
      throw new Error(`Failed to check git status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branch(['-a']);
      return branches.all.some(branch => 
        branch === branchName || 
        branch === `remotes/origin/${branchName}` ||
        branch.endsWith(`/${branchName}`)
      );
    } catch {
      return false;
    }
  }

  private mapGitStatus(file: any): 'added' | 'modified' | 'deleted' | 'renamed' {
    // Handle binary files
    if ('binary' in file && file.binary) return 'modified';
    
    // Check for renames first
    if (file.file && file.file.includes(' => ')) return 'renamed';
    
    // Check insertions/deletions if they exist
    if ('insertions' in file && 'deletions' in file) {
      if (file.insertions > 0 && file.deletions === 0) return 'added';
      if (file.insertions === 0 && file.deletions > 0) return 'deleted';
    }
    
    return 'modified';
  }
}