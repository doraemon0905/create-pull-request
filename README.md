# Create Pull Request CLI

A CLI tool that automatically generates pull request descriptions based on Jira tickets and file changes using GitHub Copilot API.

## Features

- 🎫 **Jira Integration**: Automatically fetches ticket information from Jira
- 🔄 **Git Analysis**: Analyzes file changes and commit history
- 🤖 **AI-Powered**: Uses GitHub Copilot API to generate intelligent PR descriptions
- 📋 **Template Support**: Automatically detects and uses PR templates from your repository
- ✅ **User Review**: Always asks for user confirmation before creating the PR
- 🏃‍♂️ **Dry Run Mode**: Preview generated content without creating a PR

## Installation

### Global Installation

```bash
npm install -g create-pull-request
```

### Local Installation

```bash
npm install create-pull-request
```

## Setup

1. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

2. Configure your credentials in `.env`:
   ```bash
   # Jira Configuration
   JIRA_BASE_URL=https://your-company.atlassian.net
   JIRA_USERNAME=your-email@company.com
   JIRA_API_TOKEN=your-jira-api-token

   # GitHub Configuration
   GITHUB_TOKEN=your-github-personal-access-token
   ```

3. For Jira API token:
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create a new API token
   - Copy the token to your `.env` file

4. For GitHub token:
   - Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - Generate a new token with `repo` permissions
   - Copy the token to your `.env` file

## Usage

### Basic Usage

```bash
# Create a PR for a Jira ticket
create-pr create --jira PROJ-123

# Interactive mode (will prompt for ticket)
create-pr create

# Specify base branch (default: main)
create-pr create --jira PROJ-123 --base develop

# Custom title
create-pr create --jira PROJ-123 --title "Custom PR Title"

# Dry run (preview without creating)
create-pr create --jira PROJ-123 --dry-run
```

### Available Commands

- `create-pr create` - Create a pull request with auto-generated description
- `create-pr config` - Show configuration setup instructions
- `create-pr --help` - Show help information

### Options

- `-j, --jira <ticket>` - Jira ticket ID (e.g., PROJ-123)
- `-b, --base <branch>` - Base branch for the pull request (default: main)
- `-t, --title <title>` - Custom pull request title
- `--dry-run` - Generate description without creating PR

## How It Works

1. **Validation**: Checks that you're in a git repository and have proper configuration
2. **Jira Integration**: Fetches ticket details including summary, description, and metadata
3. **Git Analysis**: Analyzes file changes, commit messages, and diff content
4. **Template Detection**: Looks for PR templates in your repository
5. **AI Generation**: Uses GitHub Copilot API to generate intelligent descriptions
6. **User Review**: Shows generated content and asks for confirmation
7. **PR Creation**: Creates the pull request on GitHub

## Supported PR Template Locations

The tool automatically detects PR templates from these locations:

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `pull_request_template.md`
- `PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/default.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md` (multiple templates)

## Example Output

```
🚀 Starting pull request creation process...

✅ Fetched Jira ticket: PROJ-123 - Implement user authentication
✅ Repository: company/awesome-app, Branch: feature/auth-implementation

📊 Changes Summary:
   Files changed: 8
   Insertions: +245
   Deletions: -12

✅ Using PR template: default.md
✅ Code analysis complete
✅ Pull request description generated

📝 Generated Pull Request:
Title: PROJ-123: Implement user authentication

Description:
## Summary
This PR implements user authentication functionality as specified in PROJ-123...

? What would you like to do? 
❯ ✅ Create the pull request
  ✏️  Edit the description  
  ❌ Cancel

✅ Pull request created successfully!

🎉 Pull Request Created:
URL: https://github.com/company/awesome-app/pull/42
Number: #42
Title: PROJ-123: Implement user authentication
```

## Requirements

- Node.js 16.0.0 or higher
- Git repository
- Jira account with API access
- GitHub account with repository access

## Development

```bash
# Clone the repository
git clone https://github.com/your-username/create-pull-request.git
cd create-pull-request

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Troubleshooting

### Common Issues

1. **Authentication Error**: Make sure your Jira and GitHub tokens are correct and have proper permissions
2. **Template Not Found**: PR templates are optional. The tool will use a default format if none are found
3. **No Changes Detected**: Make sure you're on a feature branch with changes compared to the base branch
4. **Copilot API Unavailable**: The tool falls back to template-based generation if Copilot API is unavailable

### Getting Help

- Run `create-pr config` for setup instructions
- Check that all environment variables are set correctly
- Ensure you're in a git repository with a GitHub origin remote

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/your-username/create-pull-request/issues) on GitHub.