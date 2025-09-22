"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
exports.getConfigValue = getConfigValue;
exports.validateJiraTicket = validateJiraTicket;
exports.extractJiraTicketFromBranch = extractJiraTicketFromBranch;
exports.validateGitRepository = validateGitRepository;
exports.validateGitHubUrl = validateGitHubUrl;
exports.validateEmail = validateEmail;
exports.sanitizeInput = sanitizeInput;
const config_1 = require("./config");
const constants_1 = require("../constants");
function validateEnvironment() {
    if (!(0, config_1.validateConfig)()) {
        throw new Error('Missing required configuration. Please run "create-pr setup" to configure your credentials.\n' +
            'Run "create-pr config" for setup instructions.');
    }
}
function getConfigValue(key) {
    // Map legacy environment variable names to new config structure
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
function validateJiraTicket(ticket) {
    // Basic Jira ticket format validation (PROJECT-123)
    return constants_1.REGEX_PATTERNS.JIRA_TICKET.test(ticket);
}
function extractJiraTicketFromBranch(branchName) {
    // Extract Jira ticket ID from branch names like:
    // - ft/ET-123 -> ET-123
    // - ft-ET-123 -> ET-123
    // - feature_ET-123 -> ET-123
    // - ET-123-some-description -> ET-123
    // - bugfix/PROJ-456/fix-issue -> PROJ-456
    const match = branchName.match(constants_1.REGEX_PATTERNS.JIRA_TICKET_FROM_BRANCH);
    return match ? match[1].toUpperCase() : null;
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
function validateGitHubUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    return constants_1.REGEX_PATTERNS.GITHUB_URL.test(url);
}
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    return input
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/[&"']/g, '') // Remove potentially dangerous characters
        .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
        .trim(); // Remove leading/trailing whitespace
}
//# sourceMappingURL=validation.js.map