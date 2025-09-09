import axios, { AxiosInstance } from 'axios';
import { JiraTicket } from './jira';
import { GitChanges, FileChange } from './git';
import { PullRequestTemplate } from './github';
import { getConfig } from '../utils/config';

export interface GenerateDescriptionOptions {
  jiraTicket: JiraTicket;
  gitChanges: GitChanges;
  template?: PullRequestTemplate;
  diffContent?: string;
  prTitle?: string;
}

export interface GeneratedPRContent {
  title: string;
  body: string;
  summary?: string;
}

export class CopilotService {
  private client: AxiosInstance;

  constructor() {
    // GitHub Copilot uses the same token as GitHub API
    const githubConfig = getConfig('github');
    const copilotConfig = getConfig('copilot');
    const token = githubConfig.token || copilotConfig.apiToken;

    if (!token) {
      throw new Error('Missing GitHub/Copilot token. Please run "create-pr setup" to configure your credentials.');
    }

    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'create-pr-cli'
      }
    });
  }

  async generatePRDescription(options: GenerateDescriptionOptions): Promise<GeneratedPRContent> {
    try {
      // First, generate a summary using Copilot
      const summary = await this.generateSummary(options);
      
      // Then generate the full PR description using the summary
      const prompt = this.buildPrompt(options, summary);
      const response = await this.callCopilotAPI(prompt);
      const result = this.parseCopilotResponse(response);
      
      return {
        ...result,
        summary
      };
    } catch (error) {
      console.warn('Copilot API unavailable, falling back to template-based generation');
      return this.generateFallbackDescription(options);
    }
  }

  private async generateSummary(options: GenerateDescriptionOptions): Promise<string> {
    const { jiraTicket, gitChanges, diffContent, template } = options;

    let summaryPrompt = `Generate a concise summary of this pull request based on the following information:\n\n`;

    // Jira ticket information
    summaryPrompt += `## Jira Ticket:\n`;
    summaryPrompt += `- Key: ${jiraTicket.key}\n`;
    summaryPrompt += `- Summary: ${jiraTicket.summary}\n`;
    summaryPrompt += `- Type: ${jiraTicket.issueType}\n`;
    if (jiraTicket.description) {
      summaryPrompt += `- Description: ${jiraTicket.description.substring(0, 500)}${jiraTicket.description.length > 500 ? '...' : ''}\n`;
    }

    // PR Template context if available
    if (template) {
      summaryPrompt += `\n## PR Template Context:\n`;
      summaryPrompt += `This PR should follow this template structure:\n`;
      summaryPrompt += `${template.content.substring(0, 800)}${template.content.length > 800 ? '...' : ''}\n`;
      summaryPrompt += `Please ensure the summary aligns with the template's intended structure and sections.\n`;
    }

    // File changes summary
    summaryPrompt += `\n## Changes Summary:\n`;
    summaryPrompt += `- Files changed: ${gitChanges.totalFiles}\n`;
    summaryPrompt += `- Key files: ${gitChanges.files.slice(0, 5).map(f => f.file).join(', ')}\n`;
    
    if (diffContent) {
      summaryPrompt += `\n## Code Changes Preview:\n`;
      summaryPrompt += `\`\`\`diff\n${diffContent.substring(0, 1000)}\n\`\`\`\n`;
    }

    summaryPrompt += `\nPlease provide a 1-2 sentence summary that captures the essence of what this PR accomplishes. Focus on the main feature or change being implemented and explain WHY these code changes are necessary to fulfill the specific requirements outlined in the JIRA ticket description. The summary should clearly connect the implementation to the business need described in the ticket and reference specific files or line numbers where key changes were made.`;
    
    if (template) {
      summaryPrompt += ` IMPORTANT: You MUST strictly follow the provided PR template structure and format. The summary should be formatted exactly as expected by the template, filling in the appropriate sections and placeholders. Do not deviate from the template format.`;
    }

    try {
      const response = await this.callCopilotAPI(summaryPrompt);
      const content = response.choices[0].message.content;
      return content.trim().replace(/["']/g, ''); // Remove quotes
    } catch (error) {
      // Fallback summary that considers template
      return this.generateFallbackSummary(jiraTicket, gitChanges);
    }
  }

  private buildPrompt(options: GenerateDescriptionOptions, summary?: string): string {
    const { jiraTicket, gitChanges, template, diffContent } = options;

    let prompt = `Generate a comprehensive pull request description based on the following information:\n\n`;

    // Jira ticket information with full description
    prompt += `## Jira Ticket Information:\n`;
    prompt += `- Ticket: ${jiraTicket.key}\n`;
    prompt += `- Title: ${jiraTicket.summary}\n`;
    prompt += `- Type: ${jiraTicket.issueType}\n`;
    prompt += `- Status: ${jiraTicket.status}\n`;
    if (jiraTicket.description) {
      prompt += `- Full Description: ${jiraTicket.description}\n`;
      prompt += `- IMPORTANT: Analyze how the code changes relate to and fulfill the requirements described in this JIRA ticket description.\n`;
    }
    prompt += `\n`;

    // Enhanced file changes summary with detailed analysis
    prompt += `## Detailed Changes Analysis:\n`;
    prompt += `- Total files changed: ${gitChanges.totalFiles}\n`;
    prompt += `- Total insertions: ${gitChanges.totalInsertions}\n`;
    prompt += `- Total deletions: ${gitChanges.totalDeletions}\n\n`;

    // Detailed file-by-file analysis
    prompt += `### File-by-File Changes:\n`;
    gitChanges.files.forEach(file => {
      prompt += `\n**${file.file}** (${file.status}):\n`;
      prompt += `- Insertions: +${file.insertions}, Deletions: -${file.deletions}\n`;
      
      if (file.lineNumbers) {
        if (file.lineNumbers.added.length > 0) {
          prompt += `- Added lines: ${file.lineNumbers.added.slice(0, 10).join(', ')}${file.lineNumbers.added.length > 10 ? '...' : ''}\n`;
        }
        if (file.lineNumbers.removed.length > 0) {
          prompt += `- Removed lines: ${file.lineNumbers.removed.slice(0, 10).join(', ')}${file.lineNumbers.removed.length > 10 ? '...' : ''}\n`;
        }
      }
      
      if (file.diffContent) {
        const truncatedDiff = file.diffContent.length > 1000 
          ? file.diffContent.substring(0, 1000) + '\n... (truncated for brevity)'
          : file.diffContent;
        prompt += `- Code changes:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n`;
      }
    });
    prompt += `\n`;

    // Commit messages
    if (gitChanges.commits.length > 0) {
      prompt += `## Commit Messages:\n`;
      gitChanges.commits.forEach(commit => {
        prompt += `- ${commit}\n`;
      });
      prompt += `\n`;
    }

    // Template structure
    if (template) {
      prompt += `## PR Template Structure:\n`;
      prompt += `Please follow this template structure:\n\n`;
      prompt += template.content;
      prompt += `\n\n`;
    }

    // Overall diff content for context
    if (diffContent) {
      prompt += `## Overall Code Changes Context:\n`;
      prompt += `\`\`\`diff\n${diffContent.substring(0, 3000)}${diffContent.length > 3000 ? '\n... (diff truncated for brevity)' : ''}\n\`\`\`\n\n`;
    }

    // Add summary context if available
    if (summary) {
      prompt += `## Generated Summary:\n`;
      prompt += `${summary}\n\n`;
    }

    prompt += `## Generation Requirements:\n`;
    prompt += `Please generate a pull request description that:\n`;
    prompt += `1. Creates a SHORT, concise title (max 60 characters) that captures the main change`;
    if (summary) {
      prompt += ` based on this summary: "${summary}"`;
    }
    prompt += `\n`;
    prompt += `2. Provides a detailed description that:\n`;
    prompt += `   - Starts with the summary as an overview\n`;
    prompt += `   - Explains HOW the code changes fulfill the JIRA ticket requirements\n`;
    prompt += `   - References specific files and line numbers where significant changes occurred\n`;
    prompt += `   - Describes the relevance of each major file change to the overall solution\n`;
    prompt += `   - Connects the implementation to the JIRA ticket description and requirements\n`;
    prompt += `3. Includes the Jira ticket reference with proper linking\n`;
    prompt += `4. Summarizes the technical approach and key implementation details\n`;
    prompt += `5. References specific line numbers and files for reviewers to focus on\n`;
    prompt += `6. Includes comprehensive testing instructions that relate to the JIRA requirements\n\n`;

    prompt += `IMPORTANT: \n`;
    prompt += `- Keep the TITLE SHORT and focused (under 60 characters)\n`;
    prompt += `- Use the summary to create a concise, actionable title\n`;
    prompt += `- The body should start with the summary as context\n\n`;

    prompt += `Format the response as JSON with "title" and "body" fields.`;

    return prompt;
  }

  private async callCopilotAPI(prompt: string): Promise<any> {
    // Note: This is a placeholder for the actual Copilot API call
    // The exact API endpoint may vary and might require different authentication
    // For now, we'll use a mock response structure
    
    try {
      // Attempt to use GitHub's chat completion API if available
      const response = await this.client.post('/copilot/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates professional pull request descriptions based on Jira tickets and code changes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });
      
      return response.data;
    } catch (error) {
      // If Copilot API is not available, throw error to fallback
      throw new Error('Copilot API not available');
    }
  }

  private parseCopilotResponse(response: any): GeneratedPRContent {
    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      return {
        title: parsed.title || 'Auto-generated PR title',
        body: parsed.body || 'Auto-generated PR description'
      };
    } catch {
      // If parsing fails, extract content manually
      const content = response.choices[0].message.content;
      
      return {
        title: this.extractTitle(content) || 'Auto-generated PR title',
        body: content
      };
    }
  }

  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/(?:title|Title):\s*(.+)/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  private generateFallbackDescription(options: GenerateDescriptionOptions): GeneratedPRContent {
    const { jiraTicket, gitChanges, template, prTitle } = options;
    const jiraConfig = getConfig('jira');

    // Generate a summary for fallback
    const summary = this.generateFallbackSummary(jiraTicket, gitChanges);

    // Generate shorter title based on summary
    const title = prTitle || this.generateShortTitle(jiraTicket);

    // Generate body based on template or default structure
    let body = '';
    
    // Start with summary
    body += `## Summary\n\n${summary}\n\n`;

    if (template) {
      // Try to fill in template placeholders
      body += template.content
        .replace(/\{\{ticket\}\}/gi, jiraTicket.key)
        .replace(/\{\{summary\}\}/gi, summary)
        .replace(/\{\{description\}\}/gi, jiraTicket.description || 'No description provided');
    } else {
      // Enhanced default template with detailed analysis
      body += `This PR implements changes for Jira ticket [${jiraTicket.key}](${jiraConfig.baseUrl}/browse/${jiraTicket.key}).\n\n`;
      body += `**Ticket Summary:** ${jiraTicket.summary}\n\n`;
      
      if (jiraTicket.description) {
        body += `**JIRA Description:** ${jiraTicket.description}\n\n`;
        body += `### How this PR addresses the JIRA requirements:\n`;
        body += `The code changes in this PR directly implement the functionality described in the JIRA ticket above.\n\n`;
      }

      body += `## Detailed Changes Analysis\n\n`;
      body += `- **Files changed:** ${gitChanges.totalFiles}\n`;
      body += `- **Insertions:** +${gitChanges.totalInsertions}\n`;
      body += `- **Deletions:** -${gitChanges.totalDeletions}\n\n`;

      body += `### File-by-File Changes:\n\n`;
      gitChanges.files.forEach(file => {
        body += `#### \`${file.file}\` (${file.status})\n`;
        body += `- **Changes:** +${file.insertions} insertions, -${file.deletions} deletions\n`;
        
        if (file.lineNumbers) {
          if (file.lineNumbers.added.length > 0) {
            const addedLines = file.lineNumbers.added.slice(0, 10);
            body += `- **Added lines:** ${addedLines.join(', ')}${file.lineNumbers.added.length > 10 ? ` (and ${file.lineNumbers.added.length - 10} more)` : ''}\n`;
          }
          if (file.lineNumbers.removed.length > 0) {
            const removedLines = file.lineNumbers.removed.slice(0, 10);
            body += `- **Removed lines:** ${removedLines.join(', ')}${file.lineNumbers.removed.length > 10 ? ` (and ${file.lineNumbers.removed.length - 10} more)` : ''}\n`;
          }
        }
        
        body += `- **Relevance:** Key implementation file for ${this.getFileRelevanceDescription(file, jiraTicket)}\n\n`;
      });

      if (gitChanges.commits.length > 0) {
        body += `## Commit History\n\n`;
        gitChanges.commits.forEach(commit => {
          body += `- ${commit}\n`;
        });
        body += `\n`;
      }

      body += `## Key Implementation Areas\n\n`;
      body += `Reviewers should focus on the following areas:\n\n`;
      
      const significantFiles = gitChanges.files.filter(f => f.insertions + f.deletions > 10);
      if (significantFiles.length > 0) {
        significantFiles.forEach(file => {
          body += `- **${file.file}**: Contains ${file.insertions + file.deletions} total changes`;
          if (file.lineNumbers?.added.length) {
            body += `, particularly around lines ${file.lineNumbers.added.slice(0, 3).join(', ')}`;
          }
          body += `\n`;
        });
      } else {
        gitChanges.files.forEach(file => {
          body += `- **${file.file}**: ${file.status} file with ${file.insertions + file.deletions} changes\n`;
        });
      }

      body += `\n## Testing\n\n`;
      body += `- [ ] Manual testing completed\n`;
      body += `- [ ] Unit tests added/updated\n`;
      body += `- [ ] Integration tests passing\n`;
      if (jiraTicket.description) {
        body += `- [ ] Verified implementation meets JIRA requirements\n`;
      }
      body += `\n`;

      body += `## Related\n\n`;
      body += `- Jira Ticket: [${jiraTicket.key}](${jiraConfig.baseUrl}/browse/${jiraTicket.key})\n`;
    }

    return { title, body, summary };
  }

  private getFileRelevanceDescription(file: FileChange, jiraTicket: JiraTicket): string {
    const fileName = file.file.toLowerCase();
    
    // Attempt to infer file relevance based on common patterns
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'testing the implemented functionality';
    } else if (fileName.includes('config') || fileName.includes('setting')) {
      return 'configuration changes related to the feature';
    } else if (fileName.includes('component') || fileName.includes('view')) {
      return 'UI/component implementation';
    } else if (fileName.includes('service') || fileName.includes('api')) {
      return 'business logic and API integration';
    } else if (fileName.includes('util') || fileName.includes('helper')) {
      return 'utility functions supporting the main feature';
    } else if (fileName.includes('model') || fileName.includes('schema')) {
      return 'data structure definitions';
    } else {
      return `implementing the ${jiraTicket.issueType.toLowerCase()} functionality`;
    }
  }

  private generateFallbackSummary(jiraTicket: JiraTicket, gitChanges: GitChanges): string {
    const action = this.getActionFromIssueType(jiraTicket.issueType);
    const mainFiles = gitChanges.files.filter(f => f.insertions + f.deletions > 5);
    const fileContext = mainFiles.length > 0 
      ? ` across ${mainFiles.length} key file${mainFiles.length > 1 ? 's' : ''}`
      : ` with ${gitChanges.totalFiles} file change${gitChanges.totalFiles > 1 ? 's' : ''}`;
    
    return `${action} ${jiraTicket.summary.toLowerCase()}${fileContext} to address ${jiraTicket.key}`;
  }

  private generateShortTitle(jiraTicket: JiraTicket): string {
    // Extract key action and subject from summary
    const action = this.getActionFromIssueType(jiraTicket.issueType);
    const subject = this.extractSubjectFromSummary(jiraTicket.summary);
    
    // Create short title (max 60 chars)
    const baseTitle = `${action} ${subject}`;
    if (baseTitle.length <= 50) {
      return `${baseTitle} (${jiraTicket.key})`;
    } else if (baseTitle.length <= 60) {
      return baseTitle;
    } else {
      // Truncate and add ticket
      const truncated = baseTitle.substring(0, 50);
      return `${truncated}... (${jiraTicket.key})`;
    }
  }

  private getActionFromIssueType(issueType: string): string {
    const type = issueType.toLowerCase();
    if (type.includes('bug') || type.includes('fix')) return 'Fix';
    if (type.includes('feature') || type.includes('story')) return 'Add';
    if (type.includes('improvement') || type.includes('enhance')) return 'Improve';
    if (type.includes('task')) return 'Update';
    if (type.includes('refactor')) return 'Refactor';
    return 'Implement';
  }

  private extractSubjectFromSummary(summary: string): string {
    // Remove common prefixes and clean up the summary
    const subject = summary
      .replace(/^(add|implement|create|fix|update|improve|refactor)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Capitalize first letter
    return subject.charAt(0).toUpperCase() + subject.slice(1);
  }
}