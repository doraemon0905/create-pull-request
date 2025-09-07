"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const simple_git_1 = require("simple-git");
class GitService {
    constructor() {
        this.git = (0, simple_git_1.simpleGit)();
    }
    async getChanges(baseBranch = 'main') {
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
            const files = diffSummary.files.map(file => ({
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
        }
        catch (error) {
            throw new Error(`Failed to get git changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getDiffContent(baseBranch = 'main', maxLines = 1000) {
        try {
            const diff = await this.git.diff([`${baseBranch}...HEAD`]);
            // Limit diff content to prevent overwhelming the AI
            const lines = diff.split('\n');
            if (lines.length > maxLines) {
                return lines.slice(0, maxLines).join('\n') + '\n\n... (diff truncated for brevity)';
            }
            return diff;
        }
        catch (error) {
            throw new Error(`Failed to get diff content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getCurrentBranch() {
        try {
            const branch = await this.git.branch();
            return branch.current;
        }
        catch (error) {
            throw new Error(`Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async validateRepository() {
        try {
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                throw new Error('Not in a git repository');
            }
        }
        catch (error) {
            throw new Error(`Git repository validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async hasUncommittedChanges() {
        try {
            const status = await this.git.status();
            return status.files.length > 0;
        }
        catch (error) {
            throw new Error(`Failed to check git status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async branchExists(branchName) {
        try {
            const branches = await this.git.branch(['-a']);
            return branches.all.some(branch => branch === branchName ||
                branch === `remotes/origin/${branchName}` ||
                branch.endsWith(`/${branchName}`));
        }
        catch {
            return false;
        }
    }
    mapGitStatus(file) {
        // Handle binary files
        if ('binary' in file && file.binary)
            return 'modified';
        // Check for renames first
        if (file.file && file.file.includes(' => '))
            return 'renamed';
        // Check insertions/deletions if they exist
        if ('insertions' in file && 'deletions' in file) {
            if (file.insertions > 0 && file.deletions === 0)
                return 'added';
            if (file.insertions === 0 && file.deletions > 0)
                return 'deleted';
        }
        return 'modified';
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git.js.map