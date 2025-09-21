// Load package.json to get dynamic version
import * as fs from 'fs';
import * as path from 'path';

// Function to get version from package.json
function getPackageVersion(): string {
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    // Fallback version if package.json can't be read
    return '1.0.0';
  }
}

// API Configuration
export const API_URLS = {
  CLAUDE_BASE_URL: 'https://api.anthropic.com',
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  COPILOT_BASE_URL: 'https://api.githubcopilot.com',
  JIRA_API_VERSION: '/rest/api/3'
} as const;

// Default Models
export const DEFAULT_MODELS = {
  CLAUDE: 'claude-3-5-sonnet-20241022',
  OPENAI: 'gpt-4o',
  GEMINI: 'gemini-1.5-pro',
  COPILOT: 'gpt-4o'
} as const;

// Limits and Timeouts
export const LIMITS = {
  API_TIMEOUT_MS: 30000,
  MAX_API_TOKENS: 4000,
  MAX_PR_TITLE_LENGTH: 256,
  DEFAULT_MAX_DIFF_LINES: 1000,
  MAX_DESCRIPTION_PREVIEW_LENGTH: 500,
  MAX_TEMPLATE_PREVIEW_LENGTH: 800,
  MAX_DIFF_CONTENT_LENGTH: 1000,
  MAX_OVERALL_DIFF_LENGTH: 3000,
  HUNK_HEADER_OFFSET: 10
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404
} as const;

// Configuration Constants
export const CONFIG = {
  DIRECTORY_NAME: '.create-pr',
  FILE_NAME: 'env-config.json',
  VERSION: getPackageVersion(),
  DEFAULT_BRANCH: 'main',
  DEFAULT_REMOTE: 'origin',
  CLI_NAME: 'create-pr',
  CLI_VERSION: getPackageVersion()
} as const;

// File System
export const FILE_PATHS = {
  PR_TEMPLATE_PATHS: [
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'pull_request_template.md',
    'PULL_REQUEST_TEMPLATE.md',
    '.github/PULL_REQUEST_TEMPLATE/default.md'
  ]
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  JIRA_TICKET: /^[A-Z][A-Z0-9]*-\d+$/,
  JIRA_TICKET_FROM_BRANCH: /(?:^|[/\-_])([A-Z][A-Z0-9]*-\d+)(?:[/\-_]|$)/i,
  GITHUB_URL: /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
} as const;

// Content Types and Headers
export const HEADERS = {
  JSON_CONTENT_TYPE: 'application/json',
  USER_AGENT: 'create-pr-cli'
} as const;

// JIRA Endpoints
export const JIRA_ENDPOINTS = {
  ISSUE: '/issue/',
  USER: '/myself'
} as const;

// System Constants
export const SYSTEM = {
  EXECUTABLE_PERMISSIONS: '755',
  MIN_NODE_VERSION: '>=18.0.0'
} as const;
