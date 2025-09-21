# Create Pull Request CLI

A CLI tool that automatically generates pull request descriptions based on Jira tickets and file changes using AI providers (Claude, ChatGPT, Gemini, or GitHub Copilot).

## Features

- 🎫 **Jira Integration**: Automatically fetches ticket information from Jira
- 🔄 **Git Analysis**: Analyzes file changes and commit history
- 🤖 **AI-Powered**: Uses multiple AI providers (Claude → ChatGPT → Gemini → Copilot) to generate intelligent PR descriptions
- 📋 **Template Support**: Automatically detects and uses PR templates from your repository
- ✅ **User Review**: Always asks for user confirmation before creating the PR
- 🏃‍♂️ **Dry Run Mode**: Preview generated content without creating a PR

## Installation

### Global Installation

```bash
npm install -g publish-pull-request
```

### Local Installation

```bash
npm install publish-pull-request
```

## Setup

### Option 1: Interactive Setup (Recommended)

```bash
create-pr setup
```

This will guide you through setting up all required credentials and AI providers.

### Option 2: Manual Setup

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

   # AI Providers (at least one required)
   # Primary: Anthropic Claude (recommended)
   CLAUDE_API_KEY=your-claude-api-key
   CLAUDE_MODEL=claude-3-5-sonnet-20241022

   # Secondary: OpenAI/ChatGPT
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_MODEL=gpt-4o

   # Fallback: Google Gemini
   GEMINI_API_KEY=your-gemini-api-key
   GEMINI_MODEL=gemini-1.5-pro

   # Legacy: GitHub Copilot
   COPILOT_API_TOKEN=your-copilot-api-token
   ```

### Getting API Keys

**Jira API Token:**
- Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
- Create a new API token
- Copy the token to your configuration

**GitHub Token:**
- Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
- Generate a new token with `repo` permissions
- Copy the token to your configuration

**Anthropic Claude API Key (Recommended):**
- Go to [Anthropic Console](https://console.anthropic.com/)
- Create a new API key
- Copy the key to your configuration

**OpenAI API Key (Secondary):**
- Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create a new secret key
- Copy the key to your configuration

**Google Gemini API Key (Fallback):**
- Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create a new API key
- Copy the key to your configuration

**GitHub Copilot API Token (Legacy):**
- Uses the same token as GitHub API
- Or get a separate Copilot API token if available

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
- `create-pr setup` - Interactive setup wizard for credentials and AI providers
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
5. **AI Provider Selection**: Automatically selects the best available AI provider (Claude → ChatGPT → Gemini → Copilot)
6. **AI Generation**: Uses the selected AI provider to generate intelligent descriptions with automatic fallback
7. **User Review**: Shows generated content and asks for confirmation
8. **PR Creation**: Creates the pull request on GitHub

## AI Provider Priority

The tool uses AI providers in the following priority order:

1. **Claude (Anthropic)** - Primary provider
   - Most reliable and consistent results
   - Excellent code understanding and analysis
   - Superior reasoning capabilities for complex changes
   - Fast response times

2. **ChatGPT (OpenAI)** - Secondary provider
   - Reliable alternative when Claude is unavailable
   - Good understanding of code context
   - Consistent performance

3. **Gemini (Google)** - Fallback provider
   - Good alternative when primary providers are unavailable
   - Strong analytical capabilities
   - Handles complex code changes well

4. **GitHub Copilot** - Legacy provider
   - May have stability issues
   - Uses GitHub infrastructure
   - Fallback option for existing setups

If multiple providers are configured, the tool will automatically:
- Try Claude first
- Fall back to ChatGPT if Claude fails
- Fall back to Gemini if both Claude and ChatGPT fail
- Fall back to Copilot if all other providers fail
- Use template-based generation if all AI providers fail

You can configure multiple providers for maximum reliability.

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

- Node.js 18.0.0 or higher
- Git repository
- Jira account with API access
- GitHub account with repository access
- At least one AI provider:
  - **Anthropic Claude API key** (recommended) - Most reliable and intelligent
  - **OpenAI API key** (secondary) - Reliable alternative
  - **Google Gemini API key** (fallback) - Good alternative option
  - **GitHub Copilot API token** (legacy) - May have availability issues

## Development

```bash
# Clone the repository
git clone https://github.com/doraemon0905/create-pull-request.git
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
4. **AI Provider Issues**: 
   - If Claude fails, the tool automatically falls back to ChatGPT, then Gemini, then Copilot
   - If all AI providers fail, the tool uses template-based generation
   - Run `create-pr setup` to configure additional AI providers
5. **No AI Providers Configured**: At least one AI provider must be configured. Run `create-pr setup` to configure providers

### Getting Help

- Run `create-pr setup` for interactive setup wizard
- Run `create-pr config` for manual setup instructions
- Check that all environment variables are set correctly
- Ensure you're in a git repository with a GitHub origin remote
- Verify at least one AI provider is properly configured

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/doraemon0905/create-pull-request/issues) on GitHub.
