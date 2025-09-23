import axios, { AxiosInstance } from 'axios';
import { JiraTicket } from './jira';
import { GitChanges, FileChange } from './git';
import { PullRequestTemplate } from './github';
import { getConfig } from '../utils/config';
import inquirer from 'inquirer';
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

export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'copilot';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export class AIDescriptionGeneratorService {
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

    // Claude client (primary AI provider)
    const claudeKey = aiProvidersConfig?.claude?.apiKey ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY;
    if (claudeKey) {
      this.clients.set('claude', axios.create({
        baseURL: API_URLS.CLAUDE_BASE_URL,
        headers: {
          'Authorization': `Bearer ${claudeKey}`,
          'Content-Type': HEADERS.JSON_CONTENT_TYPE,
          'anthropic-version': '2023-06-01'
        },
        timeout: LIMITS.API_TIMEOUT_MS
      }));
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
  }

  private async selectAIProvider(): Promise<AIProvider> {
    const availableProviders = Array.from(this.clients.keys());

    if (availableProviders.length === 0) {
      throw new Error('No AI providers configured. Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or configure GitHub Copilot.');
    }

    // If only one provider available, use it
    if (availableProviders.length === 1) {
      const provider = availableProviders[0];
      return provider;
    }

    // Prioritize Claude first, then ChatGPT, then Gemini, then Copilot
    const preferredOrder: AIProvider[] = ['claude', 'chatgpt', 'gemini', 'copilot'];
    for (const preferred of preferredOrder) {
      if (availableProviders.includes(preferred)) {
        const provider = preferred;
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
        default: availableProviders.includes('claude') ? 'claude' : availableProviders.includes('chatgpt') ? 'chatgpt' : availableProviders[0]
      }
    ]);

    return selectedProvider;
  }


  private async generateSummary(options: GenerateDescriptionOptions, provider?: AIProvider): Promise<string> {
    const targetProvider = provider || this.selectedProvider || 'claude';
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
      summaryPrompt += `${template.content}\n`;
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
        const fileUrl = this.generateFileUrl(repoInfo, file.file);
        summaryPrompt += `- GitHub URL: ${fileUrl}\n`;

        // Add specific line URLs for key changes
        if (file.lineNumbers?.added.length && file.lineNumbers.added.length > 0) {
          const keyLines = file.lineNumbers.added.slice(0, 3);
          if (keyLines.length > 0) {
            const lineLinks = this.generateLineLinks(repoInfo, file.file, keyLines);
            summaryPrompt += `- Key changes at lines: ${lineLinks}\n`;
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
        // Truncate very long diffs but ensure we capture the most important parts
        const truncatedDiff = file.diffContent.length > LIMITS.MAX_DIFF_CONTENT_LENGTH * 2
          ? file.diffContent.substring(0, LIMITS.MAX_DIFF_CONTENT_LENGTH * 2) + '\n... (diff truncated for brevity)'
          : file.diffContent;
        summaryPrompt += `- Full code diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n`;

        // Extract key changes from the diff for better AI understanding
        const diffSummary = this.extractDiffSummary(file.diffContent);
        if (diffSummary.length > 0) {
          summaryPrompt += `- Key code changes:\n${diffSummary.map(change => `  * ${change}`).join('\n')}\n`;
        }
      } else {
        summaryPrompt += `- No detailed diff available for this file\n`;
      }
    });

    if (diffContent) {
      summaryPrompt += `\n## Overall Code Changes:\n`;

      // Provide the full diff with length limits
      const truncatedOverallDiff = diffContent.length > LIMITS.MAX_OVERALL_DIFF_LENGTH
        ? diffContent.substring(0, LIMITS.MAX_OVERALL_DIFF_LENGTH) + '\n... (overall diff truncated for brevity)'
        : diffContent;
      summaryPrompt += `\`\`\`diff\n${truncatedOverallDiff}\n\`\`\`\n`;

      // Extract and provide high-level diff insights
      const overallDiffSummary = this.extractDiffSummary(diffContent);
      if (overallDiffSummary.length > 0) {
        summaryPrompt += `\n### High-level code change patterns:\n`;
        summaryPrompt += `${overallDiffSummary.map(change => `- ${change}`).join('\n')}\n`;
      }
    } else {
      summaryPrompt += `\n## Overall Code Changes:\n`;
      summaryPrompt += `Overall diff content not available. Analysis based on file-level changes above.\n`;
    }

    summaryPrompt += `\n## Summary Requirements:\n`;
    summaryPrompt += `IMPORTANT: Analyze the provided diff content carefully to understand the actual code changes made.\n`;
    summaryPrompt += `Use the diff content to provide specific, accurate descriptions of what was modified, added, or removed.\n\n`;
    summaryPrompt += `Please provide a HIGHLY DETAILED and comprehensive summary that:\n`;
    summaryPrompt += `1. ALWAYS starts with relevant ticket URLs at the very top if available:\n`;
    summaryPrompt += `   - Jira ticket URL in format: [${jiraTicket.key}](JIRA_BASE_URL/browse/${jiraTicket.key})\n`;
    summaryPrompt += `   - Any Sentry error URLs mentioned in the ticket description\n`;
    summaryPrompt += `   - Other relevant tracking URLs\n`;
    summaryPrompt += `2. Provides a detailed overview (6-8 sentences) explaining:\n`;
    summaryPrompt += `   - What specific feature/change is being implemented\n`;
    summaryPrompt += `   - How it directly addresses EACH requirement in the JIRA ticket description\n`;
    summaryPrompt += `   - The technical approach and architecture decisions made\n`;
    summaryPrompt += `   - The specific problem this solves from the ticket description\n`;
    summaryPrompt += `   - The impact on the system, users, and related components\n`;
    summaryPrompt += `   - How the implementation validates against the acceptance criteria\n`;
    summaryPrompt += `3. For EACH modified file, provides EXTENSIVE detail including:\n`;
    summaryPrompt += `   - File header as clickable link: [src/filename.ext](GitHub_URL)\n`;
    summaryPrompt += `   - COMPREHENSIVE explanation of what changed (5-7 sentences minimum)\n`;
    summaryPrompt += `   - DETAILED analysis of how each change maps to specific JIRA ticket requirements\n`;
    summaryPrompt += `   - ALL specific functions/methods/classes that were modified, added, or removed\n`;
    summaryPrompt += `   - WHY each change was necessary to fulfill the exact JIRA requirements\n`;
    summaryPrompt += `   - WHAT the code was doing before vs. what it does now (for modifications)\n`;
    summaryPrompt += `   - HOW the new implementation solves the problems described in the ticket\n`;
    summaryPrompt += `   - Specific code patterns added/removed (from the provided diffs)\n`;
    summaryPrompt += `   - MANDATORY: Multiple specific line links for ALL significant changes\n`;
    if (repoInfo) {
      summaryPrompt += `   - MUST include all GitHub file URLs provided above for navigation\n`;
      summaryPrompt += `   - REQUIRED: Link to EVERY significant line change using GitHub line URLs\n`;
      summaryPrompt += `   - Format file links as: [src/file.ts](https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/src/file.ts)\n`;
      summaryPrompt += `   - Format line links as: [Line 123](https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/src/file.ts#L123)\n`;
      summaryPrompt += `   - Include 4-6 specific line links per modified file covering ALL major changes\n`;
      summaryPrompt += `   - Group line links by functionality (e.g., "Authentication logic: [Line 45](url), [Line 67](url)")\n`;
    }
    summaryPrompt += `4. COMPREHENSIVE technical implementation details including:\n`;
    summaryPrompt += `   - EVERY new function/method added, their exact purpose, and how they fulfill ticket requirements\n`;
    summaryPrompt += `   - ALL modified existing functions with detailed before/after comparisons\n`;
    summaryPrompt += `   - COMPLETE analysis of integration points with other system components\n`;
    summaryPrompt += `   - DETAILED error handling, edge cases, and validation logic implemented\n`;
    summaryPrompt += `   - SPECIFIC algorithm or business logic changes and their rationale\n`;
    summaryPrompt += `   - EXACT data flow changes and how they address ticket requirements\n`;
    summaryPrompt += `5. DETAILED business value and impact analysis:\n`;
    summaryPrompt += `   - POINT-BY-POINT mapping of how this implementation fulfills EACH JIRA ticket requirement\n`;
    summaryPrompt += `   - SPECIFIC user experience improvements with concrete examples\n`;
    summaryPrompt += `   - MEASURABLE system performance, security, or reliability improvements\n`;
    summaryPrompt += `   - CLEAR explanation of business problems solved and value delivered\n`;
    summaryPrompt += `   - SPECIFIC scenarios where users will benefit from these changes\n`;
    summaryPrompt += `6. DETAILED review focus areas with specific line references:\n`;
    summaryPrompt += `   - ALL critical changes that require careful review with exact line numbers\n`;
    summaryPrompt += `   - COMPLEX logic explained line-by-line with rationale for each decision\n`;
    summaryPrompt += `   - ALL integration points that could affect other features with impact analysis\n`;
    summaryPrompt += `   - POTENTIAL risks, side effects, or dependencies that reviewers should validate\n`;
    summaryPrompt += `   - SPECIFIC test scenarios that validate the ticket requirements\n\n`;
    summaryPrompt += `Format the response as a COMPREHENSIVE structured summary with these sections:\n`;
    summaryPrompt += `- Ticket URLs (Jira, Sentry, etc.) at the very top\n`;
    summaryPrompt += `- Detailed Overview (6-8 sentences explaining the change and impact)\n`;
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

    const response = await this.callAIAPI(summaryPrompt, targetProvider);
    let content = this.extractContentFromResponse(response, targetProvider);

    // Clean the content to remove markdown code blocks
    const cleanedContent = this.cleanJSONResponse(content);

    // Try to parse as JSON first, if it's valid JSON extract the content
    try {
      const parsed = JSON.parse(cleanedContent);

      if (parsed.summary) {
        content = parsed.summary;
      } else if (typeof parsed === 'string') {
        content = parsed;
      } else {
        content = cleanedContent;
      }
    } catch {
      content = cleanedContent;
    }

    const finalSummary = content.trim().replace(/["']/g, ''); // Remove quotes

    return finalSummary;
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
    prompt += `## COMPREHENSIVE Changes Analysis:\n`;
    prompt += `- Total files changed: ${gitChanges.totalFiles}\n`;
    prompt += `- Total insertions: ${gitChanges.totalInsertions}\n`;
    prompt += `- Total deletions: ${gitChanges.totalDeletions}\n\n`;

    // Detailed file-by-file analysis with enhanced requirements
    prompt += `### DETAILED File-by-File Changes Analysis:\n`;
    prompt += `For EACH file below, you MUST explain in detail HOW the specific changes fulfill the JIRA ticket requirements:\n\n`;
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
        prompt += `- COMPLETE code changes for analysis:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n`;
        prompt += `- MANDATORY: Analyze this diff and explain HOW each change addresses the JIRA ticket requirements\n`;
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
      prompt += `5. Fill template sections with EXTREMELY DETAILED information including:\n`;
      prompt += `   - COMPREHENSIVE explanations of all code changes (5-7 sentences per file minimum)\n`;
      prompt += `   - EXACT mapping of how each code change fulfills specific JIRA ticket requirements\n`;
      prompt += `   - ALL specific functions/methods/classes modified with before/after analysis\n`;
      prompt += `   - DETAILED technical implementation approach and integration points\n`;
      prompt += `   - SPECIFIC business value and measurable impact on users/system\n`;
      prompt += `   - CLEAR connection between implementation and JIRA ticket acceptance criteria\n`;
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
      prompt += `2. Provides an EXTREMELY DETAILED description that:\n`;
      prompt += `   - Starts with the comprehensive summary as an overview\n`;
      prompt += `   - EXPLICITLY explains HOW EACH code change fulfills SPECIFIC JIRA ticket requirements\n`;
      prompt += `   - METICULOUSLY references specific files and line numbers for ALL significant changes\n`;
      prompt += `   - THOROUGHLY describes the relevance of EVERY file change to the overall solution\n`;
      prompt += `   - CLEARLY connects EACH implementation detail to the JIRA ticket description and requirements\n`;
      prompt += `   - ANALYZES the before/after state for all modified code and WHY changes were necessary\n`;
      prompt += `   - DEMONSTRATES how the implementation validates against acceptance criteria\n`;
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
    prompt += `- Provide EXTREMELY detailed explanations (5-7 sentences minimum) for each file modification\n`;
    prompt += `- Include ALL specific function/method names and their exact purposes\n`;
    prompt += `- Explain the complete technical approach, architecture decisions, and integration points\n`;
    prompt += `- MANDATORY: Map EVERY code change to its corresponding JIRA ticket requirement\n`;
    prompt += `- REQUIRED: Explain WHY each change was implemented and HOW it solves the ticket problem\n`;
    prompt += `- ESSENTIAL: Include before/after analysis for all modified code sections\n\n`;

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

    switch (provider) {
      case 'claude':
        return await this.callClaudeAPI(client, prompt);
      case 'chatgpt':
        return await this.callChatGPTAPI(client, prompt);
      case 'gemini':
        return await this.callGeminiAPI(client, prompt);
      case 'copilot':
        return await this.callCopilotAPI(client, prompt);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private getAIProvidersConfig() {
    try {
      return getConfig('aiProviders');
    } catch {
      return null;
    }
  }

  private getModelForProvider(provider: AIProvider): string {
    const aiProvidersConfig = this.getAIProvidersConfig();

    switch (provider) {
      case 'claude':
        return aiProvidersConfig?.claude?.model || process.env.CLAUDE_MODEL || DEFAULT_MODELS.CLAUDE;
      case 'chatgpt':
        return aiProvidersConfig?.openai?.model || process.env.OPENAI_MODEL || DEFAULT_MODELS.OPENAI;
      case 'gemini':
        return aiProvidersConfig?.gemini?.model || process.env.GEMINI_MODEL || DEFAULT_MODELS.GEMINI;
      case 'copilot':
        return aiProvidersConfig?.copilot?.model || process.env.COPILOT_MODEL || DEFAULT_MODELS.COPILOT;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private generateFileUrl(repoInfo: { owner: string; repo: string; currentBranch: string }, filePath: string): string {
    return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoInfo.currentBranch}/${filePath}`;
  }

  private generateLineUrl(repoInfo: { owner: string; repo: string; currentBranch: string }, filePath: string, lineNumber: number): string {
    return `${this.generateFileUrl(repoInfo, filePath)}#L${lineNumber}`;
  }

  private generateLineLinks(repoInfo: { owner: string; repo: string; currentBranch: string }, filePath: string, lineNumbers: number[]): string {
    if (lineNumbers.length === 1) {
      return `[Line ${lineNumbers[0]}](${this.generateLineUrl(repoInfo, filePath, lineNumbers[0])})`;
    } else if (lineNumbers.length > 1) {
      return lineNumbers.map(line => `[L${line}](${this.generateLineUrl(repoInfo, filePath, line)})`).join(', ');
    }
    return '';
  }

  private async callClaudeAPI(client: AxiosInstance, prompt: string): Promise<any> {
    const model = this.getModelForProvider('claude');

    const response = await client.post('/v1/messages', {
      model: model,
      max_tokens: LIMITS.MAX_API_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    if (!response.data || !response.data.content?.[0]?.text) {
      throw new Error('No content received from Claude API');
    }

    return response.data;
  }

  private async callChatGPTAPI(client: AxiosInstance, prompt: string): Promise<any> {
    const model = this.getModelForProvider('chatgpt');

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

    if (!response.data || !response.data.choices?.[0]?.message?.content) {
      throw new Error('No content received from ChatGPT API');
    }

    return response.data;
  }

  private async callGeminiAPI(client: AxiosInstance, prompt: string): Promise<any> {
    const model = this.getModelForProvider('gemini');
    const aiProvidersConfig = this.getAIProvidersConfig();
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

    if (!response.data || !response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No content received from Gemini API');
    }

    return response.data;
  }

  private async callCopilotAPI(client: AxiosInstance, prompt: string): Promise<any> {
    const model = this.getModelForProvider('copilot');

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

    if (!response.data || !response.data.choices?.[0]?.message?.content) {
      throw new Error('No content received from Copilot API');
    }

    return response.data;
  }

  private parseAIResponse(response: any, provider: AIProvider): GeneratedPRContent {
    const content = this.extractContentFromResponse(response, provider);

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
      case 'claude':
        return response.content[0].text;
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
    // Clean the content to remove markdown code blocks
    const cleanedContent = this.cleanJSONResponse(content);

    try {
      const parsed = JSON.parse(cleanedContent);

      // Use AI-generated content directly, only use empty string if truly missing
      // This way we can distinguish between AI-generated content and missing content
      const title = parsed.title || '';
      const body = parsed.body || '';

      const result = {
        title: title.trim(),
        body: body.trim()
      };

      return result;
    } catch (_error) {
      // If parsing fails, extract content manually from the cleaned content first, then original
      const extractedTitle = this.extractTitle(cleanedContent) || this.extractTitle(content);

      const result = {
        title: extractedTitle?.trim() || '',
        body: cleanedContent?.trim() || content?.trim() || ''
      };

      return result;
    }
  }

  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/(?:title|Title):\s*(.+)/i);
    return titleMatch ? titleMatch[1].trim() : null;
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



  private extractDiffSummary(diffContent: string): string[] {
    const summary: string[] = [];
    const lines = diffContent.split('\n');

    let addedLines = 0;
    let removedLines = 0;

    for (const line of lines) {
      // Track function/method/class context
      if (line.match(/^[+-]\s*(function|def|class|interface|export|import|const|let|var)/)) {
        const match = line.match(/^[+-]\s*(.*)/);
        if (match) {
          const declaration = match[1].substring(0, 50);
          if (line.startsWith('+')) {
            summary.push(`Added: ${declaration}`);
          } else if (line.startsWith('-')) {
            summary.push(`Removed: ${declaration}`);
          }
        }
      }

      // Track significant code changes
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
        // Capture important additions
        if (line.match(/^[+]\s*(if|else|for|while|switch|case|try|catch|return|throw)/)) {
          const codeLine = line.substring(1).trim().substring(0, 60);
          summary.push(`Added logic: ${codeLine}`);
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines++;
        // Capture important removals
        if (line.match(/^[-]\s*(if|else|for|while|switch|case|try|catch|return|throw)/)) {
          const codeLine = line.substring(1).trim().substring(0, 60);
          summary.push(`Removed logic: ${codeLine}`);
        }
      }

      // Capture import/export changes
      if (line.match(/^[+-]\s*(import|export)/)) {
        const match = line.match(/^[+-]\s*(.*)/);
        if (match) {
          const importExport = match[1].substring(0, 50);
          if (line.startsWith('+')) {
            summary.push(`Added dependency: ${importExport}`);
          } else if (line.startsWith('-')) {
            summary.push(`Removed dependency: ${importExport}`);
          }
        }
      }

      // Capture configuration or constant changes
      if (line.match(/^[+-]\s*.*[=:]\s*(true|false|null|undefined|\d+|['"][^'"]*['"])/)) {
        const match = line.match(/^[+-]\s*(.*)/);
        if (match) {
          const configChange = match[1].trim().substring(0, 50);
          if (line.startsWith('+')) {
            summary.push(`Added config: ${configChange}`);
          } else if (line.startsWith('-')) {
            summary.push(`Removed config: ${configChange}`);
          }
        }
      }
    }

    // Add summary statistics if significant changes
    if (addedLines > 10 || removedLines > 10) {
      summary.unshift(`Major changes: +${addedLines} lines, -${removedLines} lines`);
    }

    // Limit to most important changes to avoid overwhelming the AI
    return summary.slice(0, 8);
  }
}
