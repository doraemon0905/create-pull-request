import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from '../utils/spinner.js';
import { JiraService } from '../services/atlassian-facade.js';
import { GitHubService } from '../services/github.js';
import { GitService } from '../services/git.js';
import { AIDescriptionGeneratorService } from '../services/ai-description-generator.js';
import { validateJiraTicket, validateGitRepository, extractJiraTicketFromBranch } from '../utils/validation.js';
import { CONFIG } from '../constants/index.js';

export interface CreatePROptions {
  jira?: string;
  base?: string;
  title?: string;
  dryRun?: boolean;
  draft?: boolean;
}

export async function createPullRequest(options: CreatePROptions): Promise<void> {
  const spinner = createSpinner();

  try {
    // Validate git repository
    validateGitRepository();

    // Initialize services
    const jiraService = new JiraService();
    const githubService = new GitHubService();
    const gitService = new GitService();
    const aiDescriptionService = new AIDescriptionGeneratorService();

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

    // Get current branch first to potentially extract Jira ticket from it
    spinner.start('Analyzing repository and changes...');
    const currentBranch = await gitService.getCurrentBranch();

    // Get Jira ticket - try to extract from branch name if not provided
    let jiraTicket = options.jira;
    if (!jiraTicket) {
      // Try to extract Jira ticket ID from branch name
      const extractedTicket = extractJiraTicketFromBranch(currentBranch);
      if (extractedTicket) {
        jiraTicket = extractedTicket;
        console.log(chalk.green(`✅ Detected Jira ticket from branch name: ${jiraTicket}`));
      }
    }

    // If still no ticket, prompt user
    if (!jiraTicket) {
      spinner.stop();
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
      spinner.start('Analyzing repository and changes...');
    }

    if (!validateJiraTicket(jiraTicket!)) {
      throw new Error(`Invalid Jira ticket format: ${jiraTicket}. Expected format: PROJECT-123`);
    }

    // Fetch Jira ticket information (without Confluence pages initially)
    spinner.text = 'Fetching Jira ticket information...';
    let ticketInfo = await jiraService.getTicket(jiraTicket!);
    spinner.succeed('Jira ticket information fetched');

    console.log(chalk.green(`🎫 Using Jira ticket: ${ticketInfo.key} - ${ticketInfo.summary}`));

    // Check for Confluence pages and ask user if they want to include them
    spinner.start('Checking for linked Confluence pages...');
    const hasConfluence = await jiraService.hasConfluencePages(jiraTicket!);

    if (hasConfluence) {
      spinner.succeed('Found linked Confluence pages');
      const { includeConfluence } = await inquirer.prompt([{
        type: 'confirm',
        name: 'includeConfluence',
        message: 'Include Confluence page content in PR summary generation?',
        default: false
      }]);

      if (includeConfluence) {
        spinner.start('Fetching Confluence pages content...');
        ticketInfo = await jiraService.getTicket(jiraTicket!, true);
        spinner.succeed(`Loaded ${ticketInfo.confluencePages?.length || 0} Confluence page(s)`);

        if (ticketInfo.confluencePages && ticketInfo.confluencePages.length > 0) {
          console.log(chalk.blue('📄 Confluence pages found:'));
          for (const page of ticketInfo.confluencePages) {
            console.log(chalk.blue(`   • ${page.title}`));
          }
        }
      } else {
        console.log(chalk.yellow('⏭️  Skipping Confluence content'));
      }
    } else {
      spinner.succeed('No Confluence pages linked to this ticket');
    }

    spinner.start('Analyzing repository and changes...');
    const baseBranch = options.base || CONFIG.DEFAULT_BRANCH;

    // Validate base branch exists
    const baseExists = await gitService.branchExists(baseBranch);
    if (!baseExists) {
      throw new Error(`Base branch '${baseBranch}' does not exist`);
    }

    // Get git changes with detailed diff content for enhanced PR description
    const gitChanges = await gitService.getChanges(baseBranch, true);
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
    const templates = await githubService.getPullRequestTemplates();
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

    // Generate PR description using AI with retry capability
    spinner.start('Generating pull request description with AI...');
    let generatedContent: any = null;
    try {
      generatedContent = await aiDescriptionService.generatePRDescription({
        jiraTicket: ticketInfo,
        gitChanges,
        template: selectedTemplate,
        diffContent,
        prTitle: options.title,
        repoInfo: {
          owner: repo.owner,
          repo: repo.repo,
          currentBranch: currentBranch
        }
      });
      spinner.succeed('Pull request description generated');
    } catch (error) {
      spinner.fail('Failed to generate pull request description');
      console.log(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));

      const { retry } = await inquirer.prompt([{
        type: 'confirm',
        name: 'retry',
        message: 'Would you like to retry generating the summary?',
        default: true
      }]);

      if (!retry) {
        throw error;
      }

      // Retry generating the description
      let retryAttempt = 1;
      const maxRetries = 3;

      while (retryAttempt <= maxRetries) {
        try {
          spinner.start(`Retrying pull request description generation (attempt ${retryAttempt}/${maxRetries})...`);
          generatedContent = await aiDescriptionService.generatePRDescription({
            jiraTicket: ticketInfo,
            gitChanges,
            template: selectedTemplate,
            diffContent,
            prTitle: options.title,
            repoInfo: {
              owner: repo.owner,
              repo: repo.repo,
              currentBranch: currentBranch
            }
          });
          spinner.succeed('Pull request description generated successfully');
          break;
        } catch (retryError) {
          retryAttempt++;
          spinner.fail(`Retry attempt ${retryAttempt - 1} failed`);

          if (retryAttempt <= maxRetries) {
            console.log(chalk.yellow(`⚠️  Attempt ${retryAttempt - 1} failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`));

            const { continueRetry } = await inquirer.prompt([{
              type: 'confirm',
              name: 'continueRetry',
              message: `Retry attempt ${retryAttempt - 1} of ${maxRetries} failed. Continue retrying?`,
              default: true
            }]);

            if (!continueRetry) {
              throw retryError;
            }
          } else {
            console.log(chalk.red(`❌ All retry attempts failed. Last error: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`));
            throw retryError;
          }
        }
      }
    }

    // Ensure we have generated content after retries
    if (!generatedContent) {
      throw new Error('Failed to generate PR description after retries');
    }

    // Show generated content for review
    console.log(chalk.blue('\n📝 Generated Pull Request:'));

    // Display summary if available
    if (generatedContent.summary) {
      console.log(chalk.bold('Summary:'));
      console.log(chalk.cyan(generatedContent.summary));
      console.log();
    }

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
    let finalSummary = generatedContent.summary;

    // Debug: Log what AI generated
    console.log(chalk.gray('\n🔍 Debug - AI Generated Content:'));
    console.log(chalk.gray(`Title: "${generatedContent.title}"`));
    console.log(chalk.gray(`Summary: "${generatedContent.summary}"`));
    console.log(chalk.gray(`Body length: ${generatedContent.body?.length || 0} characters`));

    if (action === 'edit') {
      const editPrompts: any[] = [
        {
          type: 'input',
          name: 'editedTitle',
          message: 'Enter pull request title:',
          default: finalTitle
        }
      ];

      // Add summary editing if summary exists
      if (generatedContent.summary) {
        editPrompts.push({
          type: 'input',
          name: 'editedSummary',
          message: 'Edit pull request summary:',
          default: finalSummary || ''
        });
      }

      editPrompts.push({
        type: 'editor',
        name: 'editedBody',
        message: 'Edit pull request description:',
        default: finalBody
      });

      const editedContent = await inquirer.prompt(editPrompts);

      finalTitle = editedContent.editedTitle;
      finalBody = editedContent.editedBody;
      if (editedContent.editedSummary !== undefined) {
        finalSummary = editedContent.editedSummary;
      }
    }

    // Create pull request or show dry run
    if (options.dryRun) {
      console.log(chalk.blue('\n🔍 Dry Run - Pull Request Preview:'));
      console.log(chalk.bold('Repository:'), `${repo.owner}/${repo.repo}`);
      console.log(chalk.bold('From:'), currentBranch);
      console.log(chalk.bold('To:'), baseBranch);
      console.log(chalk.bold('Title:'), finalTitle);
      if (finalSummary) {
        console.log(chalk.bold('Summary:'), finalSummary);
      }
      console.log(chalk.bold('Draft:'), options.draft ? 'Yes' : 'No');
      console.log(chalk.bold('Body:'), finalBody);
      console.log(chalk.green('\n✅ Dry run completed. No pull request was created.'));
    } else {
      // Final validation before creating PR - provide fallbacks only if needed
      if (!finalTitle || finalTitle.trim() === '') {
        finalTitle = `${jiraTicket}: Auto-generated PR title`;
        console.log(chalk.yellow('⚠️  Warning: Using fallback title as AI did not generate a valid title'));
      }
      if (!finalBody || finalBody.trim() === '') {
        finalBody = 'Auto-generated PR description';
        console.log(chalk.yellow('⚠️  Warning: Using fallback body as AI did not generate a valid description'));
      }
      if (!currentBranch || currentBranch.trim() === '') {
        throw new Error('Current branch cannot be empty');
      }
      if (!baseBranch || baseBranch.trim() === '') {
        throw new Error('Base branch cannot be empty');
      }

      spinner.start('Creating or updating pull request on GitHub...');

      // Ensure current branch is pushed to remote
      spinner.start('Ensuring branch is pushed to remote...');
      await gitService.pushCurrentBranch();

      spinner.start('Creating or updating pull request on GitHub...');

      const result = await githubService.createOrUpdatePullRequest(repo, {
        title: finalTitle.trim(),
        body: finalBody.trim(),
        head: currentBranch.trim(),
        base: baseBranch.trim(),
        draft: options.draft
      });

      const pullRequest = result.data;
      const isUpdate = result.isUpdate;
      const draftText = options.draft ? ' draft' : '';
      const actionText = isUpdate ? 'updated' : 'created';

      spinner.succeed(`Pull request${draftText} ${actionText} successfully!`);

      console.log(chalk.green(`\n🎉${options.draft ? ' Draft' : ''} Pull Request ${isUpdate ? 'Updated' : 'Created'}:`));
      console.log(chalk.bold('URL:'), pullRequest.html_url);
      console.log(chalk.bold('Number:'), `#${pullRequest.number}`);
      console.log(chalk.bold('Title:'), pullRequest.title);
      if (isUpdate) {
        console.log(chalk.blue('🔄 Note: Updated existing pull request for this branch'));
      }
      if (options.draft) {
        console.log(chalk.yellow('📝 Note: This is a draft pull request'));
      }
    }

  } catch (error) {
    if (spinner.isSpinning) {
      spinner.fail('Operation failed');
    }
    throw error;
  }
}
