#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { createPullRequest } from './commands/create-pr';
import { validateEnvironment } from './utils/validation';

config();

const program = new Command();

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
      console.log(chalk.blue('🚀 Starting pull request creation process...\n'));
      
      // Validate environment variables
      validateEnvironment();
      
      await createPullRequest(options);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration and setup instructions')
  .action(() => {
    console.log(chalk.blue('📋 Configuration Setup:\n'));
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your credentials:\n');
    console.log(chalk.yellow('   JIRA_BASE_URL') + '=https://your-company.atlassian.net');
    console.log(chalk.yellow('   JIRA_USERNAME') + '=your-email@company.com');
    console.log(chalk.yellow('   JIRA_API_TOKEN') + '=your-jira-api-token');
    console.log(chalk.yellow('   GITHUB_TOKEN') + '=your-github-personal-access-token\n');
    console.log('3. Make sure your GitHub token has repo permissions');
    console.log('4. For Jira, generate an API token from your Atlassian account settings');
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);