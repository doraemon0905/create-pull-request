import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { JiraService } from '../services/jira';
import { GitHubService } from '../services/github';
import { GitService } from '../services/git';
import { CopilotService } from '../services/copilot';
import { validateJiraTicket, validateGitRepository } from '../utils/validation';

export interface CreatePROptions {
  jira?: string;
  base?: string;
  title?: string;
  dryRun?: boolean;
}

export async function createPullRequest(options: CreatePROptions): Promise<void> {
  const spinner = ora();

  try {
    // Validate git repository
    validateGitRepository();

    // Initialize services
    const jiraService = new JiraService();
    const githubService = new GitHubService();
    const gitService = new GitService();
    const copilotService = new CopilotService();

    // Validate git repository
    await gitService.validateRepository();

    // Check for uncommitted changes
    const hasUncommitted = await gitService.hasUncommittedChanges();
    if (hasUncommitted) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'You have uncommitted changes. Do you want to proceed anyway?',
        default: false
      }]);

      if (!proceed) {
        console.log(chalk.yellow('❌ Aborting. Please commit or stash your changes first.'));
        return;
      }
    }

    // Get Jira ticket
    let jiraTicket = options.jira;
    if (!jiraTicket) {
      const { ticket } = await inquirer.prompt([{
        type: 'input',
        name: 'ticket',
        message: 'Enter Jira ticket ID (e.g., PROJ-123):',
        validate: (input: string) => {
          if (!input.trim()) return 'Jira ticket ID is required';
          if (!validateJiraTicket(input.trim())) {
            return 'Invalid Jira ticket format. Expected format: PROJECT-123';
          }
          return true;
        }
      }]);
      jiraTicket = ticket.trim().toUpperCase();
    }

    if (!validateJiraTicket(jiraTicket!)) {
      throw new Error(`Invalid Jira ticket format: ${jiraTicket}. Expected format: PROJECT-123`);
    }

    // Fetch Jira ticket information
    spinner.start('Fetching Jira ticket information...');
    const ticketInfo = await jiraService.getTicket(jiraTicket!);
    spinner.succeed(`Fetched Jira ticket: ${ticketInfo.key} - ${ticketInfo.summary}`);

    // Get current branch and repository info
    spinner.start('Analyzing repository and changes...');
    const currentBranch = await gitService.getCurrentBranch();
    const baseBranch = options.base || 'main';
    
    // Validate base branch exists
    const baseExists = await gitService.branchExists(baseBranch);
    if (!baseExists) {
      throw new Error(`Base branch '${baseBranch}' does not exist`);
    }

    // Get git changes
    const gitChanges = await gitService.getChanges(baseBranch);
    const repo = await githubService.getCurrentRepo();
    spinner.succeed(`Repository: ${repo.owner}/${repo.repo}, Branch: ${currentBranch}`);

    if (gitChanges.totalFiles === 0) {
      throw new Error(`No changes detected between '${baseBranch}' and '${currentBranch}'`);
    }

    console.log(chalk.blue(`\n📊 Changes Summary:`));
    console.log(`   Files changed: ${gitChanges.totalFiles}`);
    console.log(`   Insertions: +${gitChanges.totalInsertions}`);
    console.log(`   Deletions: -${gitChanges.totalDeletions}`);

    // Get PR templates
    spinner.start('Looking for pull request templates...');
    const templates = await githubService.getPullRequestTemplates(repo);
    let selectedTemplate = templates.length > 0 ? templates[0] : undefined;

    if (templates.length > 1) {
      spinner.stop();
      const { template } = await inquirer.prompt([{
        type: 'list',
        name: 'template',
        message: 'Select a pull request template:',
        choices: [
          { name: 'No template', value: null },
          ...templates.map(t => ({ name: t.name, value: t }))
        ]
      }]);
      selectedTemplate = template;
      spinner.start();
    }

    if (selectedTemplate) {
      spinner.succeed(`Using PR template: ${selectedTemplate.name}`);
    } else {
      spinner.succeed('No PR template found, using default format');
    }

    // Get diff content for better context
    spinner.start('Analyzing code changes...');
    const diffContent = await gitService.getDiffContent(baseBranch, 500);
    spinner.succeed('Code analysis complete');

    // Generate PR description using Copilot
    spinner.start('Generating pull request description with AI...');
    const generatedContent = await copilotService.generatePRDescription({
      jiraTicket: ticketInfo,
      gitChanges,
      template: selectedTemplate,
      diffContent,
      prTitle: options.title
    });
    spinner.succeed('Pull request description generated');

    // Show generated content for review
    console.log(chalk.blue('\n📝 Generated Pull Request:'));
    console.log(chalk.bold('Title:'));
    console.log(generatedContent.title);
    console.log(chalk.bold('\nDescription:'));
    console.log(generatedContent.body);

    // Ask for user confirmation
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '✅ Create the pull request', value: 'create' },
        { name: '✏️  Edit the description', value: 'edit' },
        { name: '❌ Cancel', value: 'cancel' }
      ]
    }]);

    if (action === 'cancel') {
      console.log(chalk.yellow('❌ Pull request creation cancelled.'));
      return;
    }

    let finalTitle = generatedContent.title;
    let finalBody = generatedContent.body;

    if (action === 'edit') {
      const { editedTitle, editedBody } = await inquirer.prompt([
        {
          type: 'input',
          name: 'editedTitle',
          message: 'Enter pull request title:',
          default: finalTitle
        },
        {
          type: 'editor',
          name: 'editedBody',
          message: 'Edit pull request description:',
          default: finalBody
        }
      ]);

      finalTitle = editedTitle;
      finalBody = editedBody;
    }

    // Create pull request or show dry run
    if (options.dryRun) {
      console.log(chalk.blue('\n🔍 Dry Run - Pull Request Preview:'));
      console.log(chalk.bold('Repository:'), `${repo.owner}/${repo.repo}`);
      console.log(chalk.bold('From:'), currentBranch);
      console.log(chalk.bold('To:'), baseBranch);
      console.log(chalk.bold('Title:'), finalTitle);
      console.log(chalk.bold('Body:'), finalBody);
      console.log(chalk.green('\n✅ Dry run completed. No pull request was created.'));
    } else {
      spinner.start('Creating pull request on GitHub...');
      
      const pullRequest = await githubService.createPullRequest(repo, {
        title: finalTitle,
        body: finalBody,
        head: currentBranch,
        base: baseBranch
      });

      spinner.succeed('Pull request created successfully!');
      
      console.log(chalk.green('\n🎉 Pull Request Created:'));
      console.log(chalk.bold('URL:'), pullRequest.html_url);
      console.log(chalk.bold('Number:'), `#${pullRequest.number}`);
      console.log(chalk.bold('Title:'), pullRequest.title);
    }

  } catch (error) {
    if (spinner.isSpinning) {
      spinner.fail('Operation failed');
    }
    throw error;
  }
}