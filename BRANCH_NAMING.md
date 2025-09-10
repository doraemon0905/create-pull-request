# Branch Naming for Automatic Jira Ticket Detection

The `create-pr` tool can automatically detect Jira ticket IDs from your branch names, eliminating the need to specify the `-j, --jira` option manually.

## Supported Branch Naming Patterns

The tool supports various common branch naming conventions:

### Format Examples

✅ **Supported Formats:**

```
ft/ET-123                    → ET-123
ft-ET-123                    → ET-123
feature_ET-123               → ET-123
feature/ET-123               → ET-123
bugfix-PROJ-456              → PROJ-456
bugfix/PROJ-456/fix-issue    → PROJ-456
ET-123-some-description      → ET-123
feature/ET-123-fix-login     → ET-123
ft-ET-123-refactor-code      → ET-123
hotfix_URGENT-789_critical   → URGENT-789
```

### How It Works

1. **Pattern Recognition**: The tool uses a regex pattern to find Jira ticket IDs in branch names
2. **Case Insensitive**: Branch names like `ft/et-123` will be normalized to `ET-123`
3. **Multiple Separators**: Supports `/`, `-`, and `_` as separators
4. **Position Flexible**: Ticket ID can be at the beginning, middle, or after prefixes

### Jira Ticket Format Requirements

The Jira ticket ID must follow the standard format:
- **Project Key**: 1+ uppercase letters/numbers (e.g., `ET`, `PROJ`, `ABC123`)
- **Separator**: Single dash `-`
- **Issue Number**: 1+ digits (e.g., `123`, `4567`)

Examples: `ET-123`, `PROJ-456`, `ABC123-789`

### Branch Naming Best Practices

For optimal automatic detection, use these recommended patterns:

```bash
# Feature branches
feature/ET-123-description
ft/ET-123
feat-ET-123

# Bug fixes
bugfix/ET-123-fix-description
fix/ET-123
hotfix-ET-123

# With more context
feature/user-story/ET-123/implementation
```

### Fallback Behavior

If no Jira ticket ID is detected from the branch name:
1. The tool will prompt you to enter the ticket ID manually
2. You can still use the `-j, --jira` option to override automatic detection
3. The manual input has full validation and error handling

### Examples in Action

```bash
# Automatic detection from branch name
git checkout -b ft/ET-123-add-login
create-pr create
# ✅ Detected Jira ticket from branch name: ET-123

# Manual override (if needed)
git checkout -b ft/ET-123-add-login
create-pr create -j PROJ-456
# Uses PROJ-456 instead of ET-123

# No detection possible
git checkout -b feature/refactor-code
create-pr create
# Prompts: Enter Jira ticket ID (e.g., PROJ-123):
```

This automatic detection makes the workflow smoother while maintaining flexibility for edge cases.