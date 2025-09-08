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
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
(0, dotenv_1.config)();
const program = new commander_1.Command();
program
    .name('create-pr')
    .description('CLI tool to automatically generate pull request descriptions based on Jira tickets and file changes')
    .version('1.0.0');
program
    .command('create')
    .description('Create a pull request with auto-generated description')
    .option('-j, --jira <ticket>', 'Jira ticket ID (e.g., PROJ-123)')
    .option('-b, --base <branch>', 'Base branch for the pull request', 'main')
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
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your credentials:\n');
    console.log(chalk_1.default.yellow('   JIRA_BASE_URL') + '=https://your-company.atlassian.net');
    console.log(chalk_1.default.yellow('   JIRA_USERNAME') + '=your-email@company.com');
    console.log(chalk_1.default.yellow('   JIRA_API_TOKEN') + '=your-jira-api-token');
    console.log(chalk_1.default.yellow('   GITHUB_TOKEN') + '=your-github-personal-access-token\n');
    console.log('3. Make sure your GitHub token has repo permissions');
    console.log('4. For Jira, generate an API token from your Atlassian account settings');
});
program
    .command('setup')
    .description('Run interactive environment setup wizard')
    .action(async () => {
    try {
        console.log(chalk_1.default.blue('🛠️  Starting environment setup wizard...\n'));
        const setupScript = path_1.default.join(__dirname, '..', 'scripts', 'setup-env.js');
        const setupProcess = (0, child_process_1.spawn)('node', [setupScript], {
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
if (process.argv.length === 2) {
    program.help();
}
program.parse(process.argv);
//# sourceMappingURL=index.js.map