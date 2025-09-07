#!/bin/bash

# NPM Package Publish Script
# This script handles the complete publish workflow for the create-pull-request package

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if user is logged into npm
print_status "Checking npm authentication..."
if ! npm whoami > /dev/null 2>&1; then
    print_error "You are not logged into npm. Please run 'npm login' first."
    exit 1
fi

NPM_USER=$(npm whoami)
print_success "Logged in as: $NPM_USER"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Ask for version bump type
echo ""
echo "Select version bump type:"
echo "1) patch (bug fixes) - $CURRENT_VERSION -> $(npm version patch --dry-run | grep -o 'v.*')"
echo "2) minor (new features) - $CURRENT_VERSION -> $(npm version minor --dry-run | grep -o 'v.*')"
echo "3) major (breaking changes) - $CURRENT_VERSION -> $(npm version major --dry-run | grep -o 'v.*')"
echo "4) custom version"
echo "5) skip version bump"

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
        read -p "Enter custom version (e.g., 1.2.3): " CUSTOM_VERSION
        if [[ ! $CUSTOM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            print_error "Invalid version format. Please use semantic versioning (x.y.z)"
            exit 1
        fi
        VERSION_TYPE="$CUSTOM_VERSION"
        ;;
    5)
        print_status "Skipping version bump"
        VERSION_TYPE=""
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Pre-publish checks
print_status "Running pre-publish checks..."

# Check if git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Working directory is not clean. The following files have changes:"
    git status --porcelain
    echo ""
    read -p "Do you want to continue? (y/N): " continue_dirty
    if [[ $continue_dirty != "y" && $continue_dirty != "Y" ]]; then
        print_error "Publish cancelled. Please commit or stash your changes."
        exit 1
    fi
fi

# Run tests if they exist
if npm run test --dry-run > /dev/null 2>&1; then
    print_status "Running tests..."
    npm test
    print_success "Tests passed"
else
    print_warning "No tests found, skipping test execution"
fi

# Run linting
if npm run lint --dry-run > /dev/null 2>&1; then
    print_status "Running linter..."
    npm run lint
    print_success "Linting passed"
else
    print_warning "No linting configured, skipping lint check"
fi

# Build the project
print_status "Building project..."
npm run build
print_success "Build completed"

# Bump version if requested
if [ -n "$VERSION_TYPE" ]; then
    print_status "Bumping version..."
    if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # Custom version
        npm version "$VERSION_TYPE" --no-git-tag-version
    else
        # Standard version bump
        npm version "$VERSION_TYPE"
    fi
    NEW_VERSION=$(node -p "require('./package.json').version")
    print_success "Version bumped to: $NEW_VERSION"
fi

# Show package info
print_status "Package information:"
echo "  Name: $(node -p "require('./package.json').name")"
echo "  Version: $(node -p "require('./package.json').version")"
echo "  Description: $(node -p "require('./package.json').description")"

# Ask for confirmation
echo ""
read -p "Are you ready to publish to npm? (y/N): " confirm
if [[ $confirm != "y" && $confirm != "Y" ]]; then
    print_error "Publish cancelled by user"
    exit 1
fi

# Check if this version already exists
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

if npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version > /dev/null 2>&1; then
    print_error "Version $PACKAGE_VERSION already exists on npm!"
    print_status "Published versions:"
    npm view "$PACKAGE_NAME" versions --json | jq -r '.[-5:] | .[]' 2>/dev/null || npm view "$PACKAGE_NAME" versions
    exit 1
fi

# Dry run first
print_status "Running publish dry run..."
npm publish --dry-run

# Final confirmation
echo ""
read -p "Dry run completed. Proceed with actual publish? (y/N): " final_confirm
if [[ $final_confirm != "y" && $final_confirm != "Y" ]]; then
    print_error "Publish cancelled by user"
    exit 1
fi

# Publish to npm
print_status "Publishing to npm..."
npm publish

print_success "Package published successfully!"
print_success "You can install it with: npm install -g $PACKAGE_NAME"

# Create and push git tag if version was bumped
if [ -n "$VERSION_TYPE" ] && [[ ! $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION=$(node -p "require('./package.json').version")
    print_status "Creating git tag v$NEW_VERSION..."
    git tag "v$NEW_VERSION"
    
    read -p "Push tag to remote repository? (y/N): " push_tag
    if [[ $push_tag == "y" || $push_tag == "Y" ]]; then
        git push origin "v$NEW_VERSION"
        print_success "Tag pushed to remote repository"
    fi
fi

# Show final information
echo ""
print_success "🎉 Publish completed!"
echo ""
print_status "Next steps:"
echo "  • Check your package on npm: https://www.npmjs.com/package/$PACKAGE_NAME"
echo "  • Test installation: npm install -g $PACKAGE_NAME"
echo "  • Update documentation if needed"
echo "  • Consider creating a GitHub release"