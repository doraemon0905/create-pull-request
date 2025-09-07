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
if (process.argv.length === 2) {
    program.help();
}
program.parse(process.argv);
//# sourceMappingURL=index.js.map