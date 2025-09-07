#!/bin/bash

# Pre-publish validation script
# Comprehensive checks before publishing to npm

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

ERRORS=0

# Function to track errors
add_error() {
    ERRORS=$((ERRORS + 1))
    print_error "$1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "🔍 Running pre-publish validation checks..."
echo ""

# 1. Check package.json required fields
print_status "Checking package.json fields..."
PACKAGE_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "")
PACKAGE_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
PACKAGE_DESCRIPTION=$(node -p "require('./package.json').description" 2>/dev/null || echo "")
PACKAGE_LICENSE=$(node -p "require('./package.json').license" 2>/dev/null || echo "")
PACKAGE_AUTHOR=$(node -p "require('./package.json').author" 2>/dev/null || echo "")

if [ -z "$PACKAGE_NAME" ]; then
    add_error "Package name is missing"
else
    print_success "Package name: $PACKAGE_NAME"
fi

if [ -z "$PACKAGE_VERSION" ]; then
    add_error "Package version is missing"
else
    print_success "Package version: $PACKAGE_VERSION"
fi

if [ -z "$PACKAGE_DESCRIPTION" ]; then
    add_error "Package description is missing"
else
    print_success "Package description found"
fi

if [ -z "$PACKAGE_LICENSE" ]; then
    print_warning "Package license is missing"
else
    print_success "Package license: $PACKAGE_LICENSE"
fi

if [ -z "$PACKAGE_AUTHOR" ]; then
    print_warning "Package author is missing"
else
    print_success "Package author: $PACKAGE_AUTHOR"
fi

echo ""

# 2. Check if main entry point exists
print_status "Checking entry points..."
MAIN_FILE=$(node -p "require('./package.json').main" 2>/dev/null || echo "")
if [ -n "$MAIN_FILE" ] && [ ! -f "$MAIN_FILE" ]; then
    add_error "Main entry point '$MAIN_FILE' does not exist"
else
    print_success "Main entry point exists: $MAIN_FILE"
fi

# Check bin files
BIN_FILES=$(node -p "JSON.stringify(Object.values(require('./package.json').bin || {}))" 2>/dev/null)
if [ "$BIN_FILES" != "undefined" ]; then
    echo "$BIN_FILES" | jq -r '.[]' | while read -r bin_file; do
        if [ ! -f "$bin_file" ]; then
            add_error "Binary file '$bin_file' does not exist"
        else
            print_success "Binary file exists: $bin_file"
        fi
    done
fi

echo ""

# 3. Check TypeScript build
print_status "Checking TypeScript compilation..."
if [ -f "tsconfig.json" ]; then
    npm run build > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_success "TypeScript compilation successful"
    else
        add_error "TypeScript compilation failed"
    fi
else
    print_warning "No tsconfig.json found, skipping TypeScript check"
fi

echo ""

# 4. Check for essential files
print_status "Checking for essential files..."
essential_files=("README.md" "LICENSE" ".gitignore")
for file in "${essential_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_warning "$file is missing (recommended)"
    fi
done

echo ""

# 5. Check git status
print_status "Checking git status..."
if [ ! -d ".git" ]; then
    print_warning "Not a git repository"
elif [ -n "$(git status --porcelain)" ]; then
    print_warning "Working directory is not clean:"
    git status --porcelain
else
    print_success "Working directory is clean"
fi

echo ""

# 6. Check dependencies
print_status "Checking dependencies..."
if command -v npm-check-updates > /dev/null; then
    print_status "Checking for outdated dependencies..."
    ncu --format group
else
    print_warning "npm-check-updates not installed, skipping dependency check"
fi

echo ""

# 7. Run tests
print_status "Running tests..."
if npm run test --dry-run > /dev/null 2>&1; then
    npm run test
    if [ $? -eq 0 ]; then
        print_success "Tests passed"
    else
        add_error "Tests failed"
    fi
else
    print_warning "No test script found"
fi

echo ""

# 8. Run linting
print_status "Running linter..."
if npm run lint --dry-run > /dev/null 2>&1; then
    npm run lint
    if [ $? -eq 0 ]; then
        print_success "Linting passed"
    else
        add_error "Linting failed"
    fi
else
    print_warning "No lint script found"
fi

echo ""

# 9. Check npm authentication
print_status "Checking npm authentication..."
if npm whoami > /dev/null 2>&1; then
    NPM_USER=$(npm whoami)
    print_success "Logged in to npm as: $NPM_USER"
else
    add_error "Not logged in to npm. Run 'npm login' first."
fi

echo ""

# 10. Check if version already exists on npm
print_status "Checking if version exists on npm..."
if npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version > /dev/null 2>&1; then
    add_error "Version $PACKAGE_VERSION already exists on npm!"
    print_status "Published versions:"
    npm view "$PACKAGE_NAME" versions --json | jq -r '.[-5:] | .[]' 2>/dev/null || npm view "$PACKAGE_NAME" versions
else
    print_success "Version $PACKAGE_VERSION is available"
fi

echo ""

# 11. Security audit
print_status "Running security audit..."
npm audit --audit-level=high
if [ $? -eq 0 ]; then
    print_success "No high or critical security issues found"
else
    print_warning "Security issues found. Review and fix before publishing."
fi

echo ""

# 12. Check bundle size (if bundled)
if [ -f "lib/index.js" ]; then
    print_status "Checking bundle size..."
    SIZE=$(du -sh lib/ | cut -f1)
    print_status "Built package size: $SIZE"
fi

echo ""

# Summary
print_status "📋 Validation Summary:"
echo "===================="

if [ $ERRORS -eq 0 ]; then
    print_success "✅ All validation checks passed!"
    print_success "Package is ready for publishing"
    echo ""
    print_status "Next steps:"
    echo "  1. Run 'npm run publish:dry' for a dry run"
    echo "  2. Run 'npm run publish:full' to publish"
    echo "  or"
    echo "  3. Run './scripts/publish.sh' for interactive publish"
    exit 0
else
    print_error "❌ Found $ERRORS error(s) that must be fixed before publishing"
    echo ""
    print_status "Please fix the errors above and run this script again"
    exit 1
fi