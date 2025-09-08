"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
exports.getConfigValue = getConfigValue;
exports.validateJiraTicket = validateJiraTicket;
exports.validateGitRepository = validateGitRepository;
const config_1 = require("./config");
function validateEnvironment() {
    if (!(0, config_1.validateConfig)()) {
        throw new Error('Missing required configuration. Please run "create-pr setup" to configure your credentials.\n' +
            'Run "create-pr config" for setup instructions.');
    }
}
function getConfigValue(key) {
    // Map legacy environment variable names to new config structure
    try {
        switch (key) {
            case 'JIRA_BASE_URL':
                return (0, config_1.getConfigValue)('jira', 'baseUrl') || undefined;
            case 'JIRA_USERNAME':
                return (0, config_1.getConfigValue)('jira', 'username') || undefined;
            case 'JIRA_API_TOKEN':
                return (0, config_1.getConfigValue)('jira', 'apiToken') || undefined;
            case 'GITHUB_TOKEN':
                return (0, config_1.getConfigValue)('github', 'token') || undefined;
            case 'COPILOT_API_TOKEN':
                return (0, config_1.getConfigValue)('copilot', 'apiToken') || undefined;
            case 'DEFAULT_BRANCH':
                return (0, config_1.getConfigValue)('github', 'defaultBranch') || undefined;
            case 'JIRA_PROJECT_KEY':
                return (0, config_1.getConfigValue)('jira', 'projectKey') || undefined;
            default:
                // For other environment variables, fall back to process.env
                return process.env[key];
        }
    }
    catch {
        // If config loading fails, fall back to environment variables
        return process.env[key];
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