# Publishing Guide

This document provides step-by-step instructions for publishing the `create-pull-request` npm package.

## Prerequisites

Before publishing, ensure you have:

1. **NPM Account**: Create an account at [npmjs.com](https://www.npmjs.com)
2. **Authentication**: Login to npm locally: `npm login`
3. **Repository Access**: Push access to the GitHub repository
4. **Environment Setup**: All dependencies installed: `npm install`

## Publishing Workflow

### Option 1: GitHub Actions (Recommended)

The easiest way to publish is using GitHub Actions automation:

#### Automated Publishing
```bash
# Bump version and trigger automated publish
npm version patch  # or minor/major
git push origin main --tags  # Triggers GitHub Actions
```

#### Manual Dispatch
1. Go to GitHub → Actions → "Manual Publish"
2. Click "Run workflow"
3. Choose version, tag, and options
4. Publish with full control

See [GitHub Actions Guide](.github/GITHUB_ACTIONS.md) for detailed setup instructions.

### Option 2: Interactive Publishing (Local)

Use the automated publishing script for a guided experience:

```bash
./scripts/publish.sh
```

This script will:
- ✅ Check npm authentication
- ✅ Allow version selection (patch/minor/major/custom)
- ✅ Run all validation checks
- ✅ Build the project
- ✅ Run tests and linting
- ✅ Show package preview
- ✅ Perform dry run
- ✅ Publish to npm
- ✅ Create and push git tags

### Option 3: Manual Step-by-Step

#### Step 1: Pre-Publish Validation

Run comprehensive validation checks:

```bash
./scripts/pre-publish.sh
```

This checks for:
- Required package.json fields
- Entry point files existence
- TypeScript compilation
- Test execution
- Linting
- Security vulnerabilities
- Npm authentication
- Version conflicts

#### Step 2: Version Bumping

Choose the appropriate version bump:

```bash
# Patch version (bug fixes): 1.0.0 -> 1.0.1
npm run version:patch

# Minor version (new features): 1.0.0 -> 1.1.0
npm run version:minor

# Major version (breaking changes): 1.0.0 -> 2.0.0
npm run version:major

# Prerelease version: 1.0.0 -> 1.0.1-0
npm run version:prerelease

# Or use the interactive script
./scripts/version.sh
```

#### Step 3: Final Validation

```bash
# Dry run to preview what will be published
npm run publish:dry

# Check package contents
npm pack --dry-run
```

#### Step 4: Publish

```bash
npm publish
```

### Option 4: Using NPM Scripts

Quick commands available in package.json:

```bash
# Version bumping
npm run version:patch
npm run version:minor
npm run version:major
npm run version:prerelease

# Publishing
npm run publish:full    # Interactive publish script
npm run publish:dry     # Dry run only

# Validation
./scripts/pre-publish.sh
```

## Automated Checks

The following checks run automatically before publishing:

### Pre-version Checks (`preversion` script)
- Linting
- Tests

### Pre-publish Checks (`prepublishOnly` script)
- Linting
- Build compilation
- Tests

### Manual Validation Script
Run `./scripts/pre-publish.sh` for comprehensive validation:

- ✅ Package.json completeness
- ✅ Entry points existence
- ✅ TypeScript compilation
- ✅ Essential files (README, LICENSE, etc.)
- ✅ Git repository status
- ✅ Dependencies check
- ✅ Tests execution
- ✅ Linting
- ✅ NPM authentication
- ✅ Version availability
- ✅ Security audit
- ✅ Bundle size analysis

## Version Strategy

Follow [Semantic Versioning (SemVer)](https://semver.org/):

- **PATCH** (x.y.Z): Bug fixes, documentation updates
- **MINOR** (x.Y.z): New features, backward-compatible changes
- **MAJOR** (X.y.z): Breaking changes, API modifications

Examples:
```bash
1.0.0 -> 1.0.1  # Bug fix
1.0.1 -> 1.1.0  # New feature
1.1.0 -> 2.0.0  # Breaking change
```

## Git Tags

Version bumping automatically creates git tags:

```bash
# Tags are created automatically with version commands
npm run version:patch  # Creates v1.0.1 tag

# Push tags to remote
git push origin --tags

# Or push specific tag
git push origin v1.0.1
```

## Troubleshooting

### Common Issues

1. **Not logged in to npm**
   ```bash
   npm login
   ```

2. **Version already exists**
   ```bash
   # Bump version first
   npm run version:patch
   ```

3. **Tests failing**
   ```bash
   npm test
   # Fix failing tests before publishing
   ```

4. **Linting errors**
   ```bash
   npm run lint
   # Fix linting issues
   ```

5. **Build errors**
   ```bash
   npm run build
   # Fix TypeScript compilation errors
   ```

6. **Uncommitted changes**
   ```bash
   git add .
   git commit -m "Prepare for publish"
   ```

### Recovery Steps

If publish fails midway:

1. Check current version: `npm view create-pull-request version`
2. Check local version: `node -p "require('./package.json').version"`
3. If versions match, the publish succeeded
4. If not, fix issues and retry

### Security Audit Issues

If security audit fails:

```bash
# Fix automatically
npm audit fix

# Fix with force (be careful)
npm audit fix --force

# Review issues manually
npm audit
```

## Post-Publish Checklist

After successful publishing:

- [ ] ✅ Verify package on npmjs.com: `https://www.npmjs.com/package/publish-pull-request`
- [ ] ✅ Test installation: `npm install -g publish-pull-request@latest`
- [ ] ✅ Test functionality: `create-pr --help`
- [ ] ✅ Update GitHub release page
- [ ] ✅ Update documentation if needed
- [ ] ✅ Announce release (if major version)

## Publishing Checklist

Before each publish:

- [ ] All tests passing
- [ ] Linting clean
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Git working directory clean
- [ ] NPM authenticated
- [ ] Pre-publish validation passed
- [ ] Dry run successful

## CI/CD Integration (Future)

For automated publishing, consider setting up GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish to NPM
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Support

For publishing issues:

1. Check this guide first
2. Run validation scripts: `./scripts/pre-publish.sh`
3. Check npm documentation: [npmjs.com/docs](https://docs.npmjs.com/)
4. Open an issue in the repository
