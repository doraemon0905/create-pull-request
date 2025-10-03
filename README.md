# Create Pull Request CLI

A CLI tool that automatically generates pull request descriptions based on Jira tickets and file changes using AI providers (Claude, ChatGPT, Gemini, or GitHub Copilot).

## Features

- 🎫 **Jira Integration**: Automatically fetches ticket information from Jira
- 📄 **Confluence Integration**: Optionally includes linked Confluence pages in PR description generation
- 🔄 **Git Analysis**: Analyzes file changes and commit history
- 🤖 **AI-Powered**: Uses your selected AI provider (Claude, ChatGPT, Gemini, or Copilot) to generate intelligent PR descriptions
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
3. **Confluence Check**: Detects linked Confluence pages and asks if you want to include them
4. **Git Analysis**: Analyzes file changes, commit messages, and diff content
5. **Template Detection**: Looks for PR templates in your repository
6. **AI Provider Selection**: Uses the configured AI provider or prompts you to select one if multiple are available
7. **AI Generation**: Uses the selected AI provider to generate intelligent descriptions
8. **User Review**: Shows generated content and asks for confirmation
9. **PR Creation**: Creates the pull request on GitHub

## Confluence Integration

When a Jira ticket has linked Confluence pages, the tool will ask if you want to include their content in the PR description generation:

```
✔ Jira ticket information fetched
🎫 Using Jira ticket: PROJ-123 - Implement user authentication

⠋ Checking for linked Confluence pages...
✔ Found linked Confluence pages
? Include Confluence page content in PR summary generation? (y/N)
```

### Benefits

- **Enhanced Context**: AI uses documented requirements and specifications from Confluence
- **Better Alignment**: Generated descriptions reference relevant documentation
- **Smarter Summaries**: AI can cross-reference code changes with documented requirements
- **User Control**: You decide whether to include Confluence content (defaults to No)

### How It Works

1. **Detection**: Automatically detects Confluence pages linked to your Jira ticket
2. **User Prompt**: Asks for confirmation before fetching (defaults to No for faster workflow)
3. **Content Extraction**: If confirmed, fetches and processes Confluence page content
4. **Smart Compression**: Automatically compresses content to optimize AI prompts
5. **AI Integration**: AI uses both Jira and Confluence context to generate better descriptions

### Supported Confluence URLs

- Old-style: `/pages/viewpage.action?pageId=123456`
- New-style: `/spaces/SPACE/pages/123456/Page+Title`
- Wiki URLs: Automatically detected

### Configuration

No additional configuration needed! Confluence integration uses your existing Jira credentials:

- Same authentication as Jira
- No extra API tokens required
- Automatic client initialization

### Content Processing

- **HTML Stripping**: Removes HTML tags while preserving text content
- **Smart Compression**: Limits content to 2000 characters per page
- **Intelligent Truncation**: Breaks at sentence boundaries for better readability
- **Page Limit**: Maximum 5 Confluence pages per ticket

### Example with Confluence

```
✔ Found linked Confluence pages
? Include Confluence page content in PR summary generation? Yes
⠋ Fetching Confluence pages content...
✔ Loaded 2 Confluence page(s)
📄 Confluence pages found:
   • Authentication Requirements
   • API Security Guidelines

⠋ Analyzing repository and changes...
✔ Repository: company/awesome-app, Branch: feature/auth-implementation
```

The AI will then generate a PR description that references and aligns with the documented requirements from these Confluence pages.

## AI Provider Options

The tool supports the following AI providers:

1. **Claude (Anthropic)** - Recommended
   - Most reliable and consistent results
   - Excellent code understanding and analysis
   - Superior reasoning capabilities for complex changes
   - Fast response times

2. **ChatGPT (OpenAI)** - Alternative
   - Reliable option with good code understanding
   - Good understanding of code context
   - Consistent performance

3. **Gemini (Google)** - Alternative
   - Strong analytical capabilities
   - Handles complex code changes well
   - Good alternative option

4. **GitHub Copilot** - Legacy option
   - May have stability issues
   - Uses GitHub infrastructure
   - Available for existing setups

**Provider Selection**:
- If only one provider is configured, it will be used automatically
- If multiple providers are available, the tool will use the priority order: Claude → ChatGPT → Gemini → Copilot
- You can configure multiple providers, but the tool will **not automatically fall back** if your selected provider fails
- If your selected provider fails, you'll get a clear error message and need to ensure it's properly configured

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

✔ Jira ticket information fetched
🎫 Using Jira ticket: PROJ-123 - Implement user authentication

⠋ Checking for linked Confluence pages...
✔ Found linked Confluence pages
? Include Confluence page content in PR summary generation? Yes
⠋ Fetching Confluence pages content...
✔ Loaded 2 Confluence page(s)
📄 Confluence pages found:
   • Authentication Requirements
   • API Security Guidelines

⠋ Analyzing repository and changes...
✔ Repository: company/awesome-app, Branch: feature/auth-implementation

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
This PR implements user authentication functionality as specified in PROJ-123,
following the requirements documented in the Authentication Requirements and
API Security Guidelines Confluence pages...

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

- Node.js 18.0.0 or higher (ES2021 support)
- Git repository
- Jira account with API access
- GitHub account with repository access
- At least one AI provider:
  - **Anthropic Claude API key** (recommended) - Most reliable and intelligent
  - **OpenAI API key** (alternative) - Reliable option
  - **Google Gemini API key** (alternative) - Good option
  - **GitHub Copilot API token** (legacy) - May have availability issues
- Optional: Confluence pages linked to Jira tickets (uses same Jira credentials)

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

### Technical Specifications

- **TypeScript Target**: ES2021 for modern JavaScript features
- **Node.js Modules**: Uses `node:` prefix for built-in modules (`node:fs`, `node:path`, etc.)
- **Code Style**: Modern JavaScript practices including `for...of` loops and `String#replaceAll()`
- **AI Provider Architecture**: Direct provider selection without automatic fallbacks for predictable behavior

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
   - The tool will **not automatically fall back** to other providers if your selected provider fails
   - Ensure your selected AI provider has a valid API key and proper configuration
   - If you need reliability, ensure your primary provider is properly set up
   - Run `create-pr setup` to configure or change AI providers
5. **No AI Providers Configured**: At least one AI provider must be configured. Run `create-pr setup` to configure providers

### Getting Help

- Run `create-pr setup` for interactive setup wizard
- Run `create-pr config` for manual setup instructions
- Check that all environment variables are set correctly
- Ensure you're in a git repository with a GitHub origin remote
- Verify at least one AI provider is properly configured

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/doraemon0905/create-pull-request/issues) on GitHub.

## Sonarcloud Report
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=create-pull-request&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=create-pull-request)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=create-pull-request&metric=coverage)](https://sonarcloud.io/summary/new_code?id=create-pull-request)
