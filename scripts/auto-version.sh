#!/bin/bash

# Auto Version Update Script
# Automatically updates package version when pull request is merged
# This script determines the appropriate version bump based on PR labels, commit messages, and file changes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to determine version bump type
determine_version_type() {
    local pr_number="$1"
    local pr_title="$2"
    local pr_labels="$3"
    local commit_messages="$4"
    
    # Check PR labels first (highest priority)
    if echo "$pr_labels" | grep -qi "major\|breaking"; then
        echo "major"
        return
    elif echo "$pr_labels" | grep -qi "minor\|feature"; then
        echo "minor"
        return
    elif echo "$pr_labels" | grep -qi "patch\|bugfix\|fix"; then
        echo "patch"
        return
    fi
    
    # Check PR title for conventional commit format
    if echo "$pr_title" | grep -qi "^feat\|^feature"; then
        echo "minor"
        return
    elif echo "$pr_title" | grep -qi "^fix\|^bugfix\|^patch"; then
        echo "patch"
        return
    elif echo "$pr_title" | grep -qi "^BREAKING\|^breaking"; then
        echo "major"
        return
    fi
    
    # Check commit messages for conventional commits
    if echo "$commit_messages" | grep -qi "BREAKING CHANGE\|^feat!\|^fix!\|^chore!"; then
        echo "major"
        return
    elif echo "$commit_messages" | grep -qi "^feat\|^feature"; then
        echo "minor"
        return
    elif echo "$commit_messages" | grep -qi "^fix\|^bugfix\|^patch"; then
        echo "patch"
        return
    fi
    
    # Analyze file changes to determine impact
    local changed_files
    changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
    
    # Check for breaking changes in important files
    if echo "$changed_files" | grep -qi "package.json\|^src/.*\\.ts$\|^lib/.*\\.js$\|bin/\|cli\|index"; then
        # Check if it's a significant change
        local lines_changed
        lines_changed=$(git diff --stat HEAD~1 HEAD | tail -1 | grep -o '[0-9]* insertions\|[0-9]* deletions' | grep -o '[0-9]*' | head -1 || echo "0")
        
        if [ "${lines_changed:-0}" -gt 100 ]; then
            print_warning "Large change detected ($lines_changed lines), suggesting minor version bump"
            echo "minor"
            return
        fi
    fi
    
    # Default to patch for any other changes
    echo "patch"
}

# Function to get PR information from GitHub
get_pr_info() {
    local pr_number="$1"
    
    if [ -z "$GITHUB_TOKEN" ]; then
        print_warning "GITHUB_TOKEN not set, using git commit info instead"
        return 1
    fi
    
    local repo_owner repo_name
    repo_owner=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\).*/\1/')
    repo_name=$(git config --get remote.origin.url | sed 's/.*github.com[:/][^/]*\/\([^.]*\).*/\1/')
    
    # Get PR info using GitHub API
    local pr_info
    pr_info=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$repo_owner/$repo_name/pulls/$pr_number" 2>/dev/null || echo "")
    
    if [ -n "$pr_info" ] && echo "$pr_info" | grep -q '"title"'; then
        local pr_title pr_labels
        pr_title=$(echo "$pr_info" | jq -r '.title // ""' 2>/dev/null || echo "")
        pr_labels=$(echo "$pr_info" | jq -r '.labels[]?.name // ""' 2>/dev/null | tr '\n' ' ' || echo "")
        
        echo "$pr_title|$pr_labels"
        return 0
    fi
    
    return 1
}

