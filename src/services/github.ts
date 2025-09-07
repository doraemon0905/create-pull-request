import axios, { AxiosInstance } from 'axios';
import { simpleGit, SimpleGit } from 'simple-git';

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
  private client: AxiosInstance;
  private git: SimpleGit;

  constructor() {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('Missing GitHub token. Please set GITHUB_TOKEN environment variable.');
    }

    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'create-pr-cli'
      }
    });

    this.git = simpleGit();
  }

  async getCurrentRepo(): Promise<GitHubRepo> {
    try {
      const remotes = await this.git.getRemotes(true);
      const originRemote = remotes.find(remote => remote.name === 'origin');
      
      if (!originRemote?.refs?.push) {
        throw new Error('No origin remote found');
      }

      const url = originRemote.refs.push;
      const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/);
      
      if (!match) {
        throw new Error('Unable to parse GitHub repository from remote URL');
      }

      return {
        owner: match[1],
        repo: match[2]
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPullRequestTemplates(repo: GitHubRepo): Promise<PullRequestTemplate[]> {
    const templates: PullRequestTemplate[] = [];
    const possiblePaths = [
      '.github/pull_request_template.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      'pull_request_template.md',
      'PULL_REQUEST_TEMPLATE.md',
      '.github/PULL_REQUEST_TEMPLATE/default.md'
    ];

    for (const path of possiblePaths) {
      try {
        const response = await this.client.get(`/repos/${repo.owner}/${repo.repo}/contents/${path}`);
        if (response.data.type === 'file') {
          const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
          templates.push({
            name: path.includes('/') ? path.split('/').pop()! : path,
            content
          });
        }
      } catch {
        // Template doesn't exist at this path, continue
      }
    }

    // Check for multiple templates in .github/PULL_REQUEST_TEMPLATE directory
    try {
      const response = await this.client.get(`/repos/${repo.owner}/${repo.repo}/contents/.github/PULL_REQUEST_TEMPLATE`);
      if (Array.isArray(response.data)) {
        for (const file of response.data) {
          if (file.type === 'file' && file.name.endsWith('.md')) {
            const fileResponse = await this.client.get(`/repos/${repo.owner}/${repo.repo}/contents/${file.path}`);
            const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
            templates.push({
              name: file.name,
              content
            });
          }
        }
      }
    } catch {
      // Directory doesn't exist, continue
    }

    return templates;
  }

  async createPullRequest(repo: GitHubRepo, pullRequest: PullRequest): Promise<any> {
    try {
      const response = await this.client.post(`/repos/${repo.owner}/${repo.repo}/pulls`, pullRequest);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 422) {
          throw new Error(`Failed to create pull request: ${error.response.data.message}`);
        } else if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please check your GitHub token.');
        } else if (error.response?.status === 403) {
          throw new Error('Access denied. Please check your GitHub token permissions.');
        }
        throw new Error(`GitHub API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
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

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.get('/user');
      return true;
    } catch {
      return false;
    }
  }
}