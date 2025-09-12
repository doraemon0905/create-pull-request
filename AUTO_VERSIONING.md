# 🏷️ Auto Versioning System

This project includes an automated versioning system that automatically updates the package version when pull requests are merged into the main branch.

## 🔧 How It Works

The auto-versioning system analyzes pull requests and commits to determine the appropriate version bump type (patch, minor, or major) and automatically updates the package version.

### Version Bump Determination

The system uses the following priority order to determine the version bump type:

1. **PR Labels** (Highest Priority)
   - `major` or `breaking` → Major version bump
   - `minor` or `feature` → Minor version bump
   - `patch`, `bugfix`, or `fix` → Patch version bump

2. **PR Title (Conventional Commits)**
   - `feat:` or `feature:` → Minor version bump
   - `fix:` or `bugfix:` → Patch version bump
   - `BREAKING:` or `breaking:` → Major version bump

3. **Commit Messages (Conventional Commits)**
   - `BREAKING CHANGE` or `feat!`, `fix!`, `chore!` → Major version bump
   - `feat:` or `feature:` → Minor version bump
   - `fix:` or `bugfix:` → Patch version bump

4. **File Change Analysis**
   - Large changes (>100 lines) in core files → Minor version bump
   - Changes in `package.json`, `src/`, `lib/`, `bin/` → Minor version bump
   - Other changes → Patch version bump

5. **Default**: Patch version bump

## 🚀 Usage

### Automatic Versioning (Recommended)

The system automatically runs when:
- A pull request is merged into `main` branch
- Code is directly pushed to `main` branch

No manual intervention is required!

### Manual Versioning

You can also run the auto-versioning script manually:

```bash
# Run auto-versioning (analyzes recent commits)
npm run version:auto

# Dry run to see what would happen
npm run version:auto:dry

# Force a specific version type
./scripts/auto-version.sh --force patch
./scripts/auto-version.sh --force minor
./scripts/auto-version.sh --force major
```

### Skip Versioning

To skip automatic versioning for a commit, include one of these keywords in your commit message:
- `[skip version]`
- `[no version]`
- `[skip bump]`

Example:
```bash
git commit -m "docs: update README [skip version]"
```

## 🏷️ PR Labels for Version Control

Use these labels on your pull requests to control version bumping:

| Label | Version Bump | Use Case |
|-------|-------------|----------|
| `major` or `breaking` | Major (x.0.0) | Breaking changes, API changes |
| `minor` or `feature` | Minor (0.x.0) | New features, enhancements |
| `patch`, `bugfix`, or `fix` | Patch (0.0.x) | Bug fixes, small improvements |

## 🔄 Workflow Integration

### GitHub Actions Workflow

The auto-versioning system integrates with GitHub Actions:

1. **Trigger**: PR merge or direct push to main
2. **Analysis**: Determines version bump type
3. **Update**: Updates package.json and package-lock.json
4. **Commit**: Creates version bump commit
5. **Tag**: Creates git tag (e.g., `v1.2.3`)
6. **Push**: Pushes changes and tags to repository
7. **Release**: Creates GitHub release (optional)

### Workflow File

The workflow is defined in `.github/workflows/auto-version.yml` and includes:
- Version bump logic
- Git tag creation
- GitHub release creation
- Integration with publish workflow

## 📋 Examples

### Example PR Labels

```yaml
# For a bug fix
labels: ["bugfix", "patch"]
# Result: 1.2.3 → 1.2.4

# For a new feature
labels: ["feature", "minor"]
# Result: 1.2.3 → 1.3.0

# For breaking changes
labels: ["breaking", "major"]
# Result: 1.2.3 → 2.0.0
```

### Example Conventional Commit Messages

```bash
# Patch version bump
git commit -m "fix: resolve authentication issue"

# Minor version bump  
git commit -m "feat: add new export format support"

# Major version bump
git commit -m "feat!: change API response format

BREAKING CHANGE: API now returns data in different structure"
```

### Example PR Titles

```text
# Minor version bump
"feat: Add CSV export functionality"

# Patch version bump
"fix: Resolve memory leak in processing"

# Major version bump
"BREAKING: Change authentication method"
```

## 🛠️ Configuration

### Environment Variables

The auto-versioning script supports these environment variables:

- `GITHUB_TOKEN`: GitHub token for API access (optional, enhances PR analysis)
- `CI`: Set to `true` in CI environments
- `GITHUB_ACTIONS`: Set to `true` in GitHub Actions
- `GITHUB_ACTOR`: GitHub username for git commits

### Script Options

```bash
# Show help
./scripts/auto-version.sh --help

# Dry run (no changes)
./scripts/auto-version.sh --dry-run

# Force specific version type
./scripts/auto-version.sh --force patch
./scripts/auto-version.sh --force minor
./scripts/auto-version.sh --force major
```

## 🔍 Troubleshooting

### Common Issues

1. **"Working directory is not clean"**
   - Ensure all changes are committed before running
   - Use `git status` to check for uncommitted changes

2. **"Could not determine version bump type"**
   - Add appropriate PR labels or use conventional commit format
   - Manually specify version type with `--force` option

3. **"GITHUB_TOKEN not set"**
   - The script works without token but with limited PR analysis
   - Set token for enhanced PR label and title analysis

4. **Version not updating automatically**
   - Check GitHub Actions logs
   - Ensure workflow has write permissions
   - Verify PR was actually merged (not just closed)

### Debug Mode

Run with dry-run to see what would happen:

```bash
npm run version:auto:dry
```

This shows:
- Current version
- Detected PR information
- Determined version bump type
- What the new version would be

## 📚 Integration with Publishing

The auto-versioning system integrates with the existing publishing workflow:

1. **Auto-versioning** runs when PR is merged
2. **Manual publishing** can be triggered via GitHub Actions
3. **Automatic publishing** can be enabled (see workflow comments)

### Manual Publish After Auto-Version

```bash
# After auto-versioning creates a new tag
# Go to GitHub Actions → Publish to NPM → Run workflow
# Select the version type and run
```

### Automatic Publish (Optional)

Uncomment the lines in `.github/workflows/auto-version.yml` to automatically trigger publishing after version updates.

## 🎯 Best Practices

1. **Use PR Labels**: Always label your PRs appropriately
2. **Conventional Commits**: Use conventional commit format for clarity
3. **Meaningful PR Titles**: Write clear, descriptive PR titles
4. **Review Changes**: Use dry-run mode to preview version changes
5. **Skip When Needed**: Use skip flags for documentation-only changes

## 📖 Resources

- [Semantic Versioning (SemVer)](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Versioning](https://docs.npmjs.com/about-semantic-versioning)