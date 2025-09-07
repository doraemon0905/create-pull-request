export function validateEnvironment(): void {
  const requiredEnvVars = [
    'JIRA_BASE_URL',
    'JIRA_USERNAME',
    'JIRA_API_TOKEN',
    'GITHUB_TOKEN'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please copy .env.example to .env and fill in your credentials.\n' +
      'Run "create-pr config" for setup instructions.'
    );
  }
}

export function validateJiraTicket(ticket: string): boolean {
  // Basic Jira ticket format validation (PROJECT-123)
  const jiraTicketRegex = /^[A-Z][A-Z0-9]*-\d+$/;
  return jiraTicketRegex.test(ticket);
}

export function validateGitRepository(): void {
  const { execSync } = require('child_process');
  
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    throw new Error('Not in a git repository. Please run this command from within a git repository.');
  }
}