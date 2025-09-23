import { validateConfig, getConfigValue as getConfigValueFromConfig } from './config';
import { REGEX_PATTERNS } from '../constants';

export function validateEnvironment(): void {
  if (!validateConfig()) {
    throw new Error(
      'Missing required configuration. Please run "create-pr setup" to configure your credentials.\n' +
      'Run "create-pr config" for setup instructions.'
    );
  }
}

export function getConfigValue(key: string): string | undefined {
  // Map legacy environment variable names to new config structure
  switch (key) {
    case 'JIRA_BASE_URL':
      return getConfigValueFromConfig('jira', 'baseUrl') || undefined;
    case 'JIRA_USERNAME':
      return getConfigValueFromConfig('jira', 'username') || undefined;
    case 'JIRA_API_TOKEN':
      return getConfigValueFromConfig('jira', 'apiToken') || undefined;
    case 'GITHUB_TOKEN':
      return getConfigValueFromConfig('github', 'token') || undefined;
    case 'COPILOT_API_TOKEN':
      return getConfigValueFromConfig('copilot', 'apiToken') || undefined;
    case 'DEFAULT_BRANCH':
      return getConfigValueFromConfig('github', 'defaultBranch') || undefined;
    case 'JIRA_PROJECT_KEY':
      return getConfigValueFromConfig('jira', 'projectKey') || undefined;
    default:
      // For other environment variables, fall back to process.env
      return process.env[key];
  }
}

export function validateJiraTicket(ticket: string): boolean {
  // Basic Jira ticket format validation (PROJECT-123)
  return REGEX_PATTERNS.JIRA_TICKET.test(ticket);
}

export function extractJiraTicketFromBranch(branchName: string): string | null {
  // Extract Jira ticket ID from branch names like:
  // - ft/ET-123 -> ET-123
  // - ft-ET-123 -> ET-123
  // - feature_ET-123 -> ET-123
  // - ET-123-some-description -> ET-123
  // - bugfix/PROJ-456/fix-issue -> PROJ-456
  const match = branchName.match(REGEX_PATTERNS.JIRA_TICKET_FROM_BRANCH);
  return match ? match[1].toUpperCase() : null;
}

export function validateGitRepository(): void {
  const { execSync } = require('node:child_process');

  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    throw new Error('Not in a git repository. Please run this command from within a git repository.');
  }
}

export function validateGitHubUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return REGEX_PATTERNS.GITHUB_URL.test(url);
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&"']/g, '') // Remove potentially dangerous characters
    .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
    .trim(); // Remove leading/trailing whitespace
}
