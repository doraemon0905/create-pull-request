#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const { setupGitExtension } = require('./setup-git-extension');

// Import constants from compiled JavaScript
const { CONFIG, DEFAULT_MODELS, SYSTEM } = require('../lib/constants');

// Configuration constants
const CONFIG_DIRECTORY_NAME = CONFIG.DIRECTORY_NAME;
const CONFIG_FILE_NAME = CONFIG.FILE_NAME;
const DEFAULT_CLAUDE_MODEL = DEFAULT_MODELS.CLAUDE;
const DEFAULT_GPT_MODEL = DEFAULT_MODELS.OPENAI;
const DEFAULT_GEMINI_MODEL = DEFAULT_MODELS.GEMINI;
const CONFIG_VERSION = CONFIG.VERSION;
const EXECUTABLE_PERMISSIONS = SYSTEM.EXECUTABLE_PERMISSIONS;

function getConfigFilePath() {
    return path.join(os.homedir(), CONFIG_DIRECTORY_NAME, CONFIG_FILE_NAME);
}

async function setupEnvironment() {
    console.log(chalk.blue('🚀 Environment Setup Wizard'));
    console.log(chalk.gray('This will collect your environment configuration and save it for global use.\n'));

    // Load existing configuration if available
    let existingConfig = null;
    try {
        if (configExists()) {
            existingConfig = loadConfig();
            console.log(chalk.green('✅ Found existing configuration. Using current values as defaults.\n'));
        }
    } catch (error) {
        console.log(chalk.yellow('⚠️  Found config file but could not load it. Starting fresh setup.\n'));
    }

    const questions = [
        {
            type: 'input',
            name: 'jiraBaseUrl',
            message: 'Enter your Jira base URL (e.g., https://your-company.atlassian.net):',
            default: existingConfig?.jira?.baseUrl || '',
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
            default: existingConfig?.jira?.username || '',
            validate: (input) => input.trim() ? true : 'Jira username is required'
        },
        {
            type: 'password',
            name: 'jiraApiToken',
            message: existingConfig?.jira?.apiToken ? 'Enter your Jira API token (leave blank to keep current):' : 'Enter your Jira API token:',
            default: '',
            validate: (input) => {
                // If there's an existing token and input is blank, that's OK
                if (existingConfig?.jira?.apiToken && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'Jira API token is required';
            }
        },
        {
            type: 'password',
            name: 'githubToken',
            message: existingConfig?.github?.token ? 'Enter your GitHub personal access token (leave blank to keep current):' : 'Enter your GitHub personal access token:',
            default: '',
            validate: (input) => {
                // If there's an existing token and input is blank, that's OK
                if (existingConfig?.github?.token && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'GitHub token is required';
            }
        },
        {
            type: 'list',
            name: 'aiProvider',
            message: 'Select your preferred AI provider for PR description generation:',
            choices: [
                { name: 'Claude (Anthropic) - Recommended', value: 'claude' },
                { name: 'ChatGPT (OpenAI)', value: 'chatgpt' },
                { name: 'Gemini (Google)', value: 'gemini' },
                { name: 'GitHub Copilot', value: 'copilot' },
                { name: 'Skip AI provider setup', value: 'none' }
            ],
            default: existingConfig?.aiProviders?.claude ? 'claude' :
                     existingConfig?.aiProviders?.openai ? 'chatgpt' :
                     existingConfig?.aiProviders?.gemini ? 'gemini' :
                     existingConfig?.aiProviders?.copilot || existingConfig?.copilot?.apiToken ? 'copilot' :
                     'claude'
        },
        {
            type: 'password',
            name: 'claudeApiKey',
            message: (answers) => {
                const hasExisting = existingConfig?.aiProviders?.claude?.apiKey;
                return hasExisting ? 'Enter your Anthropic API key (leave blank to keep current):' : 'Enter your Anthropic API key:';
            },
            when: (answers) => answers.aiProvider === 'claude',
            default: '',
            validate: (input, answers) => {
                // If there's an existing key and input is blank, that's OK
                if (existingConfig?.aiProviders?.claude?.apiKey && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'Anthropic API key is required for Claude';
            }
        },
        {
            type: 'input',
            name: 'claudeModel',
            message: 'Enter Claude model to use:',
            when: (answers) => answers.aiProvider === 'claude',
            default: existingConfig?.aiProviders?.claude?.model || DEFAULT_CLAUDE_MODEL
        },
        {
            type: 'password',
            name: 'openaiApiKey',
            message: (answers) => {
                const hasExisting = existingConfig?.aiProviders?.openai?.apiKey;
                return hasExisting ? 'Enter your OpenAI API key (leave blank to keep current):' : 'Enter your OpenAI API key:';
            },
            when: (answers) => answers.aiProvider === 'chatgpt',
            default: '',
            validate: (input, answers) => {
                // If there's an existing key and input is blank, that's OK
                if (existingConfig?.aiProviders?.openai?.apiKey && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'OpenAI API key is required for ChatGPT';
            }
        },
        {
            type: 'input',
            name: 'openaiModel',
            message: 'Enter OpenAI model to use:',
            when: (answers) => answers.aiProvider === 'chatgpt',
            default: existingConfig?.aiProviders?.openai?.model || DEFAULT_GPT_MODEL
        },
        {
            type: 'password',
            name: 'geminiApiKey',
            message: (answers) => {
                const hasExisting = existingConfig?.aiProviders?.gemini?.apiKey;
                return hasExisting ? 'Enter your Gemini API key (leave blank to keep current):' : 'Enter your Gemini API key:';
            },
            when: (answers) => answers.aiProvider === 'gemini',
            default: '',
            validate: (input) => {
                // If there's an existing key and input is blank, that's OK
                if (existingConfig?.aiProviders?.gemini?.apiKey && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'Gemini API key is required for Gemini';
            }
        },
        {
            type: 'input',
            name: 'geminiModel',
            message: 'Enter Gemini model to use:',
            when: (answers) => answers.aiProvider === 'gemini',
            default: existingConfig?.aiProviders?.gemini?.model || DEFAULT_GEMINI_MODEL
        },
        {
            type: 'password',
            name: 'copilotApiToken',
            message: (answers) => {
                const hasExisting = existingConfig?.aiProviders?.copilot?.apiToken || existingConfig?.copilot?.apiToken;
                return hasExisting ? 'Enter your GitHub Copilot API token (leave blank to keep current):' : 'Enter your GitHub Copilot API token:';
            },
            when: (answers) => answers.aiProvider === 'copilot',
            default: '',
            validate: (input) => {
                // If there's an existing token and input is blank, that's OK
                const hasExisting = existingConfig?.aiProviders?.copilot?.apiToken || existingConfig?.copilot?.apiToken;
                if (hasExisting && !input.trim()) {
                    return true;
                }
                return input.trim() ? true : 'GitHub Copilot API token is required for Copilot';
            }
        },
        {
            type: 'input',
            name: 'copilotModel',
            message: 'Enter Copilot model to use:',
            when: (answers) => answers.aiProvider === 'copilot',
            default: existingConfig?.aiProviders?.copilot?.model || DEFAULT_GPT_MODEL
        },
        {
            type: 'input',
            name: 'defaultBranch',
            message: 'Enter your default branch name:',
            default: existingConfig?.github?.defaultBranch || 'main'
        },
        {
            type: 'input',
            name: 'jiraProjectKey',
            message: 'Enter your default Jira project key (optional):',
            default: existingConfig?.jira?.projectKey || ''
        },
        {
            type: 'confirm',
            name: 'setupGitExtension',
            message: 'Set up git extension to enable "git create-pr" command?',
            default: true
        }
    ];

    try {
        const answers = await inquirer.prompt(questions);
        
        // Create config directory if it doesn't exist
        const configDir = path.dirname(getConfigFilePath());
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Prepare configuration object, preserving existing values if user left fields blank
        const config = {
            jira: {
                baseUrl: answers.jiraBaseUrl,
                username: answers.jiraUsername,
                apiToken: answers.jiraApiToken || existingConfig?.jira?.apiToken,
                projectKey: answers.jiraProjectKey || existingConfig?.jira?.projectKey || null
            },
            github: {
                token: answers.githubToken || existingConfig?.github?.token,
                defaultBranch: answers.defaultBranch
            },
            aiProviders: existingConfig?.aiProviders || {},
            copilot: {
                apiToken: answers.copilotApiToken || existingConfig?.copilot?.apiToken || null
            },
            createdAt: existingConfig?.createdAt || new Date().toISOString(),
            updatedAt: existingConfig ? new Date().toISOString() : undefined,
            version: CONFIG_VERSION
        };

        // Configure AI providers based on selection
        if (answers.aiProvider === 'claude') {
            config.aiProviders.claude = {
                apiKey: answers.claudeApiKey || existingConfig?.aiProviders?.claude?.apiKey,
                model: answers.claudeModel || existingConfig?.aiProviders?.claude?.model || DEFAULT_CLAUDE_MODEL
            };
        } else if (answers.aiProvider === 'chatgpt') {
            config.aiProviders.openai = {
                apiKey: answers.openaiApiKey || existingConfig?.aiProviders?.openai?.apiKey,
                model: answers.openaiModel || existingConfig?.aiProviders?.openai?.model || DEFAULT_GPT_MODEL
            };
        } else if (answers.aiProvider === 'gemini') {
            config.aiProviders.gemini = {
                apiKey: answers.geminiApiKey || existingConfig?.aiProviders?.gemini?.apiKey,
                model: answers.geminiModel || existingConfig?.aiProviders?.gemini?.model || DEFAULT_GEMINI_MODEL
            };
        } else if (answers.aiProvider === 'copilot') {
            const copilotToken = answers.copilotApiToken || existingConfig?.aiProviders?.copilot?.apiToken || existingConfig?.copilot?.apiToken;
            config.aiProviders.copilot = {
                apiToken: copilotToken,
                model: answers.copilotModel || existingConfig?.aiProviders?.copilot?.model || DEFAULT_GPT_MODEL
            };
            // Also keep the legacy copilot config for backward compatibility
            config.copilot.apiToken = copilotToken;
        }

        // Save configuration to JSON file
        fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2));

        console.log(chalk.green('\n✅ Environment configuration saved successfully!'));
        console.log(chalk.gray(`Global configuration saved to: ${getConfigFilePath()}`));
        
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
        if (config.aiProviders.claude) {
            envContent += `ANTHROPIC_API_KEY=${config.aiProviders.claude.apiKey}
CLAUDE_API_KEY=${config.aiProviders.claude.apiKey}
CLAUDE_MODEL=${config.aiProviders.claude.model}
`;
        } else {
            envContent += `# ANTHROPIC_API_KEY=
# CLAUDE_API_KEY=
# CLAUDE_MODEL=claude-3-5-sonnet-20241022
`;
        }

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
            const model = config.aiProviders.copilot?.model || DEFAULT_GPT_MODEL;
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

        // Set up git extension if requested
        if (answers.setupGitExtension) {
            console.log(chalk.blue('\n🔧 Setting up git extension...'));
            const gitExtensionSetup = setupGitExtension();
            if (gitExtensionSetup) {
                console.log(chalk.green('✅ Git extension setup completed!'));
                console.log(chalk.gray('You can now use "git create-pr" command after updating your PATH.'));
            } else {
                console.log(chalk.yellow('⚠️  Git extension setup encountered issues. You can still use "create-pr" directly.'));
            }
        }

        console.log(chalk.yellow('\n⚠️  Security Note: Your global configuration contains sensitive tokens. Keep it secure and do not share it.'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error during setup:'), error.message);
        process.exit(1);
    }
}

// Helper function to load configuration
function loadConfig() {
    if (!fs.existsSync(getConfigFilePath())) {
        throw new Error('Configuration file not found. Please run the setup script first.');
    }
    
    try {
        const configData = fs.readFileSync(getConfigFilePath(), 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        throw new Error('Failed to parse configuration file: ' + error.message);
    }
}

// Helper function to check if configuration exists
function configExists() {
    return fs.existsSync(getConfigFilePath());
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
        config.aiProviders.claude?.apiKey ||
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
                { name: 'Claude (Anthropic) - Recommended', value: 'claude' },
                { name: 'ChatGPT (OpenAI)', value: 'chatgpt' },
                { name: 'Gemini (Google)', value: 'gemini' },
                { name: 'GitHub Copilot', value: 'copilot' },
                { name: 'Remove AI provider configuration', value: 'none' }
            ],
            default: currentConfig.aiProviders?.claude ? 'claude' :
                     currentConfig.aiProviders?.openai ? 'chatgpt' : 
                     currentConfig.aiProviders?.gemini ? 'gemini' :
                     currentConfig.aiProviders?.copilot ? 'copilot' : 'claude'
        });

        // Claude configuration
        detailQuestions.push({
            type: 'password',
            name: 'claudeApiKey',
            message: `Update Anthropic API key (current: ${currentConfig.aiProviders?.claude?.apiKey ? 'set' : 'not set'}):`,
            when: (answers) => answers.aiProvider === 'claude',
            validate: (input) => input.trim() ? true : 'Anthropic API key is required for Claude'
        });

        detailQuestions.push({
            type: 'input',
            name: 'claudeModel',
            message: 'Update Claude model:',
            when: (answers) => answers.aiProvider === 'claude',
            default: currentConfig.aiProviders?.claude?.model || DEFAULT_CLAUDE_MODEL
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
            default: currentConfig.aiProviders?.openai?.model || DEFAULT_GPT_MODEL
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
            default: currentConfig.aiProviders?.gemini?.model || DEFAULT_GEMINI_MODEL
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
            default: currentConfig.aiProviders?.copilot?.model || DEFAULT_GPT_MODEL
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
        delete updatedConfig.aiProviders.claude;
        delete updatedConfig.aiProviders.openai;
        delete updatedConfig.aiProviders.gemini;
        delete updatedConfig.aiProviders.copilot;

        // Configure the selected AI provider
        if (answers.aiProvider === 'claude') {
            updatedConfig.aiProviders.claude = {
                apiKey: answers.claudeApiKey,
                model: answers.claudeModel || DEFAULT_CLAUDE_MODEL
            };
        } else if (answers.aiProvider === 'chatgpt') {
            updatedConfig.aiProviders.openai = {
                apiKey: answers.openaiApiKey,
                model: answers.openaiModel || DEFAULT_GPT_MODEL
            };
        } else if (answers.aiProvider === 'gemini') {
            updatedConfig.aiProviders.gemini = {
                apiKey: answers.geminiApiKey,
                model: answers.geminiModel || DEFAULT_GEMINI_MODEL
            };
        } else if (answers.aiProvider === 'copilot') {
            updatedConfig.aiProviders.copilot = {
                apiToken: answers.copilotApiToken,
                model: answers.copilotModel || DEFAULT_GPT_MODEL
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
    updatedConfig.version = CONFIG_VERSION;

    // Save updated configuration
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(updatedConfig, null, 2));
    console.log(chalk.green('\n✅ Global configuration updated successfully!'));
    console.log(chalk.gray(`Updated configuration saved to: ${getConfigFilePath()}`));
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
    getConfigFilePath
};

// Run setup if called directly
if (require.main === module) {
    setupEnvironment();
}