#!/bin/bash

# Quick Publish Script - For experienced users who want minimal prompts
# Usage: ./scripts/quick-publish.sh [patch|minor|major] [--dry-run]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
VERSION_TYPE=${1:-"patch"}
DRY_RUN=false

if [[ "$2" == "--dry-run" ]] || [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# Validate version type
if [[ ! $VERSION_TYPE =~ ^(patch|minor|major)$ ]]; then
    print_error "Invalid version type: $VERSION_TYPE"
    echo "Usage: $0 [patch|minor|major] [--dry-run]"
    exit 1
fi

print_status "Quick publish: $VERSION_TYPE version $([ "$DRY_RUN" = true ] && echo "(DRY RUN)")"

# Check basic requirements
if [ ! -f "package.json" ]; then
    print_error "package.json not found"
    exit 1
fi

if ! npm whoami > /dev/null 2>&1; then
    print_error "Not logged into npm. Run 'npm login' first."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory not clean. Commit changes first."
    exit 1
fi

# Current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Run quick validation
print_status "Running validation..."
npm run lint > /dev/null
npm run build > /dev/null
npm test > /dev/null
print_success "Validation passed"

# Bump version
if [ "$DRY_RUN" = false ]; then
    print_status "Bumping version..."
    npm version "$VERSION_TYPE"
    NEW_VERSION=$(node -p "require('./package.json').version")
    print_success "Version bumped to: $NEW_VERSION"
fi

# Publish
if [ "$DRY_RUN" = true ]; then
    print_status "Dry run - showing what would be published..."
    npm publish --dry-run
    print_success "Dry run completed"
else
    print_status "Publishing to npm..."
    npm publish
    print_success "Published successfully!"
    
    # Show result
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo ""
    print_success "🎉 Package published!"
    print_status "Install with: npm install -g $PACKAGE_NAME@$NEW_VERSION"
    print_status "View on npm: https://www.npmjs.com/package/$PACKAGE_NAME"
fi