# Main function
main() {
    print_status "Starting auto version update..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Get current version
    local current_version
    current_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    if [ -z "$current_version" ]; then
        print_error "Could not read current version from package.json"
        exit 1
    fi
    
    print_status "Current version: $current_version"
    
    # Check if we're on the main branch
    local current_branch
    current_branch=$(git branch --show-current 2>/dev/null || echo "")
    if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
        print_warning "Not on main branch (current: $current_branch). Version update skipped."
        exit 0
    fi
    
    # Get recent commit info
    local last_commit_message recent_commits
    last_commit_message=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    recent_commits=$(git log -5 --pretty=format:"%s" 2>/dev/null || echo "")
    
    print_status "Last commit: $last_commit_message"
    
    # Try to extract PR number from commit message
    local pr_number
    pr_number=$(echo "$last_commit_message" | grep -o '#[0-9]\+' | head -1 | sed 's/#//' || echo "")
    
    local version_type pr_title pr_labels
    
    if [ -n "$pr_number" ]; then
        print_status "Detected PR #$pr_number"
        
        # Try to get PR info from GitHub
        if pr_info=$(get_pr_info "$pr_number"); then
            pr_title=$(echo "$pr_info" | cut -d'|' -f1)
            pr_labels=$(echo "$pr_info" | cut -d'|' -f2)
            print_status "PR Title: $pr_title"
            print_status "PR Labels: $pr_labels"
        else
            print_warning "Could not fetch PR info from GitHub, using commit messages"
            pr_title="$last_commit_message"
            pr_labels=""
        fi
        
        version_type=$(determine_version_type "$pr_number" "$pr_title" "$pr_labels" "$recent_commits")
    else
        print_status "No PR number detected in commit message"
        version_type=$(determine_version_type "" "$last_commit_message" "" "$recent_commits")
    fi
    
    print_status "Determined version bump type: $version_type"
    
    # Check if version should be updated
    if [ -z "$version_type" ] || [ "$version_type" = "none" ]; then
        print_status "No version update needed"
        exit 0
    fi
    
    # Check for skip keywords in commit message
    if echo "$last_commit_message" | grep -qi "\[skip version\]\|\[no version\]\|\[skip bump\]"; then
        print_status "Version update skipped due to commit message flag"
        exit 0
    fi
    
    # Ensure working directory is clean
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        print_error "Working directory is not clean. Please commit your changes first."
        git status --porcelain
        exit 1
    fi
    
    # Configure git if in CI environment
    if [ "$CI" = "true" ] || [ -n "$GITHUB_ACTIONS" ]; then
        git config user.name "${GITHUB_ACTOR:-github-actions[bot]}"
        git config user.email "${GITHUB_ACTOR:-github-actions[bot]}@users.noreply.github.com"
    fi
    
    # Bump version
    print_status "Bumping version from $current_version using type: $version_type"
    
    if npm version "$version_type" --no-git-tag-version >/dev/null 2>&1; then
        local new_version
        new_version=$(node -p "require('./package.json').version")
        print_success "Version bumped from $current_version to $new_version"
        
        # Commit the version change
        git add package.json package-lock.json 2>/dev/null || git add package.json
        
        local commit_message
        if [ -n "$pr_number" ] && [ -n "$pr_title" ]; then
            commit_message="chore: bump version to $new_version

Auto-generated from PR #$pr_number: $pr_title
Version bump type: $version_type"
        else
            commit_message="chore: bump version to $new_version

Auto-generated version bump
Version bump type: $version_type"
        fi
        
        git commit -m "$commit_message" >/dev/null
        print_success "Version change committed"
        
        # Create git tag
        git tag "v$new_version" >/dev/null
        print_success "Git tag v$new_version created"
        
        # Output information for GitHub Actions
        if [ -n "$GITHUB_OUTPUT" ]; then
            echo "old_version=$current_version" >> "$GITHUB_OUTPUT"
            echo "new_version=$new_version" >> "$GITHUB_OUTPUT"
            echo "version_type=$version_type" >> "$GITHUB_OUTPUT"
            echo "tag=v$new_version" >> "$GITHUB_OUTPUT"
        fi
        
        # Set environment variables for GitHub Actions
        if [ -n "$GITHUB_ENV" ]; then
            echo "OLD_VERSION=$current_version" >> "$GITHUB_ENV"
            echo "NEW_VERSION=$new_version" >> "$GITHUB_ENV"
            echo "VERSION_TYPE=$version_type" >> "$GITHUB_ENV"
            echo "VERSION_TAG=v$new_version" >> "$GITHUB_ENV"
        fi
        
        print_success "Auto version update completed!"
        print_status "Summary:"
        print_status "  • Old version: $current_version"
        print_status "  • New version: $new_version"
        print_status "  • Bump type: $version_type"
        print_status "  • Git tag: v$new_version"
        
        if [ -n "$pr_number" ]; then
            print_status "  • PR: #$pr_number"
        fi
        
    else
        print_error "Failed to bump version"
        exit 1
    fi
}

# Help function
show_help() {
    echo "Auto Version Update Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --dry-run      Show what would be done without making changes"
    echo "  --force TYPE   Force a specific version bump type (patch|minor|major)"
    echo ""
    echo "Environment Variables:"
    echo "  GITHUB_TOKEN   GitHub token for API access (optional)"
    echo ""
    echo "Version bump determination:"
    echo "  1. PR labels (major/breaking, minor/feature, patch/bugfix)"
    echo "  2. PR title with conventional commit format"
    echo "  3. Commit messages with conventional commits"
    echo "  4. File change analysis"
    echo "  5. Default to patch"
    echo ""
    echo "Skip version update:"
    echo "  Include [skip version], [no version], or [skip bump] in commit message"
}

# Parse command line arguments
DRY_RUN=false
FORCE_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_TYPE="$2"
            if [[ ! "$FORCE_TYPE" =~ ^(patch|minor|major)$ ]]; then
                print_error "Invalid version type: $FORCE_TYPE. Must be patch, minor, or major."
                exit 1
            fi
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Dry run mode
if [ "$DRY_RUN" = true ]; then
    print_status "DRY RUN MODE - No changes will be made"
    
    # Get current version
    current_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    print_status "Current version: $current_version"
    
    # Get commit info
    last_commit_message=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    pr_number=$(echo "$last_commit_message" | grep -o '#[0-9]\+' | head -1 | sed 's/#//' || echo "")
    
    if [ -n "$FORCE_TYPE" ]; then
        version_type="$FORCE_TYPE"
        print_status "Forced version type: $version_type"
    else
        recent_commits=$(git log -5 --pretty=format:"%s" 2>/dev/null || echo "")
        if [ -n "$pr_number" ] && pr_info=$(get_pr_info "$pr_number"); then
            pr_title=$(echo "$pr_info" | cut -d'|' -f1)
            pr_labels=$(echo "$pr_info" | cut -d'|' -f2)
            version_type=$(determine_version_type "$pr_number" "$pr_title" "$pr_labels" "$recent_commits")
        else
            version_type=$(determine_version_type "" "$last_commit_message" "" "$recent_commits")
        fi
    fi
    
    print_status "Would bump version: $current_version -> $version_type"
    
    # Simulate version bump
    new_version=$(npm version "$version_type" --dry-run 2>/dev/null | grep -o 'v.*' || echo "simulated")
    print_status "New version would be: $new_version"
    
    exit 0
fi

# Override version type if forced
if [ -n "$FORCE_TYPE" ]; then
    determine_version_type() {
        echo "$FORCE_TYPE"
    }
    print_status "Forcing version bump type: $FORCE_TYPE"
fi

# Run main function
main