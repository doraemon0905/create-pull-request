"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
exports.validateJiraTicket = validateJiraTicket;
exports.validateGitRepository = validateGitRepository;
function validateEnvironment() {
    const requiredEnvVars = [
        'JIRA_BASE_URL',
        'JIRA_USERNAME',
        'JIRA_API_TOKEN',
        'GITHUB_TOKEN'
    ];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}\n` +
            'Please copy .env.example to .env and fill in your credentials.\n' +
            'Run "create-pr config" for setup instructions.');
    }
}
function validateJiraTicket(ticket) {
    // Basic Jira ticket format validation (PROJECT-123)
    const jiraTicketRegex = /^[A-Z][A-Z0-9]*-\d+$/;
    return jiraTicketRegex.test(ticket);
}
function validateGitRepository() {
    const { execSync } = require('child_process');
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    }
    catch {
        throw new Error('Not in a git repository. Please run this command from within a git repository.');
    }
}
//# sourceMappingURL=validation.js.map