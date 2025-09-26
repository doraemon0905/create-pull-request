#!/usr/bin/env node

/**
 * GitHub Actions script to create Jira tickets for Dependabot security PRs
 * This script is called by the GitHub Actions workflow when Dependabot opens
 * a PR with 'Security' in the title.
 */

const axios = require('axios');

async function createJiraTicket() {
  try {
    // Get environment variables from GitHub Actions
    const {
      JIRA_BASE_URL,
      JIRA_USERNAME,
      JIRA_API_TOKEN,
      JIRA_PROJECT_KEY,
      PR_TITLE,
      PR_URL,
      PR_BODY
    } = process.env;

    // Validate required environment variables
    if (!JIRA_BASE_URL || !JIRA_USERNAME || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
      throw new Error('Missing required Jira environment variables. Please check your GitHub Secrets.');
    }

    if (!PR_TITLE || !PR_URL) {
      throw new Error('Missing required PR information from GitHub context.');
    }

    console.log('🎫 Creating Jira ticket for Dependabot security PR...');
    console.log(`📋 PR Title: ${PR_TITLE}`);
    console.log(`🔗 PR URL: ${PR_URL}`);

    // Create Jira API client
    const jiraClient = axios.create({
      baseURL: `${JIRA_BASE_URL}/rest/api/3`,
      auth: {
        username: JIRA_USERNAME,
        password: JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Prepare ticket description
    const description = `Security vulnerability detected by Dependabot.

**Pull Request Details:**
- Title: ${PR_TITLE}
- URL: ${PR_URL}

**Description:**
${PR_BODY || 'No description provided.'}

**Action Required:**
Please review and merge the Dependabot pull request to address this security vulnerability.`;

    // Create ticket payload
    const payload = {
      fields: {
        project: {
          key: JIRA_PROJECT_KEY
        },
        summary: `Security: ${PR_TITLE}`,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: 'Task'
        },
        priority: {
          name: 'High'
        }
      }
    };

    // Create the ticket
    console.log('📝 Creating Jira ticket...');
    const response = await jiraClient.post('/issue', payload);
    
    const issueKey = response.data.key;
    const issueUrl = `${JIRA_BASE_URL}/browse/${issueKey}`;

    console.log('✅ Jira ticket created successfully!');
    console.log(`🎫 Ticket Key: ${issueKey}`);
    console.log(`🔗 Ticket URL: ${issueUrl}`);

    // Set output for GitHub Actions
    console.log(`::set-output name=ticket_key::${issueKey}`);
    console.log(`::set-output name=ticket_url::${issueUrl}`);

    return { key: issueKey, url: issueUrl };

  } catch (error) {
    console.error('❌ Error creating Jira ticket:', error.message);
    
    if (error.response) {
      console.error('🔍 Response status:', error.response.status);
      console.error('🔍 Response data:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createJiraTicket().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = createJiraTicket;