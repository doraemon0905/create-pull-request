import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { JiraTicket } from './jira';
import { GitChanges, FileChange } from './git';
import { PullRequestTemplate } from './github';
import { getConfig } from '../utils/config';
import * as inquirer from 'inquirer';
import { API_URLS, LIMITS, HEADERS, DEFAULT_MODELS } from '../constants';

export interface GenerateDescriptionOptions {
  jiraTicket: JiraTicket;
  gitChanges: GitChanges;
  template?: PullRequestTemplate;
  diffContent?: string;
  prTitle?: string;
  repoInfo?: {
    owner: string;
    repo: string;
    currentBranch: string;
  };
}

export interface GeneratedPRContent {
  title: string;
  body: string;
  summary?: string;
}

export type AIProvider = 'chatgpt' | 'gemini' | 'copilot';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export class CopilotService {
  private clients: Map<AIProvider, AxiosInstance> = new Map();
  private selectedProvider: AIProvider | null = null;

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    const githubConfig = getConfig('github');
    const copilotConfig = getConfig('copilot');
    
    // Try to get AI providers config
    let aiProvidersConfig;
    try {
      aiProvidersConfig = getConfig('aiProviders');
    } catch {
      // Fallback to environment variables if config doesn't exist
      aiProvidersConfig = null;
    }
    
    // ChatGPT client
    const chatGptKey = aiProvidersConfig?.openai?.apiKey || 
                      process.env.OPENAI_API_KEY || 
                      process.env.CHATGPT_API_KEY;
    if (chatGptKey) {
      this.clients.set('chatgpt', axios.create({
        baseURL: API_URLS.OPENAI_BASE_URL,
        headers: {
          'Authorization': `Bearer ${chatGptKey}`,
          'Content-Type': HEADERS.JSON_CONTENT_TYPE
        },
        timeout: LIMITS.API_TIMEOUT_MS
      }));
    }

    // Gemini client
    const geminiKey = aiProvidersConfig?.gemini?.apiKey || 
                     process.env.GEMINI_API_KEY || 
                     process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.clients.set('gemini', axios.create({
        baseURL: API_URLS.GEMINI_BASE_URL,
        timeout: LIMITS.API_TIMEOUT_MS
      }));
    }

    // Copilot client (fallback)
    const copilotToken = aiProvidersConfig?.copilot?.apiToken ||
                        copilotConfig.apiToken ||
                        githubConfig.token;
    if (copilotToken) {
      this.clients.set('copilot', axios.create({
        baseURL: API_URLS.COPILOT_BASE_URL,
        headers: {
          'Authorization': `Bearer ${copilotToken}`,
          'Content-Type': HEADERS.JSON_CONTENT_TYPE,
          'User-Agent': HEADERS.USER_AGENT
        },
        timeout: LIMITS.API_TIMEOUT_MS
      }));
    }
  }

  async generatePRDescription(options: GenerateDescriptionOptions): Promise<GeneratedPRContent> {
    try {
      // Select AI provider if not already selected
      if (!this.selectedProvider) {
        this.selectedProvider = await this.selectAIProvider();
      }

      // First, generate a summary using selected AI provider
      const summary = await this.generateSummary(options);
      
      // Then generate the full PR description using the summary
      const prompt = this.buildPrompt(options, summary);
      const response = await this.callAIAPI(prompt, this.selectedProvider);
      const result = this.parseAIResponse(response, this.selectedProvider);
      
      return {
        ...result,
        summary
      };
    } catch (error) {
      console.error(error);
      console.warn(`${this.selectedProvider || 'AI'} API unavailable, trying fallback providers...`);
      return this.tryFallbackProviders(options);
    }
  }

  private async selectAIProvider(): Promise<AIProvider> {
    const availableProviders = Array.from(this.clients.keys());
    
    if (availableProviders.length === 0) {
      throw new Error('No AI providers configured. Please set OPENAI_API_KEY, GEMINI_API_KEY, or configure GitHub Copilot.');
    }

    // If only one provider available, use it
    if (availableProviders.length === 1) {
      const provider = availableProviders[0];
      console.log(`Using ${provider.toUpperCase()} as AI provider`);
      return provider;
    }

    // Prioritize ChatGPT, then Gemini, then Copilot
    const preferredOrder: AIProvider[] = ['chatgpt', 'gemini', 'copilot'];
    for (const preferred of preferredOrder) {
      if (availableProviders.includes(preferred)) {
        const provider = preferred;
        console.log(`Using ${provider.toUpperCase()} as primary AI provider`);
        return provider;
      }
    }

    // Prompt user to select if multiple providers available
    const { selectedProvider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedProvider',
        message: 'Multiple AI providers available. Please select one:',
        choices: availableProviders.map(provider => ({
          name: provider.toUpperCase(),
          value: provider
        })),
        default: availableProviders.includes('chatgpt') ? 'chatgpt' : availableProviders[0]
      }
    ]);

    return selectedProvider;
  }

  private async tryFallbackProviders(options: GenerateDescriptionOptions): Promise<GeneratedPRContent> {
    const providers: AIProvider[] = ['chatgpt', 'gemini', 'copilot'];
    const availableProviders = providers.filter(p => this.clients.has(p));
    
    // Remove the already tried provider
    const remainingProviders = availableProviders.filter(p => p !== this.selectedProvider);
    
    for (const provider of remainingProviders) {
      try {
        console.log(`Trying fallback provider: ${provider.toUpperCase()}`);
        const summary = await this.generateSummary(options, provider);
        const prompt = this.buildPrompt(options, summary);
        const response = await this.callAIAPI(prompt, provider);
        const result = this.parseAIResponse(response, provider);
        
        console.log(`Successfully used fallback provider: ${provider.toUpperCase()}`);
        this.selectedProvider = provider;
        return { ...result, summary };
      } catch (error) {
        console.warn(`${provider.toUpperCase()} also failed:`, error);
        continue;
      }
    }

    console.warn('All AI providers failed, falling back to template-based generation');
    return this.generateFallbackDescription(options);
  }

  private async generateSummary(options: GenerateDescriptionOptions, provider?: AIProvider): Promise<string> {
    const targetProvider = provider || this.selectedProvider || 'chatgpt';
    const { jiraTicket, gitChanges, diffContent, template, repoInfo } = options;

    let summaryPrompt = `Generate a detailed summary of this pull request with file links and explanations based on the following information:\n\n`;

    // Jira ticket information
    summaryPrompt += `## Jira Ticket:\n`;
    summaryPrompt += `- Key: ${jiraTicket.key}\n`;
    summaryPrompt += `- Summary: ${jiraTicket.summary}\n`;
    summaryPrompt += `- Type: ${jiraTicket.issueType}\n`;
    if (jiraTicket.description) {
      summaryPrompt += `- Description: ${jiraTicket.description.substring(0, LIMITS.MAX_DESCRIPTION_PREVIEW_LENGTH)}${jiraTicket.description.length > LIMITS.MAX_DESCRIPTION_PREVIEW_LENGTH ? '...' : ''}\n`;
    }

    // PR Template context if available
    if (template) {
      summaryPrompt += `\n## PR Template Context:\n`;
      summaryPrompt += `This PR should follow this template structure:\n`;
      summaryPrompt += `${template.content.substring(0, LIMITS.MAX_TEMPLATE_PREVIEW_LENGTH)}${template.content.length > LIMITS.MAX_TEMPLATE_PREVIEW_LENGTH ? '...' : ''}\n`;
      summaryPrompt += `Please ensure the summary aligns with the template's intended structure and sections.\n`;
    }

    // Detailed file changes with line information
    summaryPrompt += `\n## Detailed File Changes:\n`;
    summaryPrompt += `- Total files changed: ${gitChanges.totalFiles}\n`;
    summaryPrompt += `- Total insertions: +${gitChanges.totalInsertions}\n`;
    summaryPrompt += `- Total deletions: -${gitChanges.totalDeletions}\n\n`;

    // File-by-file analysis with line numbers and GitHub links
    summaryPrompt += `### Specific File Changes:\n`;
    gitChanges.files.forEach(file => {
      summaryPrompt += `\n**${file.file}** (${file.status}):\n`;
      summaryPrompt += `- Changes: +${file.insertions} insertions, -${file.deletions} deletions\n`;
      
      // Add GitHub file URL if repository info is available
      if (repoInfo) {
        const fileUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${file.file}`;
        summaryPrompt += `- GitHub URL: ${fileUrl}\n`;
        
        // Add specific line URLs for key changes
        if (file.lineNumbers?.added.length && file.lineNumbers.added.length > 0) {
          const keyLines = file.lineNumbers.added.slice(0, 3);
          if (keyLines.length === 1) {
            summaryPrompt += `- Key change at line: ${fileUrl}#L${keyLines[0]}\n`;
          } else if (keyLines.length > 1) {
            summaryPrompt += `- Key changes at lines: ${keyLines.map(line => `${fileUrl}#L${line}`).join(', ')}\n`;
          }
        }
      }
      
      if (file.lineNumbers) {
        if (file.lineNumbers.added.length > 0) {
          summaryPrompt += `- Lines added: ${file.lineNumbers.added.slice(0, 10).join(', ')}${file.lineNumbers.added.length > 10 ? '...' : ''}\n`;
        }
        if (file.lineNumbers.removed.length > 0) {
          summaryPrompt += `- Lines removed: ${file.lineNumbers.removed.slice(0, 10).join(', ')}${file.lineNumbers.removed.length > 10 ? '...' : ''}\n`;
        }
      }
      
      if (file.diffContent) {
        summaryPrompt += `- Code preview:\n\`\`\`diff\n${file.diffContent}\n\`\`\`\n`;
      }
    });
    
    if (diffContent) {
      summaryPrompt += `\n## Overall Code Changes:\n`;
      summaryPrompt += `\`\`\`diff\n${diffContent}\n\`\`\`\n`;
    }

    summaryPrompt += `\n## Summary Requirements:\n`;
    summaryPrompt += `Please provide a HIGHLY DETAILED and comprehensive summary that:\n`;
    summaryPrompt += `1. ALWAYS starts with relevant ticket URLs at the very top if available:\n`;
    summaryPrompt += `   - Jira ticket URL in format: [${jiraTicket.key}](JIRA_BASE_URL/browse/${jiraTicket.key})\n`;
    summaryPrompt += `   - Any Sentry error URLs mentioned in the ticket description\n`;
    summaryPrompt += `   - Other relevant tracking URLs\n`;
    summaryPrompt += `2. Provides a detailed overview (4-6 sentences) explaining:\n`;
    summaryPrompt += `   - What feature/change is being implemented\n`;
    summaryPrompt += `   - How it addresses the JIRA ticket requirements\n`;
    summaryPrompt += `   - The technical approach taken\n`;
    summaryPrompt += `   - The impact on the system/users\n`;
    summaryPrompt += `3. For EACH modified file, provides extensive detail including:\n`;
    summaryPrompt += `   - File header as clickable link: [src/filename.ext](GitHub_URL)\n`;
    summaryPrompt += `   - Detailed explanation of what changed (3-4 sentences minimum)\n`;
    summaryPrompt += `   - Specific functions/methods/classes that were modified\n`;
    summaryPrompt += `   - Why each change was necessary for the JIRA requirements\n`;
    summaryPrompt += `   - MANDATORY: Multiple specific line links for ALL significant changes\n`;
    if (repoInfo) {
      summaryPrompt += `   - MUST include all GitHub file URLs provided above for navigation\n`;
      summaryPrompt += `   - REQUIRED: Link to EVERY significant line change using GitHub line URLs\n`;
      summaryPrompt += `   - Format file links as: [src/file.ts](https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/src/file.ts)\n`;
      summaryPrompt += `   - Format line links as: [Line 123](https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/src/file.ts#L123)\n`;
      summaryPrompt += `   - Include 4-6 specific line links per modified file covering ALL major changes\n`;
      summaryPrompt += `   - Group line links by functionality (e.g., "Authentication logic: [Line 45](url), [Line 67](url)")\n`;
    }
    summaryPrompt += `4. Technical implementation details including:\n`;
    summaryPrompt += `   - New functions/methods added and their purpose\n`;
    summaryPrompt += `   - Modified existing functions and how they changed\n`;
    summaryPrompt += `   - Integration points with other parts of the system\n`;
    summaryPrompt += `   - Error handling and edge cases addressed\n`;
    summaryPrompt += `5. Business value and impact:\n`;
    summaryPrompt += `   - How this implementation fulfills the JIRA ticket requirements\n`;
    summaryPrompt += `   - User experience improvements or changes\n`;
    summaryPrompt += `   - System performance or security implications\n`;
    summaryPrompt += `6. Review focus areas with specific line references:\n`;
    summaryPrompt += `   - Critical changes that require careful review\n`;
    summaryPrompt += `   - Complex logic with line-by-line explanations\n`;
    summaryPrompt += `   - Integration points that could affect other features\n\n`;
    
    summaryPrompt += `Format the response as a COMPREHENSIVE structured summary with these sections:\n`;
    summaryPrompt += `- Ticket URLs (Jira, Sentry, etc.) at the very top\n`;
    summaryPrompt += `- Detailed Overview (4-6 sentences explaining the change and impact)\n`;
    summaryPrompt += `- File Changes (extensive file-by-file analysis with 4-6 line links each)\n`;
    summaryPrompt += `- Technical Implementation Details (methods, functions, integration points)\n`;
    summaryPrompt += `- Business Value and Impact (how it fulfills JIRA requirements)\n`;
    summaryPrompt += `- Review Focus Areas (critical changes with specific line references)\n\n`;
    summaryPrompt += `IMPORTANT: Do NOT include any checklists, checkboxes, or "- [ ]" items in the summary. Use bullet points and descriptive text only.\n`;
    if (template) {
      summaryPrompt += `TEMPLATE CHECKBOX RULE: If the PR template contains checkboxes, preserve them EXACTLY as they appear. Do not modify, fill, or check any existing checkboxes.\n`;
    }
    summaryPrompt += `IMPORTANT: Return the response as JSON with a single "summary" field containing the structured summary content. Use markdown formatting within the summary text.\n`;
    summaryPrompt += `Example format: {"summary": "## Overview\\n[content here]\\n\\n## File Changes\\n[content here]"}\n`;
    summaryPrompt += `CRITICAL: Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks (\`\`\`json). Do NOT include any text before or after the JSON.\n`;
    
    if (template) {
      summaryPrompt += `\nCRITICAL TEMPLATE ADHERENCE:\n`;
      summaryPrompt += `- You MUST strictly follow the provided PR template structure and format\n`;
      summaryPrompt += `- The summary should fit EXACTLY within the template's expected structure\n`;
      summaryPrompt += `- Do NOT add sections not present in the template\n`;
      summaryPrompt += `- Do NOT modify the template's formatting or layout\n`;
      summaryPrompt += `- Fill in only the content areas that the template expects\n`;
      summaryPrompt += `- Preserve all headers, formatting, and structural elements from the template\n`;
    }

    try {
      console.log(chalk.gray('\n🔍 Debug - Summary Generation:'));
      console.log(chalk.gray(`Provider: ${targetProvider}`));
      console.log(chalk.gray(`Prompt length: ${summaryPrompt.length} characters`));
      
      const response = await this.callAIAPI(summaryPrompt, targetProvider);
      let content = this.extractContentFromResponse(response, targetProvider);
      
      console.log(chalk.gray(`Raw summary response: "${content}"`));
      console.log(chalk.gray(`Summary response length: ${content?.length || 0}`));
      console.log(chalk.gray(`Is summary valid JSON: ${this.isValidJSON(content)}`));
      
      // Clean the content to remove markdown code blocks
      const cleanedContent = this.cleanJSONResponse(content);
      console.log(chalk.gray(`Cleaned summary content: "${cleanedContent}"`));
      console.log(chalk.gray(`Is cleaned summary valid JSON: ${this.isValidJSON(cleanedContent)}`));
      
      // Try to parse as JSON first, if it's valid JSON extract the content
      try {
        const parsed = JSON.parse(cleanedContent);
        console.log(chalk.gray(`Summary JSON parsed successfully`));
        console.log(chalk.gray(`Summary JSON keys: ${Object.keys(parsed).join(', ')}`));
        
        if (parsed.summary) {
          content = parsed.summary;
          console.log(chalk.gray(`Using parsed.summary: "${content}"`));
        } else if (typeof parsed === 'string') {
          content = parsed;
          console.log(chalk.gray(`Using parsed string: "${content}"`));
        } else {
          console.log(chalk.gray(`No summary field found, using cleaned content`));
          content = cleanedContent;
        }
      } catch {
        console.log(chalk.gray(`Summary is not JSON, using cleaned content as plain text`));
        content = cleanedContent;
      }
      
      const finalSummary = content.trim().replace(/["']/g, ''); // Remove quotes
      console.log(chalk.gray(`Final summary: "${finalSummary}"`));
      
      return finalSummary;
    } catch (error) {
      console.log(chalk.gray(`❌ Summary generation failed: ${error}`));
      console.log(chalk.gray(`Using fallback summary generation`));
      // Enhanced fallback summary with file details
      return this.generateEnhancedFallbackSummary(jiraTicket, gitChanges, repoInfo);
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
        const truncatedDiff = file.diffContent.length > LIMITS.MAX_DIFF_CONTENT_LENGTH 
          ? file.diffContent.substring(0, LIMITS.MAX_DIFF_CONTENT_LENGTH) + '\n... (truncated for brevity)'
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

    // Template structure - CRITICAL REQUIREMENT
    if (template) {
      prompt += `## CRITICAL: PR Template Structure - MUST FOLLOW EXACTLY:\n`;
      prompt += `You MUST use this exact template structure and fill in ONLY the content areas. Do NOT add extra sections or modify the template format:\n\n`;
      prompt += `--- TEMPLATE START ---\n`;
      prompt += template.content;
      prompt += `\n--- TEMPLATE END ---\n\n`;
      prompt += `TEMPLATE RULES:\n`;
      prompt += `- Use the template structure EXACTLY as provided above (between the markers)\n`;
      prompt += `- Do NOT include the "--- TEMPLATE START ---" or "--- TEMPLATE END ---" markers in your output\n`;
      prompt += `- Fill in placeholder content ({{...}}) with appropriate values\n`;
      prompt += `- Preserve ALL formatting, headers, and structure from the template\n`;
      prompt += `- Do NOT add sections not in the template\n`;
      prompt += `- Do NOT remove sections from the template\n`;
      prompt += `- Do NOT modify checkbox states if present\n\n`;
    }

    // Overall diff content for context
    if (diffContent) {
      prompt += `## Overall Code Changes Context:\n`;
      prompt += `\`\`\`diff\n${diffContent.substring(0, LIMITS.MAX_OVERALL_DIFF_LENGTH)}${diffContent.length > LIMITS.MAX_OVERALL_DIFF_LENGTH ? '\n... (diff truncated for brevity)' : ''}\n\`\`\`\n\n`;
    }

    // Add summary context if available
    if (summary) {
      prompt += `## Generated Summary:\n`;
      prompt += `${summary}\n\n`;
    }

    prompt += `## Generation Requirements:\n`;
    if (template) {
      prompt += `CRITICAL: Since a PR template is provided, you MUST:\n`;
      prompt += `1. Follow the template structure EXACTLY - do not deviate from it\n`;
      prompt += `2. Fill in content areas within the template with HIGHLY DETAILED information\n`;
      prompt += `3. Create a SHORT, concise title (max 60 characters):\n`;
      prompt += `   - MUST include the JIRA ticket ID "${jiraTicket.key}" at the beginning\n`;
      prompt += `   - Format: "${jiraTicket.key}: Brief description of change"\n`;
      if (summary) {
        prompt += `   - Based on this summary: "${summary}"\n`;
      }
      prompt += `4. Use the provided template structure for the body\n`;
      prompt += `5. Fill template sections with COMPREHENSIVE details including:\n`;
      prompt += `   - Detailed explanations of all code changes (3-4 sentences per file minimum)\n`;
      prompt += `   - Specific functions/methods/classes modified\n`;
      prompt += `   - Technical implementation approach and integration points\n`;
      prompt += `   - Business value and impact on users/system\n`;
      prompt += `6. MANDATORY: Include extensive line links for code changes:\n`;
      prompt += `   - 4-6 specific line links per modified file\n`;
      prompt += `   - Group line links by functionality or change type\n`;
      prompt += `   - Format: [Line X](file_url#LX) with descriptive context\n`;
      prompt += `7. Ensure the summary section in the template is extremely detailed and comprehensive\n`;
    } else {
      prompt += `Please generate a pull request description that:\n`;
      prompt += `1. Creates a SHORT, concise title (max 60 characters) that:\n`;
      prompt += `   - MUST include the JIRA ticket ID "${jiraTicket.key}" at the beginning\n`;
      prompt += `   - Captures the main change in a few words\n`;
      prompt += `   - Format: "${jiraTicket.key}: Brief description of change"\n`;
      if (summary) {
        prompt += `   - Based on this summary: "${summary}"\n`;
      }
      prompt += `   - Examples: "${jiraTicket.key}: Add user authentication", "${jiraTicket.key}: Fix login bug"\n`;
      prompt += `2. Provides a detailed description that:\n`;
      prompt += `   - Starts with the summary as an overview\n`;
      prompt += `   - Explains HOW the code changes fulfill the JIRA ticket requirements\n`;
      prompt += `   - References specific files and line numbers where significant changes occurred\n`;
      prompt += `   - Describes the relevance of each major file change to the overall solution\n`;
      prompt += `   - Connects the implementation to the JIRA ticket description and requirements\n`;
      prompt += `3. Includes the Jira ticket reference with proper linking\n`;
      prompt += `4. Summarizes the technical approach and key implementation details\n`;
      prompt += `5. References specific line numbers and files for reviewers to focus on\n`;
      prompt += `6. MANDATORY: Include clickable line links for ALL significant code changes\n`;
    }
    prompt += `7. Testing instructions:\n`;
    if (template && template.content.toLowerCase().includes('testing')) {
      prompt += `   - DO NOT generate testing content as the template already includes a Testing section\n`;
      prompt += `   - Leave testing sections empty or with placeholder text for manual completion\n`;
    } else {
      prompt += `   - Include comprehensive testing instructions that relate to the JIRA requirements\n`;
    }
    prompt += `\nIMPORTANT FORMATTING RULES:\n`;
    if (template) {
      prompt += `TEMPLATE MODE - STRICT ADHERENCE REQUIRED:\n`;
      prompt += `- Follow the provided template structure EXACTLY\n`;
      prompt += `- Preserve ALL formatting, headers, sections, and layout from the template\n`;
      prompt += `- If the template contains checkboxes (- [ ]), preserve them EXACTLY as they appear\n`;
      prompt += `- Do NOT modify, fill, or check any existing checkboxes\n`;
      prompt += `- Do NOT add extra sections not in the template\n`;
      prompt += `- Do NOT remove sections from the template\n`;
      prompt += `- Only fill in content areas and placeholders within the existing template structure\n`;
      prompt += `- Ensure Jira URLs are placed according to template structure (not necessarily at top)\n`;
    } else {
      prompt += `- Do NOT include any checklists, checkboxes, or "- [ ]" items in the description\n`;
      prompt += `- Use bullet points (- item) and descriptive text only\n`;
      prompt += `- Ensure Jira and any Sentry URLs are prominently placed at the top of the body\n`;
    }
    prompt += `- In the summary section, include direct GitHub file URLs for all changed files\n`;
    prompt += `- CRITICAL: Include comprehensive line links [Line X](file_url#LX) for ALL significant code changes\n`;
    prompt += `- Each modified file must have 4-6 clickable line links covering ALL major changes\n`;
    prompt += `- Provide detailed explanations (3-4 sentences minimum) for each file modification\n`;
    prompt += `- Include specific function/method names and their purposes\n`;
    prompt += `- Explain the technical approach and integration points\n\n`;

    prompt += `CRITICAL TITLE REQUIREMENTS: \n`;
    prompt += `- Title MUST start with "${jiraTicket.key}: "\n`;
    prompt += `- Keep the description part SHORT and focused (max 50 characters after the ticket ID)\n`;
    prompt += `- Use action words that match the type of change (${jiraTicket.issueType})\n`;
    prompt += `- The body should start with the summary as context\n\n`;

    prompt += `IMPORTANT: Format the response as valid JSON with exactly these fields:\n`;
    prompt += `- "title": The PR title (string)\n`;
    prompt += `- "body": The PR description (string)\n\n`;
    prompt += `Example format: {"title": "PROJ-123: Add user authentication", "body": "## Summary\\n[description here]"}\n`;
    prompt += `CRITICAL: Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks (\`\`\`json). Do NOT include any text before or after the JSON.`;

    return prompt;
  }

  private async callAIAPI(prompt: string, provider: AIProvider): Promise<any> {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`${provider.toUpperCase()} client not configured`);
    }

    try {
      switch (provider) {
        case 'chatgpt':
          return await this.callChatGPTAPI(client, prompt);
        case 'gemini':
          return await this.callGeminiAPI(client, prompt);
        case 'copilot':
          return await this.callCopilotAPI(client, prompt);
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      console.error(`${provider.toUpperCase()} API failed:`, error);
      throw new Error(`${provider.toUpperCase()} API not available`);
    }
  }

  private async callChatGPTAPI(client: AxiosInstance, prompt: string): Promise<any> {
    let aiProvidersConfig;
    try {
      aiProvidersConfig = getConfig('aiProviders');
    } catch {
      aiProvidersConfig = null;
    }
    const model = aiProvidersConfig?.openai?.model || process.env.OPENAI_MODEL || DEFAULT_MODELS.OPENAI;
    
    const response = await client.post('/chat/completions', {
      model: model,
      max_tokens: LIMITS.MAX_API_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    if (!response.data.choices[0]?.message?.content) {
      throw new Error('No content received from ChatGPT API');
    }
    
    return response.data;
  }

  private async callGeminiAPI(client: AxiosInstance, prompt: string): Promise<any> {
    let aiProvidersConfig;
    try {
      aiProvidersConfig = getConfig('aiProviders');
    } catch {
      aiProvidersConfig = null;
    }
    const model = aiProvidersConfig?.gemini?.model || process.env.GEMINI_MODEL || DEFAULT_MODELS.GEMINI;
    const apiKey = aiProvidersConfig?.gemini?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    const response = await client.post(`/models/${model}:generateContent?key=${apiKey}`, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: LIMITS.MAX_API_TOKENS
      }
    });
    
    if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No content received from Gemini API');
    }
    
    return response.data;
  }

  private async callCopilotAPI(client: AxiosInstance, prompt: string): Promise<any> {
    let aiProvidersConfig;
    try {
      aiProvidersConfig = getConfig('aiProviders');
    } catch {
      aiProvidersConfig = null;
    }
    const model = aiProvidersConfig?.copilot?.model || process.env.COPILOT_MODEL || DEFAULT_MODELS.COPILOT;
    
    const response = await client.post('/chat/completions', {
      model: model,
      max_tokens: LIMITS.MAX_API_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    if (!response.data.choices[0]?.message?.content) {
      throw new Error('No content received from Copilot API');
    }
    
    return response.data;
  }

  private parseAIResponse(response: any, provider: AIProvider): GeneratedPRContent {
    const content = this.extractContentFromResponse(response, provider);
    
    // Debug: Log the raw response
    console.log(chalk.gray('\n🔍 Debug - Raw AI Response:'));
    console.log(chalk.gray(`Provider: ${provider}`));
    console.log(chalk.gray(`Full response structure:`));
    console.log(chalk.gray(JSON.stringify(response, null, 2).substring(0, LIMITS.MAX_DESCRIPTION_PREVIEW_LENGTH) + '...'));
    console.log(chalk.gray(`Extracted content:`));
    console.log(chalk.gray(`"${content}"`));
    console.log(chalk.gray(`Content length: ${content?.length || 0}`));
    console.log(chalk.gray(`Is valid JSON: ${this.isValidJSON(content)}`));
    
    return this.parseResponseContent(content);
  }

  private isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  private cleanJSONResponse(content: string): string {
    if (!content) return content;
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    let cleaned = content
      .replace(/^```(?:json)?\s*\n?/gmi, '') // Remove opening ```json or ```
      .replace(/\n?```\s*$/gm, '') // Remove closing ```
      .trim();
    
    // Also handle case where there might be text before/after the JSON
    // Try to extract JSON from within the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    return cleaned.trim();
  }

  private extractContentFromResponse(response: any, provider: AIProvider): string {
    switch (provider) {
      case 'chatgpt':
      case 'copilot':
        return response.choices[0].message.content;
      case 'gemini':
        return response.candidates[0].content.parts[0].text;
      default:
        throw new Error(`Unsupported provider for content extraction: ${provider}`);
    }
  }

  private parseResponseContent(content: string): GeneratedPRContent {
    console.log(chalk.gray('\n🔍 Debug - Parsing Response Content:'));
    console.log(chalk.gray(`Raw content to parse: "${content}"`));
    
    // Clean the content to remove markdown code blocks
    const cleanedContent = this.cleanJSONResponse(content);
    console.log(chalk.gray(`Cleaned content: "${cleanedContent}"`));
    console.log(chalk.gray(`Is cleaned content valid JSON: ${this.isValidJSON(cleanedContent)}`));
    
    try {
      const parsed = JSON.parse(cleanedContent);
      console.log(chalk.gray('✅ JSON parsing successful'));
      console.log(chalk.gray(`Parsed object keys: ${Object.keys(parsed).join(', ')}`));
      console.log(chalk.gray(`Parsed title: "${parsed.title}"`));
      console.log(chalk.gray(`Parsed body length: ${parsed.body?.length || 0}`));
      
      // Use AI-generated content directly, only use empty string if truly missing
      // This way we can distinguish between AI-generated content and missing content
      const title = parsed.title || '';
      const body = parsed.body || '';
      
      const result = {
        title: title.trim(),
        body: body.trim()
      };
      
      console.log(chalk.gray(`Final parsed result:`));
      console.log(chalk.gray(`- Title: "${result.title}"`));
      console.log(chalk.gray(`- Body length: ${result.body.length}`));
      
      return result;
    } catch (error) {
      console.log(chalk.gray('❌ JSON parsing failed'));
      console.log(chalk.gray(`Parse error: ${error}`));
      console.log(chalk.gray('Attempting manual extraction...'));
      
      // If parsing fails, extract content manually from the cleaned content first, then original
      const extractedTitle = this.extractTitle(cleanedContent) || this.extractTitle(content);
      console.log(chalk.gray(`Extracted title: "${extractedTitle}"`));
      
      const result = {
        title: extractedTitle?.trim() || '',
        body: cleanedContent?.trim() || content?.trim() || ''
      };
      
      console.log(chalk.gray(`Manual extraction result:`));
      console.log(chalk.gray(`- Title: "${result.title}"`));
      console.log(chalk.gray(`- Body length: ${result.body.length}`));
      
      return result;
    }
  }

  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/(?:title|Title):\s*(.+)/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  private generateFallbackDescription(options: GenerateDescriptionOptions): GeneratedPRContent {
    const { jiraTicket, gitChanges, template, prTitle } = options;
    const hasTemplate = template && template.content;
    const jiraConfig = getConfig('jira');

    // Generate a summary for fallback
    const summary = this.generateFallbackSummary(jiraTicket, gitChanges);

    // Generate shorter title based on summary
    const title = prTitle || this.generateShortTitle(jiraTicket);

    // Generate body based on template or default structure
    let body = '';
    
    // Always start with ticket URLs at the top
    body += `[${jiraTicket.key}](${jiraConfig.baseUrl}/browse/${jiraTicket.key})\n\n`;
    
    // Add summary
    body += `## Summary\n\n${summary}\n\n`;

    if (hasTemplate) {
      // Try to fill in template placeholders
      body += template!.content
        .replace(/\{\{ticket\}\}/gi, jiraTicket.key)
        .replace(/\{\{summary\}\}/gi, summary)
        .replace(/\{\{description\}\}/gi, jiraTicket.description || 'No description provided');
    } else {
      // Enhanced default template with detailed analysis
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

      // Only add testing section if no template or template doesn't have testing
      const hasTestingInTemplate = hasTemplate && template.content.toLowerCase().includes('testing');
      if (!hasTestingInTemplate) {
        body += `\n## Testing\n\n`;
        body += `- Manual testing completed\n`;
        body += `- Unit tests added/updated\n`;
        body += `- Integration tests passing\n`;
        if (jiraTicket.description) {
          body += `- Verified implementation meets JIRA requirements\n`;
        }
        body += `\n`;
      }
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

  private generateEnhancedFallbackSummary(jiraTicket: JiraTicket, gitChanges: GitChanges, repoInfo?: { owner: string; repo: string; currentBranch: string }): string {
    const action = this.getActionFromIssueType(jiraTicket.issueType);
    
    let summary = `## Overview\n`;
    summary += `${action} ${jiraTicket.summary.toLowerCase()} to address ${jiraTicket.key}.\n\n`;
    
    if (jiraTicket.description) {
      summary += `This implementation fulfills the requirements outlined in the JIRA ticket: ${jiraTicket.description.substring(0, 200)}${jiraTicket.description.length > 200 ? '...' : ''}\n\n`;
    }
    
    summary += `## File Changes\n`;
    summary += `Total files modified: ${gitChanges.totalFiles} (+${gitChanges.totalInsertions} insertions, -${gitChanges.totalDeletions} deletions)\n\n`;
    
    gitChanges.files.forEach(file => {
      if (repoInfo) {
        const fileUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${file.file}`;
        summary += `### [${file.file}](${fileUrl}) (${file.status})\n`;
      } else {
        summary += `### \`${file.file}\` (${file.status})\n`;
      }
      summary += `- **Changes**: +${file.insertions} insertions, -${file.deletions} deletions\n`;
      
      // Add specific line URLs for key changes if repo info is available
      if (repoInfo && file.lineNumbers?.added.length && file.lineNumbers.added.length > 0) {
        const fileUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${file.file}`;
        const keyLines = file.lineNumbers.added.slice(0, 3);
        if (keyLines.length === 1) {
          summary += `- **Key change**: [Line ${keyLines[0]}](${fileUrl}#L${keyLines[0]})\n`;
        } else if (keyLines.length > 1) {
          const lineLinks = keyLines.map(line => `[L${line}](${fileUrl}#L${line})`).join(', ');
          summary += `- **Key changes**: ${lineLinks}\n`;
        }
      }
      
      if (file.lineNumbers) {
        if (file.lineNumbers.added.length > 0) {
          const addedLines = file.lineNumbers.added.slice(0, 5);
          summary += `- **Key additions**: Lines ${addedLines.join(', ')}${file.lineNumbers.added.length > 5 ? ` (and ${file.lineNumbers.added.length - 5} more)` : ''}\n`;
        }
        if (file.lineNumbers.removed.length > 0) {
          const removedLines = file.lineNumbers.removed.slice(0, 5);
          summary += `- **Key removals**: Lines ${removedLines.join(', ')}${file.lineNumbers.removed.length > 5 ? ` (and ${file.lineNumbers.removed.length - 5} more)` : ''}\n`;
        }
      }
      
      summary += `- **Purpose**: ${this.getFileRelevanceDescription(file, jiraTicket)}\n\n`;
    });
    
    summary += `## Key Implementation Details\n`;
    const significantFiles = gitChanges.files.filter(f => f.insertions + f.deletions > 10);
    if (significantFiles.length > 0) {
      summary += `The most significant changes are in:\n`;
      significantFiles.forEach(file => {
        summary += `- **${file.file}**: Contains ${file.insertions + file.deletions} total changes`;
        if (file.lineNumbers?.added.length) {
          summary += `, with major additions around lines ${file.lineNumbers.added.slice(0, 3).join(', ')}`;
        }
        summary += `\n`;
      });
    } else {
      summary += `All changes are relatively small in scope, focusing on targeted modifications to implement the required functionality.\n`;
    }
    
    return summary;
  }

  private generateShortTitle(jiraTicket: JiraTicket): string {
    // Extract key action and subject from summary
    const action = this.getActionFromIssueType(jiraTicket.issueType);
    const subject = this.extractSubjectFromSummary(jiraTicket.summary);
    
    // Create short title with JIRA ticket ID at the beginning
    const maxDescriptionLength = 60 - jiraTicket.key.length - 2; // Reserve space for "KEY: "
    const description = `${action} ${subject}`;
    
    if (description.length <= maxDescriptionLength) {
      return `${jiraTicket.key}: ${description}`;
    } else {
      // Truncate description to fit
      const truncated = description.substring(0, maxDescriptionLength - 3);
      return `${jiraTicket.key}: ${truncated}...`;
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
