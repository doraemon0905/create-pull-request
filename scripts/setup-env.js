#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const CONFIG_FILE = path.join(os.homedir(), '.create-pr', 'env-config.json');

async function setupEnvironment() {
    console.log(chalk.blue('🚀 Environment Setup Wizard'));
    console.log(chalk.gray('This will collect your environment configuration and save it for global use.\n'));

    const questions = [
        {
            type: 'input',
            name: 'jiraBaseUrl',
            message: 'Enter your Jira base URL (e.g., https://your-company.atlassian.net):',
            validate: (input) => {
                if (!input.trim()) return 'Jira base URL is required';
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        },
        {
            type: 'input',
            name: 'jiraUsername',
            message: 'Enter your Jira username/email:',
            validate: (input) => input.trim() ? true : 'Jira username is required'
        },
        {
            type: 'password',
            name: 'jiraApiToken',
            message: 'Enter your Jira API token:',
            validate: (input) => input.trim() ? true : 'Jira API token is required'
        },
        {
            type: 'password',
            name: 'githubToken',
            message: 'Enter your GitHub personal access token:',
            validate: (input) => input.trim() ? true : 'GitHub token is required'
        },
        {
            type: 'list',
            name: 'aiProvider',
            message: 'Select your preferred AI provider for PR description generation:',
            choices: [
                { name: 'ChatGPT (OpenAI)', value: 'chatgpt' },
                { name: 'Gemini (Google)', value: 'gemini' },
                { name: 'GitHub Copilot', value: 'copilot' },
                { name: 'Skip AI provider setup', value: 'none' }
            ],
            default: 'chatgpt'
        },
        {
            type: 'password',
            name: 'openaiApiKey',
            message: 'Enter your OpenAI API key:',
            when: (answers) => answers.aiProvider === 'chatgpt',
            validate: (input) => input.trim() ? true : 'OpenAI API key is required for ChatGPT'
        },
        {
            type: 'input',
            name: 'openaiModel',
            message: 'Enter OpenAI model to use:',
            when: (answers) => answers.aiProvider === 'chatgpt',
            default: 'gpt-4o'
        },
        {
            type: 'password',
            name: 'geminiApiKey',
            message: 'Enter your Gemini API key:',
            when: (answers) => answers.aiProvider === 'gemini',
            validate: (input) => input.trim() ? true : 'Gemini API key is required for Gemini'
        },
        {
            type: 'input',
            name: 'geminiModel',
            message: 'Enter Gemini model to use:',
            when: (answers) => answers.aiProvider === 'gemini',
            default: 'gemini-1.5-pro'
        },
        {
            type: 'password',
            name: 'copilotApiToken',
            message: 'Enter your GitHub Copilot API token:',
            when: (answers) => answers.aiProvider === 'copilot',
            validate: (input) => input.trim() ? true : 'GitHub Copilot API token is required for Copilot'
        },
        {
            type: 'input',
            name: 'copilotModel',
            message: 'Enter Copilot model to use:',
            when: (answers) => answers.aiProvider === 'copilot',
            default: 'gpt-4o'
        },
        {
            type: 'input',
            name: 'defaultBranch',
            message: 'Enter your default branch name:',
            default: 'main'
        },
        {
            type: 'input',
            name: 'jiraProjectKey',
            message: 'Enter your default Jira project key (optional):',
            default: ''
        }
    ];

    try {
        const answers = await inquirer.prompt(questions);
        
        // Create config directory if it doesn't exist
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Prepare configuration object
        const config = {
            jira: {
                baseUrl: answers.jiraBaseUrl,
                username: answers.jiraUsername,
                apiToken: answers.jiraApiToken,
                projectKey: answers.jiraProjectKey || null
            },
            github: {
                token: answers.githubToken,
                defaultBranch: answers.defaultBranch
            },
            aiProviders: {},
            copilot: {
                apiToken: answers.copilotApiToken || null
            },
            createdAt: new Date().toISOString(),
            version: '1.1.0'
        };

        // Configure AI providers based on selection
        if (answers.aiProvider === 'chatgpt') {
            config.aiProviders.openai = {
                apiKey: answers.openaiApiKey,
                model: answers.openaiModel || 'gpt-4o'
            };
        } else if (answers.aiProvider === 'gemini') {
            config.aiProviders.gemini = {
                apiKey: answers.geminiApiKey,
                model: answers.geminiModel || 'gemini-1.5-pro'
            };
        } else if (answers.aiProvider === 'copilot') {
            config.aiProviders.copilot = {
                apiToken: answers.copilotApiToken,
                model: answers.copilotModel || 'gpt-4o'
            };
            // Also keep the legacy copilot config for backward compatibility
            config.copilot.apiToken = answers.copilotApiToken;
        }

        // Save configuration to JSON file
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

        console.log(chalk.green('\n✅ Environment configuration saved successfully!'));
        console.log(chalk.gray(`Global configuration saved to: ${CONFIG_FILE}`));
        
        // Also create .env file for backward compatibility
        let envContent = `# Generated by setup-env.js on ${new Date().toISOString()}
JIRA_BASE_URL=${config.jira.baseUrl}
JIRA_USERNAME=${config.jira.username}
JIRA_API_TOKEN=${config.jira.apiToken}
GITHUB_TOKEN=${config.github.token}
DEFAULT_BRANCH=${config.github.defaultBranch}
${config.jira.projectKey ? `JIRA_PROJECT_KEY=${config.jira.projectKey}` : '# JIRA_PROJECT_KEY='}

# AI Provider Configuration
`;

        // Add AI provider specific environment variables
        if (config.aiProviders.openai) {
            envContent += `OPENAI_API_KEY=${config.aiProviders.openai.apiKey}
OPENAI_MODEL=${config.aiProviders.openai.model}
`;
        } else {
            envContent += `# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4o
`;
        }

        if (config.aiProviders.gemini) {
            envContent += `GEMINI_API_KEY=${config.aiProviders.gemini.apiKey}
GEMINI_MODEL=${config.aiProviders.gemini.model}
`;
        } else {
            envContent += `# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-1.5-pro
`;
        }

        if (config.aiProviders.copilot || config.copilot.apiToken) {
            const token = config.aiProviders.copilot?.apiToken || config.copilot.apiToken;
            const model = config.aiProviders.copilot?.model || 'gpt-4o';
            envContent += `COPILOT_API_TOKEN=${token}
COPILOT_MODEL=${model}
`;
        } else {
            envContent += `# COPILOT_API_TOKEN=
# COPILOT_MODEL=gpt-4o
`;
        }

        const envFile = path.join(__dirname, '..', '.env');
        fs.writeFileSync(envFile, envContent);
        console.log(chalk.gray(`Also created .env file for backward compatibility`));

        console.log(chalk.yellow('\n⚠️  Security Note: Your global configuration contains sensitive tokens. Keep it secure and do not share it.'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error during setup:'), error.message);
        process.exit(1);
    }
}

// Helper function to load configuration
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        throw new Error('Configuration file not found. Please run the setup script first.');
    }
    
    try {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        throw new Error('Failed to parse configuration file: ' + error.message);
    }
}

// Helper function to check if configuration exists
function configExists() {
    return fs.existsSync(CONFIG_FILE);
}

// Helper function to validate configuration
function validateConfig(config) {
    const requiredFields = [
        { path: 'jira.baseUrl', description: 'Jira base URL' },
        { path: 'jira.username', description: 'Jira username' },
        { path: 'jira.apiToken', description: 'Jira API token' },
        { path: 'github.token', description: 'GitHub token' }
    ];
    
    // Check if at least one AI provider is configured
    const hasAIProvider = config.aiProviders && (
        config.aiProviders.openai?.apiKey ||
        config.aiProviders.gemini?.apiKey ||
        config.aiProviders.copilot?.apiToken ||
        config.copilot?.apiToken
    );

    const missing = [];
    
    for (const field of requiredFields) {
        const keys = field.path.split('.');
        let value = config;
        
        for (const key of keys) {
            value = value?.[key];
        }
        
        if (!value) {
            missing.push(field.description);
        }
    }

    if (missing.length > 0) {
        throw new Error(`Configuration is missing required fields: ${missing.join(', ')}`);
    }

    return true;
}

// Helper function to update existing configuration
async function updateConfiguration() {
    if (!configExists()) {
        console.log(chalk.yellow('No existing configuration found. Running initial setup...'));
        return await setupEnvironment();
    }

    console.log(chalk.blue('🔄 Update Configuration'));
    console.log(chalk.gray('Current configuration found. What would you like to update?\n'));

    const currentConfig = loadConfig();
    
    const updateQuestions = [
        {
            type: 'checkbox',
            name: 'fieldsToUpdate',
            message: 'Select which fields to update:',
            choices: [
                { name: 'Jira base URL', value: 'jiraBaseUrl' },
                { name: 'Jira username', value: 'jiraUsername' },
                { name: 'Jira API token', value: 'jiraApiToken' },
                { name: 'GitHub token', value: 'githubToken' },
                { name: 'AI Provider Configuration', value: 'aiProvider' },
                { name: 'Default branch', value: 'defaultBranch' },
                { name: 'Jira project key', value: 'jiraProjectKey' }
            ]
        }
    ];

    const { fieldsToUpdate } = await inquirer.prompt(updateQuestions);
    
    if (fieldsToUpdate.length === 0) {
        console.log(chalk.gray('No fields selected for update.'));
        return;
    }

    // Create update questions for selected fields
    const detailQuestions = [];
    
    if (fieldsToUpdate.includes('jiraBaseUrl')) {
        detailQuestions.push({
            type: 'input',
            name: 'jiraBaseUrl',
            message: `Update Jira base URL (current: ${currentConfig.jira?.baseUrl || 'not set'}):`,
            default: currentConfig.jira?.baseUrl,
            validate: (input) => {
                if (!input.trim()) return 'Jira base URL is required';
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });
    }

    // Add other update questions as needed...
    if (fieldsToUpdate.includes('jiraUsername')) {
        detailQuestions.push({
            type: 'input',
            name: 'jiraUsername',
            message: `Update Jira username (current: ${currentConfig.jira?.username || 'not set'}):`,
            default: currentConfig.jira?.username,
            validate: (input) => input.trim() ? true : 'Jira username is required'
        });
    }

    if (fieldsToUpdate.includes('jiraApiToken')) {
        detailQuestions.push({
            type: 'password',
            name: 'jiraApiToken',
            message: 'Update Jira API token:',
            validate: (input) => input.trim() ? true : 'Jira API token is required'
        });
    }

    if (fieldsToUpdate.includes('githubToken')) {
        detailQuestions.push({
            type: 'password',
            name: 'githubToken',
            message: 'Update GitHub personal access token:',
            validate: (input) => input.trim() ? true : 'GitHub token is required'
        });
    }

    if (fieldsToUpdate.includes('aiProvider')) {
        // First, ask which AI provider to configure
        detailQuestions.push({
            type: 'list',
            name: 'aiProvider',
            message: 'Select AI provider to configure:',
            choices: [
                { name: 'ChatGPT (OpenAI)', value: 'chatgpt' },
                { name: 'Gemini (Google)', value: 'gemini' },
                { name: 'GitHub Copilot', value: 'copilot' },
                { name: 'Remove AI provider configuration', value: 'none' }
            ],
            default: currentConfig.aiProviders?.openai ? 'chatgpt' : 
                     currentConfig.aiProviders?.gemini ? 'gemini' :
                     currentConfig.aiProviders?.copilot ? 'copilot' : 'chatgpt'
        });

        // ChatGPT configuration
        detailQuestions.push({
            type: 'password',
            name: 'openaiApiKey',
            message: `Update OpenAI API key (current: ${currentConfig.aiProviders?.openai?.apiKey ? 'set' : 'not set'}):`,
            when: (answers) => answers.aiProvider === 'chatgpt',
            validate: (input) => input.trim() ? true : 'OpenAI API key is required for ChatGPT'
        });

        detailQuestions.push({
            type: 'input',
            name: 'openaiModel',
            message: 'Update OpenAI model:',
            when: (answers) => answers.aiProvider === 'chatgpt',
            default: currentConfig.aiProviders?.openai?.model || 'gpt-4o'
        });

        // Gemini configuration
        detailQuestions.push({
            type: 'password',
            name: 'geminiApiKey',
            message: `Update Gemini API key (current: ${currentConfig.aiProviders?.gemini?.apiKey ? 'set' : 'not set'}):`,
            when: (answers) => answers.aiProvider === 'gemini',
            validate: (input) => input.trim() ? true : 'Gemini API key is required for Gemini'
        });

        detailQuestions.push({
            type: 'input',
            name: 'geminiModel',
            message: 'Update Gemini model:',
            when: (answers) => answers.aiProvider === 'gemini',
            default: currentConfig.aiProviders?.gemini?.model || 'gemini-1.5-pro'
        });

        // Copilot configuration
        detailQuestions.push({
            type: 'password',
            name: 'copilotApiToken',
            message: `Update GitHub Copilot API token (current: ${currentConfig.aiProviders?.copilot?.apiToken || currentConfig.copilot?.apiToken ? 'set' : 'not set'}):`,
            when: (answers) => answers.aiProvider === 'copilot',
            validate: (input) => input.trim() ? true : 'GitHub Copilot API token is required for Copilot'
        });

        detailQuestions.push({
            type: 'input',
            name: 'copilotModel',
            message: 'Update Copilot model:',
            when: (answers) => answers.aiProvider === 'copilot',
            default: currentConfig.aiProviders?.copilot?.model || 'gpt-4o'
        });
    }

    if (fieldsToUpdate.includes('defaultBranch')) {
        detailQuestions.push({
            type: 'input',
            name: 'defaultBranch',
            message: `Update default branch (current: ${currentConfig.github?.defaultBranch || 'main'}):`,
            default: currentConfig.github?.defaultBranch || 'main'
        });
    }

    if (fieldsToUpdate.includes('jiraProjectKey')) {
        detailQuestions.push({
            type: 'input',
            name: 'jiraProjectKey',
            message: `Update Jira project key (current: ${currentConfig.jira?.projectKey || 'not set'}):`,
            default: currentConfig.jira?.projectKey || ''
        });
    }

    const answers = await inquirer.prompt(detailQuestions);

    // Update the configuration with new values
    const updatedConfig = { ...currentConfig };
    
    if (answers.jiraBaseUrl) updatedConfig.jira.baseUrl = answers.jiraBaseUrl;
    if (answers.jiraUsername) updatedConfig.jira.username = answers.jiraUsername;
    if (answers.jiraApiToken) updatedConfig.jira.apiToken = answers.jiraApiToken;
    if (answers.githubToken) updatedConfig.github.token = answers.githubToken;
    if (answers.defaultBranch) updatedConfig.github.defaultBranch = answers.defaultBranch;
    if (answers.jiraProjectKey !== undefined) updatedConfig.jira.projectKey = answers.jiraProjectKey || null;

    // Handle AI provider updates
    if (answers.aiProvider !== undefined) {
        // Initialize aiProviders if it doesn't exist
        if (!updatedConfig.aiProviders) {
            updatedConfig.aiProviders = {};
        }

        // Clear existing AI provider configurations
        delete updatedConfig.aiProviders.openai;
        delete updatedConfig.aiProviders.gemini;
        delete updatedConfig.aiProviders.copilot;

        // Configure the selected AI provider
        if (answers.aiProvider === 'chatgpt') {
            updatedConfig.aiProviders.openai = {
                apiKey: answers.openaiApiKey,
                model: answers.openaiModel || 'gpt-4o'
            };
        } else if (answers.aiProvider === 'gemini') {
            updatedConfig.aiProviders.gemini = {
                apiKey: answers.geminiApiKey,
                model: answers.geminiModel || 'gemini-1.5-pro'
            };
        } else if (answers.aiProvider === 'copilot') {
            updatedConfig.aiProviders.copilot = {
                apiToken: answers.copilotApiToken,
                model: answers.copilotModel || 'gpt-4o'
            };
            // Also update legacy copilot config for backward compatibility
            updatedConfig.copilot.apiToken = answers.copilotApiToken;
        } else if (answers.aiProvider === 'none') {
            // Clear all AI provider configurations
            updatedConfig.aiProviders = {};
            updatedConfig.copilot.apiToken = null;
        }
    }

    updatedConfig.updatedAt = new Date().toISOString();
    updatedConfig.version = '1.1.0';

    // Save updated configuration
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));
    console.log(chalk.green('\n✅ Global configuration updated successfully!'));
    console.log(chalk.gray(`Updated configuration saved to: ${CONFIG_FILE}`));
}

// Helper function to get specific config values
function getConfig(section, key) {
    const config = loadConfig();
    if (section && key) {
        return config[section] ? config[section][key] : undefined;
    } else if (section) {
        return config[section];
    }
    return config;
}

// Export functions for use in other modules
module.exports = {
    setupEnvironment,
    updateConfiguration,
    loadConfig,
    getConfig,
    configExists,
    validateConfig,
    CONFIG_FILE
};

// Run setup if called directly
if (require.main === module) {
    setupEnvironment();
}