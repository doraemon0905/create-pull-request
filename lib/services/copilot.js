"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
class CopilotService {
    constructor() {
        // GitHub Copilot uses the same token as GitHub API
        const githubConfig = (0, config_1.getConfig)('github');
        const copilotConfig = (0, config_1.getConfig)('copilot');
        const token = githubConfig.token || copilotConfig.apiToken;
        if (!token) {
            throw new Error('Missing GitHub/Copilot token. Please run "create-pr setup" to configure your credentials.');
        }
        this.client = axios_1.default.create({
            baseURL: 'https://api.github.com',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'create-pr-cli'
            }
        });
    }
    async generatePRDescription(options) {
        const prompt = this.buildPrompt(options);
        try {
            // Use GitHub's Copilot API or fallback to a simple template-based generation
            const response = await this.callCopilotAPI(prompt);
            return this.parseCopilotResponse(response);
        }
        catch (error) {
            console.warn('Copilot API unavailable, falling back to template-based generation');
            return this.generateFallbackDescription(options);
        }
    }
    buildPrompt(options) {
        const { jiraTicket, gitChanges, template, diffContent, prTitle } = options;
        let prompt = `Generate a pull request description based on the following information:\n\n`;
        // Jira ticket information
        prompt += `## Jira Ticket Information:\n`;
        prompt += `- Ticket: ${jiraTicket.key}\n`;
        prompt += `- Title: ${jiraTicket.summary}\n`;
        prompt += `- Type: ${jiraTicket.issueType}\n`;
        prompt += `- Status: ${jiraTicket.status}\n`;
        if (jiraTicket.description) {
            prompt += `- Description: ${jiraTicket.description}\n`;
        }
        prompt += `\n`;
        // File changes summary
        prompt += `## Changes Summary:\n`;
        prompt += `- Total files changed: ${gitChanges.totalFiles}\n`;
        prompt += `- Total insertions: ${gitChanges.totalInsertions}\n`;
        prompt += `- Total deletions: ${gitChanges.totalDeletions}\n`;
        prompt += `- Files: ${gitChanges.files.map(f => `${f.file} (${f.status})`).join(', ')}\n`;
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
        // Diff content (truncated)
        if (diffContent) {
            prompt += `## Code Changes (Sample):\n`;
            prompt += `\`\`\`diff\n${diffContent.substring(0, 2000)}${diffContent.length > 2000 ? '...' : ''}\n\`\`\`\n\n`;
        }
        prompt += `Please generate:\n`;
        prompt += `1. A clear, concise pull request title (if not provided: "${prTitle || 'Auto-generated based on ticket'}")\n`;
        prompt += `2. A detailed pull request description following the template structure if provided\n`;
        prompt += `3. Include the Jira ticket reference\n`;
        prompt += `4. Summarize the changes made\n`;
        prompt += `5. Include any testing instructions if applicable\n\n`;
        prompt += `Format the response as JSON with "title" and "body" fields.`;
        return prompt;
    }
    async callCopilotAPI(prompt) {
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
        }
        catch (error) {
            // If Copilot API is not available, throw error to fallback
            throw new Error('Copilot API not available');
        }
    }
    parseCopilotResponse(response) {
        try {
            const content = response.choices[0].message.content;
            const parsed = JSON.parse(content);
            return {
                title: parsed.title || 'Auto-generated PR title',
                body: parsed.body || 'Auto-generated PR description'
            };
        }
        catch {
            // If parsing fails, extract content manually
            const content = response.choices[0].message.content;
            return {
                title: this.extractTitle(content) || 'Auto-generated PR title',
                body: content
            };
        }
    }
    extractTitle(content) {
        const titleMatch = content.match(/(?:title|Title):\s*(.+)/i);
        return titleMatch ? titleMatch[1].trim() : null;
    }
    generateFallbackDescription(options) {
        const { jiraTicket, gitChanges, template, prTitle } = options;
        const jiraConfig = (0, config_1.getConfig)('jira');
        // Generate title
        const title = prTitle || `${jiraTicket.key}: ${jiraTicket.summary}`;
        // Generate body based on template or default structure
        let body = '';
        if (template) {
            // Try to fill in template placeholders
            body = template.content
                .replace(/\{\{ticket\}\}/gi, jiraTicket.key)
                .replace(/\{\{summary\}\}/gi, jiraTicket.summary)
                .replace(/\{\{description\}\}/gi, jiraTicket.description);
        }
        else {
            // Default template
            body = `## Summary\n\n`;
            body += `This PR implements changes for Jira ticket [${jiraTicket.key}](${jiraConfig.baseUrl}/browse/${jiraTicket.key}).\n\n`;
            body += `**Ticket Summary:** ${jiraTicket.summary}\n\n`;
            if (jiraTicket.description) {
                body += `**Description:** ${jiraTicket.description}\n\n`;
            }
            body += `## Changes\n\n`;
            body += `- **Files changed:** ${gitChanges.totalFiles}\n`;
            body += `- **Insertions:** +${gitChanges.totalInsertions}\n`;
            body += `- **Deletions:** -${gitChanges.totalDeletions}\n\n`;
            body += `### Modified Files:\n`;
            gitChanges.files.forEach(file => {
                body += `- \`${file.file}\` (${file.status})\n`;
            });
            if (gitChanges.commits.length > 0) {
                body += `\n## Commits\n\n`;
                gitChanges.commits.forEach(commit => {
                    body += `- ${commit}\n`;
                });
            }
            body += `\n## Testing\n\n`;
            body += `- [ ] Manual testing completed\n`;
            body += `- [ ] Unit tests added/updated\n`;
            body += `- [ ] Integration tests passing\n\n`;
            body += `## Related\n\n`;
            body += `- Jira Ticket: [${jiraTicket.key}](${jiraConfig.baseUrl}/browse/${jiraTicket.key})\n`;
        }
        return { title, body };
    }
}
exports.CopilotService = CopilotService;
//# sourceMappingURL=copilot.js.map