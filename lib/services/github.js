"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const rest_1 = require("@octokit/rest");
const simple_git_1 = require("simple-git");
const config_1 = require("../utils/config");
const constants_1 = require("../constants");
class GitHubService {
    constructor() {
        const githubConfig = (0, config_1.getConfig)('github');
        if (!githubConfig.token) {
            throw new Error('Missing GitHub token. Please run "create-pr setup" to configure your credentials.');
        }
        this.octokit = new rest_1.Octokit({
            auth: githubConfig.token,
            userAgent: constants_1.HEADERS.USER_AGENT
        });
        this.git = (0, simple_git_1.simpleGit)();
    }
    async getCurrentRepo() {
        const remotes = await this.git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === constants_1.CONFIG.DEFAULT_REMOTE);
        if (!originRemote?.refs?.push) {
            throw new Error('No origin remote found');
        }
        const url = originRemote.refs.push;
        const match = url.match(constants_1.REGEX_PATTERNS.GITHUB_URL);
        if (!match) {
            throw new Error('Unable to parse GitHub repository from remote URL');
        }
        return {
            owner: match[1],
            repo: match[2]
        };
    }
    async getPullRequestTemplates(repo) {
        const templates = [];
        const possiblePaths = constants_1.FILE_PATHS.PR_TEMPLATE_PATHS;
        for (const path of possiblePaths) {
            try {
                const response = await this.octokit.rest.repos.getContent({
                    owner: repo.owner,
                    repo: repo.repo,
                    path: path
                });
                if ('content' in response.data && response.data.type === 'file') {
                    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
                    templates.push({
                        name: path.includes('/') ? path.split('/').pop() : path,
                        content
                    });
                }
            }
            catch {
                // Template doesn't exist at this path, continue
            }
        }
        // Check for multiple templates in .github/PULL_REQUEST_TEMPLATE directory
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: repo.owner,
                repo: repo.repo,
                path: '.github/PULL_REQUEST_TEMPLATE'
            });
            if (Array.isArray(response.data)) {
                for (const file of response.data) {
                    if (file.type === 'file' && file.name.endsWith('.md')) {
                        const fileResponse = await this.octokit.rest.repos.getContent({
                            owner: repo.owner,
                            repo: repo.repo,
                            path: file.path
                        });
                        if ('content' in fileResponse.data && fileResponse.data.type === 'file') {
                            const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
                            templates.push({
                                name: file.name,
                                content
                            });
                        }
                    }
                }
            }
        }
        catch {
            // Directory doesn't exist, continue
        }
        return templates;
    }
    async findExistingPullRequest(repo, branch) {
        try {
            const response = await this.octokit.rest.pulls.list({
                owner: repo.owner,
                repo: repo.repo,
                head: `${repo.owner}:${branch}`,
                state: 'open'
            });
            return response.data.length > 0 ? response.data[0] : null;
        }
        catch (_error) {
            return null;
        }
    }
    async updatePullRequest(repo, pullNumber, pullRequest) {
        try {
            const response = await this.octokit.rest.pulls.update({
                owner: repo.owner,
                repo: repo.repo,
                pull_number: pullNumber,
                title: pullRequest.title,
                body: pullRequest.body,
                base: pullRequest.base,
                draft: pullRequest.draft
            });
            return response.data;
        }
        catch (error) {
            if (error.status === constants_1.HTTP_STATUS.UNAUTHORIZED) {
                throw new Error('Authentication failed. Please check your GitHub token.');
            }
            else if (error.status === constants_1.HTTP_STATUS.FORBIDDEN) {
                throw new Error('Access denied. Please check your GitHub token permissions.');
            }
            else if (error.status === constants_1.HTTP_STATUS.NOT_FOUND) {
                throw new Error('Pull request not found.');
            }
            throw new Error(`GitHub API error: ${error.message}`);
        }
    }
    async createOrUpdatePullRequest(repo, pullRequest) {
        // First, check if a pull request already exists for this branch
        const existingPR = await this.findExistingPullRequest(repo, pullRequest.head);
        if (existingPR) {
            // Update the existing pull request
            const updatedPR = await this.updatePullRequest(repo, existingPR.number, {
                title: pullRequest.title,
                body: pullRequest.body,
                base: pullRequest.base,
                draft: pullRequest.draft
            });
            return { data: updatedPR, isUpdate: true };
        }
        else {
            // Create a new pull request
            const newPR = await this.createPullRequest(repo, pullRequest);
            return { data: newPR, isUpdate: false };
        }
    }
    async createPullRequest(repo, pullRequest) {
        // Validate required fields before making the API call
        this.validatePullRequestData(pullRequest);
        const prData = {
            owner: repo.owner,
            repo: repo.repo,
            title: pullRequest.title,
            body: pullRequest.body,
            head: pullRequest.head,
            base: pullRequest.base,
            draft: pullRequest.draft
        };
        try {
            const response = await this.octokit.rest.pulls.create(prData);
            return response.data;
        }
        catch (error) {
            // Handle specific error cases
            if (error.status === 401) {
                throw new Error('Authentication failed. Please check your GitHub token.');
            }
            else if (error.status === 403) {
                throw new Error('Access denied. Please check your GitHub token permissions.');
            }
            else {
                throw new Error(`GitHub API error: ${error.message}`);
            }
        }
    }
    validatePullRequestData(pullRequest) {
        const errors = [];
        if (!pullRequest.title || pullRequest.title.trim() === '') {
            errors.push('Title is required and cannot be empty');
        }
        if (!pullRequest.head || pullRequest.head.trim() === '') {
            errors.push('Head branch is required and cannot be empty');
        }
        if (!pullRequest.base || pullRequest.base.trim() === '') {
            errors.push('Base branch is required and cannot be empty');
        }
        if (!pullRequest.body || pullRequest.body.trim() === '') {
            errors.push('Body is required and cannot be empty');
        }
        // Check for title length (GitHub has limits)
        if (pullRequest.title && pullRequest.title.length > constants_1.LIMITS.MAX_PR_TITLE_LENGTH) {
            errors.push(`Title is too long (maximum ${constants_1.LIMITS.MAX_PR_TITLE_LENGTH} characters)`);
        }
        if (pullRequest.head === pullRequest.base) {
            errors.push('Head branch cannot be the same as base branch');
        }
        if (errors.length > 0) {
            throw new Error(`Pull request validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
        }
    }
    async getCurrentBranch() {
        const branch = await this.git.branch();
        return branch.current;
    }
    async validateConnection() {
        try {
            await this.octokit.rest.users.getAuthenticated();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=github.js.map