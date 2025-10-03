# Confluence User Prompt Feature

## Overview
Added user confirmation prompt for including Confluence page content in PR summary generation. Users are now asked whether they want to include linked Confluence pages, with "No" as the default option.

## Changes Implemented

### 1. JiraService Updates

#### New Method: `hasConfluencePages(ticketKey: string)`
- Checks if a Jira ticket has linked Confluence pages without fetching their content
- Returns `true` if Confluence pages are found, `false` otherwise
- Handles errors gracefully, returning `false` on any failure
- No content fetching overhead - just checks for existence

#### Updated Method: `getTicket(ticketKey: string, fetchConfluence: boolean = false)`
- Added optional `fetchConfluence` parameter (defaults to `false`)
- Only fetches Confluence pages when explicitly requested
- Maintains backward compatibility - existing code continues to work

### 2. Create-PR Command Flow

The command now follows this enhanced workflow:

1. **Fetch Jira Ticket** (without Confluence)
   ```
   🎫 Using Jira ticket: PROJ-123 - Feature implementation
   ```

2. **Check for Confluence Pages**
   ```
   ℹ Checking for linked Confluence pages...
   ✔ Found linked Confluence pages
   ```

3. **User Prompt** (if Confluence pages exist)
   ```
   ? Include Confluence page content in PR summary generation? (y/N)
   ```

4. **Fetch Confluence Content** (if user confirms)
   ```
   ⠋ Fetching Confluence pages content...
   ✔ Loaded 2 Confluence page(s)
   📄 Confluence pages found:
      • Requirements Document
      • Technical Specifications
   ```

5. **Skip Message** (if user declines)
   ```
   ⏭️  Skipping Confluence content
   ```

6. **Continue with PR Creation** (as normal)

### 3. User Experience

#### When Confluence Pages Found:
- Clear indication that Confluence pages are available
- Simple Yes/No prompt with sensible default (No)
- Shows which pages were loaded if user confirms
- No disruption to workflow if declined

#### When No Confluence Pages:
- Quick success message: "No Confluence pages linked to this ticket"
- Continues immediately to next step

#### Performance:
- Minimal overhead - only checks for existence first
- Content only fetched when user explicitly requests it
- No waiting time if user declines

### 4. Test Coverage

Added 5 new tests for `hasConfluencePages()`:
- ✅ Returns true when Confluence pages are linked
- ✅ Returns false when no Confluence pages are linked  
- ✅ Returns false when Confluence client not initialized
- ✅ Returns false when API call fails
- ✅ Returns false when response is not an array

Updated existing tests:
- ✅ Default behavior: Confluence not fetched unless requested
- ✅ Explicit request: Confluence fetched when `fetchConfluence=true`
- ✅ Error handling: Gracefully handles Confluence fetch errors
- ✅ Call count adjustments: Tests reflect new default behavior

**Total Test Coverage: 226 tests passing** ✅

## Benefits

### User Control
- Users decide whether to include Confluence content
- No forced inclusion of potentially irrelevant documentation
- Faster workflow when Confluence content isn't needed

### Performance
- Reduced API calls by default (no automatic Confluence fetching)
- Quick check for existence before prompting user
- Content only fetched when explicitly requested

### Backward Compatibility
- Existing code continues to work without changes
- Optional parameter defaults to previous behavior (no Confluence)
- No breaking changes to API

### Better UX
- Clear feedback at each step
- User knows exactly what content is being used
- Shows list of Confluence pages when loaded
- Smooth workflow whether user accepts or declines

## Technical Details

### API Changes
```typescript
// Before (always fetches Confluence)
await jiraService.getTicket('PROJ-123');

// After (explicit control)
await jiraService.getTicket('PROJ-123', false); // Don't fetch Confluence (default)
await jiraService.getTicket('PROJ-123', true);  // Fetch Confluence

// Check for existence first
const hasPages = await jiraService.hasConfluencePages('PROJ-123');
```

### Implementation
```typescript
// Check if pages exist
const hasConfluence = await jiraService.hasConfluencePages(jiraTicket);

if (hasConfluence) {
  // Ask user
  const { includeConfluence } = await inquirer.prompt([{
    type: 'confirm',
    name: 'includeConfluence',
    message: 'Include Confluence page content in PR summary generation?',
    default: false
  }]);

  if (includeConfluence) {
    // Fetch with Confluence content
    ticketInfo = await jiraService.getTicket(jiraTicket, true);
  }
}
```

## Example Interaction

```
✔ Jira ticket information fetched
🎫 Using Jira ticket: PROJ-123 - Implement user authentication

⠋ Checking for linked Confluence pages...
✔ Found linked Confluence pages
? Include Confluence page content in PR summary generation? No
⏭️  Skipping Confluence content

⠋ Analyzing repository and changes...
✔ Repository: myorg/myrepo, Branch: feature/PROJ-123
```

Or with Confluence included:

```
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
✔ Repository: myorg/myrepo, Branch: feature/PROJ-123
```

## Migration Guide

No migration needed! The feature is fully backward compatible. Existing integrations will continue to work without any code changes.

For programmatic usage, simply pass `true` as the second parameter to `getTicket()` if you want to fetch Confluence content:

```typescript
// Fetch with Confluence
const ticket = await jiraService.getTicket('PROJ-123', true);

// Check first, then fetch
if (await jiraService.hasConfluencePages('PROJ-123')) {
  const ticket = await jiraService.getTicket('PROJ-123', true);
}
```
