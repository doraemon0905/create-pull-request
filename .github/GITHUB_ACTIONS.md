# GitHub Actions Setup Guide

This project includes automated CI/CD pipelines using GitHub Actions for testing, validation, and publishing to NPM.

## 🚀 Available Workflows

### 1. CI/CD Pipeline (`ci.yml`)
**Triggers:** Push to main/develop, PRs, weekly schedule
- ✅ Multi-version Node.js testing (16, 18, 20)
- ✅ Cross-platform testing (Ubuntu, Windows, macOS)
- ✅ Code quality validation
- ✅ Security audits
- ✅ Build verification
- ✅ CLI functionality testing

### 2. Automated Publish (`publish.yml`)
**Triggers:** Version tags (`v*.*.*`), manual dispatch
- 🚀 Automatic NPM publishing on version tags
- 🔍 Comprehensive pre-publish validation
- 📦 GitHub release creation
- 🏷️ Git tag management

### 3. Manual Publish (`manual-publish.yml`)
**Triggers:** Manual dispatch only
- 🎯 Full control over publishing process
- 🏷️ Custom NPM dist-tags (latest, beta, alpha, etc.)
- 🧪 Dry-run capability
- ⚡ Force publish option (skip some validations)

## 🔧 Setup Instructions

### 1. Required Repository Secrets

Add these secrets to your GitHub repository:

