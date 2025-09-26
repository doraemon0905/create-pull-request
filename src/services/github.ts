import { Octokit } from '@octokit/rest';
import { simpleGit, SimpleGit } from 'simple-git';
import { getConfig } from '../utils/config.js';
import { FILE_PATHS, REGEX_PATTERNS, HEADERS, HTTP_STATUS, LIMITS, CONFIG } from '../constants/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface PullRequest {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface PullRequestTemplate {
  name: string;
  content: string;
}

export class GitHubService {
  private octokit: Octokit;
  private git: SimpleGit;

  constructor() {
    const githubConfig = getConfig('github');

    if (!githubConfig.token) {
      throw new Error('Missing GitHub token. Please run "create-pr setup" to configure your credentials.');
    }

    this.octokit = new Octokit({
      auth: githubConfig.token,
      userAgent: HEADERS.USER_AGENT
    });

    this.git = simpleGit();
  }

  async getCurrentRepo(): Promise<GitHubRepo> {
    const remotes = await this.git.getRemotes(true);
    const originRemote = remotes.find(remote => remote.name === CONFIG.DEFAULT_REMOTE);

    if (!originRemote?.refs?.push) {
      throw new Error('No origin remote found');
    }

    const url = originRemote.refs.push;
    const match = url.match(REGEX_PATTERNS.GITHUB_URL);

    if (!match) {
      throw new Error('Unable to parse GitHub repository from remote URL');
    }

    return {
      owner: match[1],
      repo: match[2]
    };
  }

  async getPullRequestTemplates(): Promise<PullRequestTemplate[]> {
    const templates: PullRequestTemplate[] = [];

    // Get templates from predefined paths
    const predefinedTemplates = this.loadPredefinedTemplates();
    templates.push(...predefinedTemplates);

    // Get templates from directory
    const directoryTemplates = this.loadDirectoryTemplates();
    templates.push(...directoryTemplates);

    return templates;
  }

  private loadPredefinedTemplates(): PullRequestTemplate[] {
    const templates: PullRequestTemplate[] = [];
    const possiblePaths = FILE_PATHS.PR_TEMPLATE_PATHS;

    for (const templatePath of possiblePaths) {
      const template = this.tryLoadTemplate(templatePath);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  private loadDirectoryTemplates(): PullRequestTemplate[] {
    const templates: PullRequestTemplate[] = [];
    const templateDir = '.github/PULL_REQUEST_TEMPLATE';

    try {
      if (!fs.existsSync(templateDir)) {
        return templates;
      }

      const files = fs.readdirSync(templateDir);
      const markdownFiles = files.filter(file => file.endsWith('.md'));

      for (const file of markdownFiles) {
        const filePath = path.join(templateDir, file);
        const template = this.tryLoadTemplate(filePath, file);
        if (template) {
          templates.push(template);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read, continue
    }

    return templates;
  }

  private tryLoadTemplate(templatePath: string, customName?: string): PullRequestTemplate | null {
    try {
      if (!fs.existsSync(templatePath)) {
        return null;
      }

      const content = fs.readFileSync(templatePath, 'utf-8');
      const name = customName || this.extractTemplateNameFromPath(templatePath);

      return { name, content };
    } catch {
      return null;
    }
  }

  private extractTemplateNameFromPath(templatePath: string): string {
    return templatePath.includes('/') ? templatePath.split('/').pop()! : templatePath;
  }

  async findExistingPullRequest(repo: GitHubRepo, branch: string): Promise<any | null> {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        head: `${repo.owner}:${branch}`,
        state: 'open'
      });

      return response.data.length > 0 ? response.data[0] : null;
    } catch (_error) {
      return null;
    }
  }

  async updatePullRequest(repo: GitHubRepo, pullNumber: number, pullRequest: Partial<PullRequest>): Promise<any> {
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
    } catch (error: any) {
      if (error.status === HTTP_STATUS.UNAUTHORIZED) {
        throw new Error('Authentication failed. Please check your GitHub token.');
      } else if (error.status === HTTP_STATUS.FORBIDDEN) {
        throw new Error('Access denied. Please check your GitHub token permissions.');
      } else if (error.status === HTTP_STATUS.NOT_FOUND) {
        throw new Error('Pull request not found.');
      }
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  async createOrUpdatePullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<{ data: any; isUpdate: boolean }> {
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
    } else {
      // Create a new pull request
      const newPR = await this.createPullRequest(repo, pullRequest);
      return { data: newPR, isUpdate: false };
    }
  }

  async createPullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<any> {
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
    } catch (error: any) {
      // Handle specific error cases
      if (error.status === 401) {
        throw new Error('Authentication failed. Please check your GitHub token.');
      } else if (error.status === 403) {
        throw new Error('Access denied. Please check your GitHub token permissions.');
      } else {
        throw new Error(`GitHub API error: ${error.message}`);
      }
    }
  }

  private validatePullRequestData(pullRequest: PullRequest): void {
    const errors: string[] = [];

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
    if (pullRequest.title && pullRequest.title.length > LIMITS.MAX_PR_TITLE_LENGTH) {
      errors.push(`Title is too long (maximum ${LIMITS.MAX_PR_TITLE_LENGTH} characters)`);
    }

    if (pullRequest.head === pullRequest.base) {
      errors.push('Head branch cannot be the same as base branch');
    }

    if (errors.length > 0) {
      throw new Error(`Pull request validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.branch();
    return branch.current;
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.octokit.rest.users.getAuthenticated();
      return true;
    } catch {
      return false;
    }
  }
}
