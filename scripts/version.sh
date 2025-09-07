#!/bin/bash

# Version Bump Script
# Simple script to bump package version without publishing

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# If argument provided, use it
if [ $# -eq 1 ]; then
    VERSION_TYPE="$1"
else
    # Interactive mode
    echo ""
    echo "Select version bump type:"
    echo "1) patch (bug fixes) - $CURRENT_VERSION -> $(npm version patch --dry-run 2>/dev/null | grep -o 'v.*' || echo 'N/A')"
    echo "2) minor (new features) - $CURRENT_VERSION -> $(npm version minor --dry-run 2>/dev/null | grep -o 'v.*' || echo 'N/A')"
    echo "3) major (breaking changes) - $CURRENT_VERSION -> $(npm version major --dry-run 2>/dev/null | grep -o 'v.*' || echo 'N/A')"
    echo "4) prerelease (alpha/beta) - $CURRENT_VERSION -> $(npm version prerelease --dry-run 2>/dev/null | grep -o 'v.*' || echo 'N/A')"
    echo "5) custom version"

    read -p "Enter your choice (1-5): " choice

    case $choice in
        1)
            VERSION_TYPE="patch"
            ;;
        2)
            VERSION_TYPE="minor"
            ;;
        3)
            VERSION_TYPE="major"
            ;;
        4)
            VERSION_TYPE="prerelease"
            ;;
        5)
            read -p "Enter custom version (e.g., 1.2.3): " CUSTOM_VERSION
            if [[ ! $CUSTOM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+([a-zA-Z0-9\-\.]+)?$ ]]; then
                print_error "Invalid version format. Please use semantic versioning (x.y.z or x.y.z-pre.1)"
                exit 1
            fi
            VERSION_TYPE="$CUSTOM_VERSION"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
fi

# Validate version type argument
if [[ ! $VERSION_TYPE =~ ^(patch|minor|major|prerelease)$ ]] && [[ ! $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+([a-zA-Z0-9\-\.]+)?$ ]]; then
    print_error "Invalid version type: $VERSION_TYPE"
    print_status "Valid types: patch, minor, major, prerelease, or custom version (e.g., 1.2.3)"
    exit 1
fi

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit your changes first."
    git status --porcelain
    exit 1
fi

# Bump version
print_status "Bumping version..."
if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+([a-zA-Z0-9\-\.]+)?$ ]]; then
    # Custom version - don't create git tag automatically
    npm version "$VERSION_TYPE" --no-git-tag-version
    NEW_VERSION="$VERSION_TYPE"
else
    # Standard version bump with git tag
    npm version "$VERSION_TYPE"
    NEW_VERSION=$(node -p "require('./package.json').version")
fi

print_success "Version bumped from $CURRENT_VERSION to $NEW_VERSION"

# Show what changed
print_status "Changes made:"
echo "  • package.json version updated"
if [[ ! $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+([a-zA-Z0-9\-\.]+)?$ ]]; then
    echo "  • Git tag v$NEW_VERSION created"
fi

# Ask if user wants to push
if git tag -l | grep -q "v$NEW_VERSION"; then
    echo ""
    read -p "Push tag to remote repository? (y/N): " push_tag
    if [[ $push_tag == "y" || $push_tag == "Y" ]]; then
        git push origin "v$NEW_VERSION"
        print_success "Tag v$NEW_VERSION pushed to remote repository"
    fi
fi

print_success "Version bump completed!"
print_status "Next: Run './scripts/publish.sh' to publish to npm"