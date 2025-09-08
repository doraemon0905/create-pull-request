"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
exports.getConfigValue = getConfigValue;
exports.validateJiraTicket = validateJiraTicket;
exports.validateGitRepository = validateGitRepository;
function validateEnvironment() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const CONFIG_FILE = path.join(os.homedir(), '.create-pr', 'env-config.json');
    const requiredEnvVars = [
        'JIRA_BASE_URL',
        'JIRA_USERNAME',
        'JIRA_API_TOKEN',
        'GITHUB_TOKEN'
    ];
    let config = null;
    // Try to load JSON config first
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
            config = JSON.parse(configData);
        }
        catch (error) {
            console.warn('Warning: Failed to parse JSON config file, falling back to environment variables');
        }
    }
    // Check if values are available (either from config or env vars)
    const missingVars = requiredEnvVars.filter(varName => {
        // Check environment variable first
        if (process.env[varName]) {
            return false;
        }
        // Then check JSON config
        if (config) {
            switch (varName) {
                case 'JIRA_BASE_URL':
                    return !config.jira?.baseUrl;
                case 'JIRA_USERNAME':
                    return !config.jira?.username;
                case 'JIRA_API_TOKEN':
                    return !config.jira?.apiToken;
                case 'GITHUB_TOKEN':
                    return !config.github?.token;
                default:
                    return true;
            }
        }
        return true;
    });
    if (missingVars.length > 0) {
        throw new Error(`Missing required configuration: ${missingVars.join(', ')}\n` +
            'Please either:\n' +
            '1. Copy .env.example to .env and fill in your credentials, OR\n' +
            '2. Run "npm run setup-env" to create a global JSON configuration file\n' +
            'Run "create-pr config" for setup instructions.');
    }
}
function getConfigValue(key) {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const CONFIG_FILE = path.join(os.homedir(), '.create-pr', 'env-config.json');
    // Check environment variable first
    if (process.env[key]) {
        return process.env[key];
    }
    // Then check JSON config
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = JSON.parse(configData);
            switch (key) {
                case 'JIRA_BASE_URL':
                    return config.jira?.baseUrl;
                case 'JIRA_USERNAME':
                    return config.jira?.username;
                case 'JIRA_API_TOKEN':
                    return config.jira?.apiToken;
                case 'GITHUB_TOKEN':
                    return config.github?.token;
                case 'COPILOT_API_TOKEN':
                    return config.copilot?.apiToken;
                case 'DEFAULT_BRANCH':
                    return config.github?.defaultBranch;
                case 'JIRA_PROJECT_KEY':
                    return config.jira?.projectKey;
                default:
                    return undefined;
            }
        }
        catch (error) {
            return undefined;
        }
    }
    return undefined;
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