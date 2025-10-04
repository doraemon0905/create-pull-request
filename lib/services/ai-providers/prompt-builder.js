export class PromptBuilder {
    buildPrompt(options, summary) {
        const { jiraTicket, gitChanges, template, diffContent, prTitle, repoInfo } = options;
        let prompt = `You are an expert software engineer helping to create a comprehensive pull request description. `;
        prompt += `Please analyze the following information and generate a well-structured pull request description.\n\n`;
        // Jira ticket information
        prompt += `## Jira Ticket Information:\n`;
        prompt += `- **Ticket**: ${jiraTicket.key}\n`;
        prompt += `- **Summary**: ${jiraTicket.summary}\n`;
        prompt += `- **Type**: ${jiraTicket.issueType}\n`;
        prompt += `- **Status**: ${jiraTicket.status}\n`;
        prompt += `- **Assignee**: ${jiraTicket.assignee || 'Unassigned'}\n`;
        prompt += `- **Reporter**: ${jiraTicket.reporter}\n`;
        if (jiraTicket.description) {
            prompt += `- **Description**: ${jiraTicket.description}\n`;
        }
        if (jiraTicket.parentTicket) {
            prompt += `- **Parent Ticket**: ${jiraTicket.parentTicket.key} - ${jiraTicket.parentTicket.summary}\n`;
        }
        // Confluence pages context
        if (jiraTicket.confluencePages && jiraTicket.confluencePages.length > 0) {
            prompt += `\n## Related Documentation:\n`;
            jiraTicket.confluencePages.forEach(page => {
                prompt += `- **${page.title}**: ${page.content.substring(0, 200)}...\n`;
                prompt += `  Source: ${page.url}\n`;
            });
        }
        // Git changes information
        prompt += `\n## Code Changes:\n`;
        prompt += `- **Total Files Changed**: ${gitChanges.totalFiles}\n`;
        prompt += `- **Total Insertions**: ${gitChanges.totalInsertions}\n`;
        prompt += `- **Total Deletions**: ${gitChanges.totalDeletions}\n`;
        if (gitChanges.commits && gitChanges.commits.length > 0) {
            prompt += `- **Commits**: ${gitChanges.commits.join(', ')}\n`;
        }
        // File details
        prompt += `\n## Files Modified:\n`;
        gitChanges.files.forEach(file => {
            prompt += `- **${file.file}** (${file.status})\n`;
            prompt += `  - Changes: ${file.changes} lines\n`;
            prompt += `  - Insertions: ${file.insertions}\n`;
            prompt += `  - Deletions: ${file.deletions}\n`;
            if (repoInfo && file.lineNumbers) {
                const fileUrl = this.generateFileUrl(repoInfo, file.file);
                prompt += `  - File: ${fileUrl}\n`;
                if (file.lineNumbers.added.length > 0) {
                    const addedLinks = this.generateLineLinks(repoInfo, file.file, file.lineNumbers.added);
                    prompt += `  - Added lines: ${addedLinks}\n`;
                }
                if (file.lineNumbers.removed.length > 0) {
                    const removedLinks = this.generateLineLinks(repoInfo, file.file, file.lineNumbers.removed);
                    prompt += `  - Removed lines: ${removedLinks}\n`;
                }
            }
            // Add file relevance description
            const relevance = this.getFileRelevanceDescription(file, jiraTicket);
            if (relevance) {
                prompt += `  - Relevance: ${relevance}\n`;
            }
        });
        // Diff content (if available and not too large)
        if (diffContent && diffContent.length < 10000) {
            prompt += `\n## Code Diff:\n`;
            prompt += `\`\`\`diff\n${diffContent}\n\`\`\`\n`;
        }
        else if (diffContent) {
            prompt += `\n## Code Diff Summary:\n`;
            const diffSummary = this.extractDiffSummary(diffContent);
            prompt += diffSummary.join('\n') + '\n';
        }
        // Template context
        if (template) {
            prompt += `\n## Template Context:\n`;
            prompt += `Use this template as a guide for the structure:\n`;
            prompt += `\`\`\`\n${template.content}\n\`\`\`\n`;
        }
        // Summary context (if provided)
        if (summary) {
            prompt += `\n## AI-Generated Summary:\n`;
            prompt += `${summary}\n`;
        }
        // Instructions
        prompt += `\n## Instructions:\n`;
        prompt += `Please generate a comprehensive pull request description that includes:\n`;
        prompt += `1. A clear, descriptive title\n`;
        prompt += `2. A detailed description explaining what changes were made and why\n`;
        prompt += `3. Any relevant context from the Jira ticket and documentation\n`;
        prompt += `4. Testing considerations\n`;
        prompt += `5. Any breaking changes or migration notes\n\n`;
        prompt += `Format your response as JSON with the following structure:\n`;
        prompt += `\`\`\`json\n`;
        prompt += `{\n`;
        prompt += `  "title": "Clear and descriptive PR title",\n`;
        prompt += `  "description": "Detailed description of changes",\n`;
        prompt += `  "summary": "Brief summary of the changes"\n`;
        prompt += `}\n`;
        prompt += `\`\`\`\n`;
        return prompt;
    }
    generateFileUrl(repoInfo, filePath) {
        return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${filePath}`;
    }
    generateLineUrl(repoInfo, filePath, lineNumber) {
        return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${filePath}#L${lineNumber}`;
    }
    generateLineLinks(repoInfo, filePath, lineNumbers) {
        return lineNumbers
            .slice(0, 10) // Limit to first 10 line numbers to avoid overly long URLs
            .map(lineNumber => this.generateLineUrl(repoInfo, filePath, lineNumber))
            .join(', ');
    }
    getFileRelevanceDescription(file, jiraTicket) {
        const fileName = file.file.toLowerCase();
        const ticketSummary = jiraTicket.summary.toLowerCase();
        const ticketDescription = jiraTicket.description?.toLowerCase() || '';
        // Check for keyword matches
        const keywords = [
            'test', 'spec', 'specification',
            'config', 'configuration',
            'readme', 'documentation', 'docs',
            'migration', 'migrate',
            'api', 'endpoint', 'route',
            'component', 'module', 'service',
            'database', 'db', 'model', 'schema',
            'ui', 'frontend', 'backend',
            'security', 'auth', 'authentication',
            'performance', 'optimization', 'cache'
        ];
        for (const keyword of keywords) {
            if (fileName.includes(keyword) || ticketSummary.includes(keyword) || ticketDescription.includes(keyword)) {
                return `Contains ${keyword}-related changes`;
            }
        }
        // Check for test files
        if (fileName.includes('test') || fileName.includes('spec')) {
            return 'Test file modifications';
        }
        // Check for configuration files
        if (fileName.includes('config') || fileName.includes('.json') || fileName.includes('.yaml') || fileName.includes('.yml')) {
            return 'Configuration file changes';
        }
        return '';
    }
    extractDiffSummary(diffContent) {
        const lines = diffContent.split('\n');
        const summary = [];
        let currentFile = '';
        let addedLines = 0;
        let removedLines = 0;
        for (const line of lines) {
            if (line.startsWith('diff --git')) {
                if (currentFile && (addedLines > 0 || removedLines > 0)) {
                    summary.push(`${currentFile}: +${addedLines} -${removedLines}`);
                }
                currentFile = line.split(' ')[3] || 'unknown';
                addedLines = 0;
                removedLines = 0;
            }
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                addedLines++;
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                removedLines++;
            }
        }
        if (currentFile && (addedLines > 0 || removedLines > 0)) {
            summary.push(`${currentFile}: +${addedLines} -${removedLines}`);
        }
        return summary.slice(0, 20); // Limit to first 20 files
    }
}
//# sourceMappingURL=prompt-builder.js.map