#### NPM Token
1. Go to [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens
2. Create a new **Automation** token
3. Add to GitHub: Settings → Secrets → Actions → New secret
   - Name: `NPM_TOKEN`
   - Value: `npm_xxxxxxxxxxxx`

#### GitHub Token (Optional - usually auto-provided)
- Name: `GITHUB_TOKEN` 
- Value: Auto-provided by GitHub Actions

### 2. Environment Setup (Optional)

For manual publish workflow, you can create a `production` environment:

1. Go to Settings → Environments → New environment
2. Name: `production`
3. Add protection rules:
   - ✅ Required reviewers (recommended for production)
   - ✅ Wait timer (optional)

## 📋 Publishing Workflows

### Option 1: Automated Publishing (Recommended)

1. **Create and push a version tag:**
   ```bash
   # Bump version and create tag
   npm version patch  # or minor/major
   git push origin main --tags
   ```

2. **GitHub Actions will automatically:**
   - ✅ Validate code quality
   - ✅ Run tests and build
   - ✅ Publish to NPM
   - ✅ Create GitHub release
   - ✅ Update documentation

### Option 2: Manual Publishing

1. **Go to Actions tab in your repository**
2. **Select "Manual Publish" workflow**
3. **Click "Run workflow"**
4. **Configure options:**
   - Version: Leave empty for current, or specify (e.g., `1.2.3`)
   - Tag: `latest`, `beta`, `alpha`, etc.
   - Dry run: `true` to test, `false` to publish
   - Force: `true` to skip some validations

### Option 3: Dispatch Automated Workflow

1. **Go to Actions tab**
2. **Select "Publish to NPM" workflow** 
3. **Click "Run workflow"**
4. **Choose version bump type and options**

## 🔍 Workflow Details

### CI Pipeline Features

```yaml
# Runs on multiple Node.js versions
strategy:
  matrix:
    node-version: [18, 20, 22]

# Tests on multiple operating systems  
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```

**Validation Steps:**
- 🔍 ESLint code linting
- 🏗️ TypeScript compilation
- 🧪 Test suite execution
- 📦 Package integrity checks
- 🔒 Security vulnerability scanning
- 🎯 CLI functionality testing
- 📊 Code quality analysis

### Publishing Features

**Pre-publish Validation:**
- ✅ Tests must pass
- ✅ Linting must pass
- ✅ Build must succeed
- ✅ Security audit (moderate+ issues fail)
- ✅ Package structure validation

**Post-publish Actions:**
- 📦 NPM registry verification
- 🏷️ GitHub release creation
- 📊 Success/failure notifications

## 🎯 Usage Examples

### Automatic Publishing Workflow

```bash
# Standard workflow
git add .
git commit -m "Add new feature"
npm version minor       # Creates v1.1.0 tag
git push origin main --tags  # Triggers publish workflow
```

### Manual Publishing via GitHub UI

1. **Beta Release:**
   - Version: `1.2.0-beta.1`
   - Tag: `beta`
   - Dry run: `false`

2. **Alpha Release:**
   - Version: `1.3.0-alpha.1`
   - Tag: `alpha`
   - Dry run: `false`

3. **Test Run:**
   - Version: (leave empty)
   - Tag: `latest`
   - Dry run: `true`

### API Publishing (Advanced)

```bash
# Trigger via GitHub CLI
gh workflow run publish.yml \
  -f version_type=minor \
  -f dry_run=false
```

## 🔒 Security Considerations

### Token Security
- ✅ NPM tokens are stored as GitHub secrets
- ✅ Tokens are only accessible during workflow runs
- ✅ Use **Automation** tokens (not **Publish** tokens)

### Permission Model
- ✅ Workflows only run on main/develop branches
- ✅ Manual workflows can be restricted by environment rules
- ✅ PR workflows have limited permissions

### Audit Trail
- ✅ All publishes are logged in Actions
- ✅ Git tags track version history
- ✅ GitHub releases provide changelog

## 📊 Monitoring and Notifications

### Workflow Status
- ✅ GitHub provides status badges
- ✅ Email notifications on failures
- ✅ Integration with GitHub mobile app

### Adding Status Badges

Add to your README:

```markdown
![CI](https://github.com/username/create-pull-request/workflows/CI%2FCD%20Pipeline/badge.svg)
![Publish](https://github.com/username/create-pull-request/workflows/Publish%20to%20NPM/badge.svg)
```

## 🐛 Troubleshooting

### Common Issues

**1. NPM Token Invalid**
```
Error: 401 Unauthorized
```
- Solution: Regenerate NPM token, update GitHub secret

**2. Version Already Exists**
```
Error: 403 Forbidden - cannot modify pre-existing version
```
- Solution: Bump version number before publishing

**3. Tests Failing**
```
Error: Test suite failed
```
- Solution: Fix tests locally, commit, and retry

**4. Build Errors**
```
Error: TypeScript compilation failed
```
- Solution: Fix TypeScript errors locally

**5. Permission Denied**
```
Error: 403 Forbidden
```
- Solution: Check repository permissions, NPM organization access

### Debug Steps

1. **Check workflow logs in Actions tab**
2. **Verify secrets are set correctly**
3. **Test locally first:**
   ```bash
   npm run validate  # Run local validation
   npm run publish:dry  # Test publish locally
   ```

### Manual Recovery

If automated publish fails midway:

```bash
# Check current state
npm view create-pull-request versions
git tag --list

# Manual publish if needed
npm publish

# Clean up if necessary
git tag -d v1.2.3  # Delete local tag
git push origin :v1.2.3  # Delete remote tag
```

## 📈 Advanced Configuration

### Custom Workflows

You can customize workflows by editing:
- `.github/workflows/ci.yml` - CI/CD pipeline
- `.github/workflows/publish.yml` - Automated publishing
- `.github/workflows/manual-publish.yml` - Manual publishing

### Environment Variables

Available in workflows:
```yaml
env:
  NODE_ENV: production
  NPM_CONFIG_REGISTRY: https://registry.npmjs.org
  PACKAGE_NAME: ${{ github.repository }}
```

### Matrix Strategies

Customize testing matrices:
```yaml
strategy:
  matrix:
    node-version: [18, 20, 22, 21]  # Add Node 21
    os: [ubuntu-latest, macos-latest]  # Remove Windows
```

## 🚦 Workflow Status

You can check workflow status:

- ✅ **Green**: All checks passed
- ❌ **Red**: Some checks failed
- 🟡 **Yellow**: In progress
- ⚪ **Gray**: Skipped

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages)
- [Semantic Versioning](https://semver.org/)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)