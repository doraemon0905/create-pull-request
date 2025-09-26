#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { createPullRequest } from './commands/create-pr.js';
import { validateEnvironment } from './utils/validation.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { CONFIG } from './constants/index.js';

config();

const program = new Command();

program
  .name(CONFIG.CLI_NAME)
  .description('CLI tool to automatically generate pull request descriptions based on Jira tickets and file changes')
  .version(CONFIG.CLI_VERSION);

program
  .command('create')
  .description('Create a pull request with auto-generated description')
  .option('-j, --jira <ticket>', 'Jira ticket ID (e.g., PROJ-123). If not provided, will attempt to extract from branch name')
  .option('-b, --base <branch>', 'Base branch for the pull request', CONFIG.DEFAULT_BRANCH)
  .option('-t, --title <title>', 'Pull request title (optional)')
  .option('-d, --draft', 'Create as draft pull request')
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
    console.log('🎯 ' + chalk.bold('Recommended: Use the interactive setup wizard'));
    console.log(chalk.green('   Run: ') + chalk.yellow('create-pr setup') + chalk.gray(' (sets up global config automatically)\n'));
    
    console.log('⚙️  ' + chalk.bold('Alternative: Manual configuration'));
    console.log('1. Copy .env.example to .env');
    console.log('2. Fill in your credentials:\n');
    console.log(chalk.yellow('   JIRA_BASE_URL') + '=https://your-company.atlassian.net');
    console.log(chalk.yellow('   JIRA_USERNAME') + '=your-email@company.com');
    console.log(chalk.yellow('   JIRA_API_TOKEN') + '=your-jira-api-token');
    console.log(chalk.yellow('   GITHUB_TOKEN') + '=your-github-personal-access-token');
    console.log('\n🤖 ' + chalk.bold('AI Providers (Primary: Claude Code → ChatGPT → Fallback: Gemini → Copilot):'));
    console.log(chalk.yellow('   OPENAI_API_KEY') + '=your-openai-api-key ' + chalk.gray('(fallback)'));
    console.log(chalk.yellow('   GEMINI_API_KEY') + '=your-gemini-api-key ' + chalk.gray('(fallback)'));
    console.log(chalk.yellow('   ANTHROPIC_API_KEY') + '=your-anthropic-api-key ' + chalk.gray('(recommended)'));
    console.log(chalk.yellow('   COPILOT_API_TOKEN') + '=your-copilot-api-token ' + chalk.gray('(fallback)\n'));
    
    console.log('📝 ' + chalk.bold('Important notes:'));
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
      console.log(chalk.blue('🛠️  Starting environment setup wizard...\n'));
      
      const setupScript = path.join(__dirname, '..', 'scripts', 'setup-env.js');
      
      const setupProcess = spawn('node', [setupScript], {
        stdio: 'inherit',
        shell: true
      });
      
      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\n✅ Setup completed successfully!'));
          console.log(chalk.gray('You can now use "create-pr create" to generate pull requests.'));
        } else {
          console.error(chalk.red('\n❌ Setup failed with exit code:'), code);
          process.exit(1);
        }
      });
      
      setupProcess.on('error', (error) => {
        console.error(chalk.red('\n❌ Failed to run setup:'), error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('git-extension')
  .description('Set up git extension to enable "git create-pr" command')
  .action(async () => {
    try {
      console.log(chalk.blue('🔧 Setting up git extension...\n'));
      
      const setupScript = path.join(__dirname, '..', 'scripts', 'setup-git-extension.js');
      
      const setupProcess = spawn('node', [setupScript], {
        stdio: 'inherit',
        shell: true
      });
      
      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\n✅ Git extension setup completed!'));
          console.log(chalk.gray('You can now use "git create-pr" command after updating your PATH.'));
        } else {
          console.error(chalk.red('\n❌ Git extension setup failed with exit code:'), code);
          process.exit(1);
        }
      });
      
      setupProcess.on('error', (error) => {
        console.error(chalk.red('\n❌ Failed to run git extension setup:'), error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
