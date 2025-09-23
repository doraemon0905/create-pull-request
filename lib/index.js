#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = require("dotenv");
const create_pr_1 = require("./commands/create-pr");
const validation_1 = require("./utils/validation");
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const constants_1 = require("./constants");
(0, dotenv_1.config)();
const program = new commander_1.Command();
program
    .name(constants_1.CONFIG.CLI_NAME)
    .description('CLI tool to automatically generate pull request descriptions based on Jira tickets and file changes')
    .version(constants_1.CONFIG.CLI_VERSION);
program
    .command('create')
    .description('Create a pull request with auto-generated description')
    .option('-j, --jira <ticket>', 'Jira ticket ID (e.g., PROJ-123). If not provided, will attempt to extract from branch name')
    .option('-b, --base <branch>', 'Base branch for the pull request', constants_1.CONFIG.DEFAULT_BRANCH)
    .option('-t, --title <title>', 'Pull request title (optional)')
    .option('-d, --draft', 'Create as draft pull request')
    .option('--dry-run', 'Generate description without creating PR')
    .action(async (options) => {
    try {
        console.log(chalk_1.default.blue('🚀 Starting pull request creation process...\n'));
        // Validate environment variables
        (0, validation_1.validateEnvironment)();
        await (0, create_pr_1.createPullRequest)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
program
    .command('config')
    .description('Show current configuration and setup instructions')
    .action(() => {
    console.log(chalk_1.default.blue('📋 Configuration Setup:\n'));
    console.log('🎯 ' + chalk_1.default.bold('Recommended: Use the interactive setup wizard'));
    console.log(chalk_1.default.green('   Run: ') + chalk_1.default.yellow('create-pr setup') + chalk_1.default.gray(' (sets up global config automatically)\n'));
    console.log('⚙️  ' + chalk_1.default.bold('Alternative: Manual configuration'));
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your credentials:\n');
    console.log(chalk_1.default.yellow('   JIRA_BASE_URL') + '=https://your-company.atlassian.net');
    console.log(chalk_1.default.yellow('   JIRA_USERNAME') + '=your-email@company.com');
    console.log(chalk_1.default.yellow('   JIRA_API_TOKEN') + '=your-jira-api-token');
    console.log(chalk_1.default.yellow('   GITHUB_TOKEN') + '=your-github-personal-access-token');
    console.log('\n🤖 ' + chalk_1.default.bold('AI Providers (Primary: Claude Code → ChatGPT → Fallback: Gemini → Copilot):'));
    console.log(chalk_1.default.yellow('   OPENAI_API_KEY') + '=your-openai-api-key ' + chalk_1.default.gray('(fallback)'));
    console.log(chalk_1.default.yellow('   GEMINI_API_KEY') + '=your-gemini-api-key ' + chalk_1.default.gray('(fallback)'));
    console.log(chalk_1.default.yellow('   ANTHROPIC_API_KEY') + '=your-anthropic-api-key ' + chalk_1.default.gray('(recommended)'));
    console.log(chalk_1.default.yellow('   COPILOT_API_TOKEN') + '=your-copilot-api-token ' + chalk_1.default.gray('(fallback)\n'));
    console.log('📝 ' + chalk_1.default.bold('Important notes:'));
    console.log('• Make sure your GitHub token has repo permissions');
    console.log('• For Jira, generate an API token from your Atlassian account settings');
    console.log('• The tool will automatically prioritize ChatGPT → Gemini → Copilot');
    console.log('• At least one AI provider is required for generating PR descriptions');
    console.log('• The setup wizard creates a global config file for easier management');
    console.log('• Jira ticket IDs will be auto-detected from branch names (e.g., ft/ET-123, feature-PROJ-456)');
});
program
    .command('setup')
    .description('Run interactive environment setup wizard')
    .action(async () => {
    try {
        console.log(chalk_1.default.blue('🛠️  Starting environment setup wizard...\n'));
        const setupScript = node_path_1.default.join(__dirname, '..', 'scripts', 'setup-env.js');
        const setupProcess = (0, node_child_process_1.spawn)('node', [setupScript], {
            stdio: 'inherit',
            shell: true
        });
        setupProcess.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('\n✅ Setup completed successfully!'));
                console.log(chalk_1.default.gray('You can now use "create-pr create" to generate pull requests.'));
            }
            else {
                console.error(chalk_1.default.red('\n❌ Setup failed with exit code:'), code);
                process.exit(1);
            }
        });
        setupProcess.on('error', (error) => {
            console.error(chalk_1.default.red('\n❌ Failed to run setup:'), error.message);
            process.exit(1);
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
program
    .command('git-extension')
    .description('Set up git extension to enable "git create-pr" command')
    .action(async () => {
    try {
        console.log(chalk_1.default.blue('🔧 Setting up git extension...\n'));
        const setupScript = node_path_1.default.join(__dirname, '..', 'scripts', 'setup-git-extension.js');
        const setupProcess = (0, node_child_process_1.spawn)('node', [setupScript], {
            stdio: 'inherit',
            shell: true
        });
        setupProcess.on('close', (code) => {
            if (code === 0) {
                console.log(chalk_1.default.green('\n✅ Git extension setup completed!'));
                console.log(chalk_1.default.gray('You can now use "git create-pr" command after updating your PATH.'));
            }
            else {
                console.error(chalk_1.default.red('\n❌ Git extension setup failed with exit code:'), code);
                process.exit(1);
            }
        });
        setupProcess.on('error', (error) => {
            console.error(chalk_1.default.red('\n❌ Failed to run git extension setup:'), error.message);
            process.exit(1);
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
if (process.argv.length === 2) {
    program.help();
}
program.parse(process.argv);
//# sourceMappingURL=index.js.map