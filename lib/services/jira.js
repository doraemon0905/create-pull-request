import axios from 'axios';
import { getConfig } from '../utils/config.js';
import { API_URLS, JIRA_ENDPOINTS, CONFLUENCE_ENDPOINTS, HEADERS, HTTP_STATUS, LIMITS } from '../constants/index.js';
export class JiraService {
    constructor() {
        this.confluenceClient = null;
        this.jiraConfig = getConfig('jira');
        if (!this.jiraConfig.baseUrl || !this.jiraConfig.username || !this.jiraConfig.apiToken) {
            throw new Error('Missing Jira configuration. Please run "create-pr setup" to configure your credentials.');
        }
        this.client = axios.create({
            baseURL: `${this.jiraConfig.baseUrl}${API_URLS.JIRA_API_VERSION}`,
            auth: {
                username: this.jiraConfig.username,
                password: this.jiraConfig.apiToken
            },
            headers: {
                'Accept': HEADERS.JSON_CONTENT_TYPE,
                'Content-Type': HEADERS.JSON_CONTENT_TYPE
            }
        });
        // Initialize Confluence client if baseUrl is configured
        this.initializeConfluenceClient();
    }
    initializeConfluenceClient() {
        try {
            // Use the same base URL as Jira but with Confluence REST API path
            this.confluenceClient = axios.create({
                baseURL: `${this.jiraConfig.baseUrl}${CONFLUENCE_ENDPOINTS.API_VERSION}`,
                auth: {
                    username: this.jiraConfig.username,
                    password: this.jiraConfig.apiToken
                },
                headers: {
                    'Accept': HEADERS.JSON_CONTENT_TYPE,
                    'Content-Type': HEADERS.JSON_CONTENT_TYPE
                },
                timeout: LIMITS.API_TIMEOUT_MS
            });
        }
        catch (error) {
            console.warn('Warning: Could not initialize Confluence client:', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async getTicket(ticketKey, fetchConfluence = false) {
        try {
            const response = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${ticketKey}`, {
                params: {
                    fields: 'summary,description,issuetype,status,assignee,reporter,created,updated,parent'
                }
            });
            const issue = response.data;
            const fields = issue.fields;
            const parentTicket = await this.fetchParentTicket(fields);
            const confluencePages = await this.fetchConfluencePagesIfRequested(issue.key, fetchConfluence);
            return this.buildJiraTicket(issue, fields, parentTicket, confluencePages);
        }
        catch (error) {
            this.handleJiraApiError(error, ticketKey);
        }
    }
    /**
     * Fetch parent ticket information if it exists and is not an Epic
     */
    async fetchParentTicket(fields) {
        if (!fields.parent || fields.issuetype.name.toLowerCase() === 'epic') {
            return null;
        }
        try {
            const parentResponse = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${fields.parent.key}`, {
                params: {
                    fields: 'summary,issuetype'
                }
            });
            const parentFields = parentResponse.data.fields;
            if (parentFields.summary && parentFields.summary.trim()) {
                return {
                    key: fields.parent.key,
                    summary: parentFields.summary.trim(),
                    issueType: parentFields.issuetype.name
                };
            }
            return null;
        }
        catch (parentError) {
            console.warn(`Warning: Could not fetch parent ticket ${fields.parent.key}:`, parentError instanceof Error ? parentError.message : 'Unknown error');
            return null;
        }
    }
    /**
     * Fetch Confluence pages if requested
     */
    async fetchConfluencePagesIfRequested(ticketKey, fetchConfluence) {
        if (!fetchConfluence) {
            return [];
        }
        try {
            return await this.getConfluencePages(ticketKey);
        }
        catch (error) {
            console.warn(`Warning: Could not fetch Confluence pages for ticket ${ticketKey}:`, error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }
    /**
     * Build the JiraTicket object from the fetched data
     */
    buildJiraTicket(issue, fields, parentTicket, confluencePages) {
        return {
            key: issue.key,
            summary: fields.summary,
            description: fields.description?.content?.[0]?.content?.[0]?.text || fields.description || '',
            issueType: fields.issuetype.name,
            status: fields.status.name,
            assignee: fields.assignee?.displayName || null,
            reporter: fields.reporter.displayName,
            created: fields.created,
            updated: fields.updated,
            parentTicket,
            confluencePages: confluencePages.length > 0 ? confluencePages : undefined
        };
    }
    /**
     * Handle Jira API errors with specific error messages
     */
    handleJiraApiError(error, ticketKey) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === HTTP_STATUS.NOT_FOUND) {
                throw new Error(`Jira ticket '${ticketKey}' not found. Please check the ticket key.`);
            }
            else if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
                throw new Error('Authentication failed. Please check your Jira credentials.');
            }
            else if (error.response?.status === HTTP_STATUS.FORBIDDEN) {
                throw new Error('Access denied. Please check your Jira permissions.');
            }
            throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
        }
        throw error;
    }
    /**
     * Check if a Jira ticket has linked Confluence pages
     */
    async hasConfluencePages(ticketKey) {
        if (!this.confluenceClient) {
            return false;
        }
        const remoteLinksResponse = await this.client.get(JIRA_ENDPOINTS.REMOTE_LINK.replace('{issueKey}', ticketKey));
        const remoteLinks = remoteLinksResponse.data;
        if (!Array.isArray(remoteLinks)) {
            return false;
        }
        // Check if any links are Confluence pages
        return remoteLinks.some((link) => link.object?.url &&
            (link.object.url.includes('confluence') || link.object.url.includes('wiki')));
    }
    /**
     * Get Confluence pages linked to a Jira ticket
     */
    async getConfluencePages(ticketKey) {
        if (!this.confluenceClient) {
            console.warn('Confluence client not initialized, skipping Confluence pages fetch');
            return [];
        }
        try {
            // Get remote links from Jira ticket
            const remoteLinksResponse = await this.client.get(JIRA_ENDPOINTS.REMOTE_LINK.replace('{issueKey}', ticketKey));
            const confluencePages = [];
            const remoteLinks = remoteLinksResponse.data;
            if (!Array.isArray(remoteLinks)) {
                return [];
            }
            // Filter for Confluence links and limit the count
            const confluenceLinks = remoteLinks
                .filter((link) => link.object?.url &&
                (link.object.url.includes('confluence') || link.object.url.includes('wiki')))
                .slice(0, LIMITS.MAX_CONFLUENCE_PAGES_COUNT);
            // Fetch content for each Confluence page
            for (const link of confluenceLinks) {
                try {
                    const pageContent = await this.getConfluencePageContent(link.object.url);
                    if (pageContent) {
                        confluencePages.push(pageContent);
                    }
                }
                catch (error) {
                    console.warn(`Warning: Could not fetch Confluence page content for ${link.object.url}:`, error instanceof Error ? error.message : 'Unknown error');
                }
            }
            return confluencePages;
        }
        catch (error) {
            console.warn(`Warning: Could not fetch Confluence pages for ticket ${ticketKey}:`, error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }
    /**
     * Get content of a specific Confluence page
     */
    async getConfluencePageContent(pageUrl) {
        if (!this.confluenceClient) {
            return null;
        }
        try {
            // Extract page ID from URL (typical format: /pages/viewpage.action?pageId=123456)
            const pageIdRegex = /pageId=(\d+)/;
            const spaceKeyPageTitleRegex = /\/spaces\/([^/]+)\/pages\/\d+\/([^/?]+)/;
            const pageIdMatch = pageIdRegex.exec(pageUrl);
            const spaceKeyPageTitleMatch = spaceKeyPageTitleRegex.exec(pageUrl);
            let pageId = null;
            if (pageIdMatch) {
                pageId = pageIdMatch[1];
            }
            else if (spaceKeyPageTitleMatch) {
                // For newer Confluence URLs, we need to search by space and title
                const spaceKey = spaceKeyPageTitleMatch[1];
                const pageTitle = decodeURIComponent(spaceKeyPageTitleMatch[2].replaceAll('+', ' '));
                // Properly encode spaceKey and pageTitle to prevent CQL injection
                const encodedSpaceKey = encodeURIComponent(spaceKey);
                const encodedPageTitle = encodeURIComponent(pageTitle).replaceAll('"', String.raw `\"`);
                const searchResponse = await this.confluenceClient.get(`${CONFLUENCE_ENDPOINTS.SEARCH}?cql=space=${encodedSpaceKey}+AND+title="${encodedPageTitle}"`);
                if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                    pageId = searchResponse.data.results[0].id;
                }
            }
            if (!pageId) {
                console.warn(`Could not extract page ID from URL: ${pageUrl}`);
                return null;
            }
            // Fetch page content with expanded body storage
            const pageResponse = await this.confluenceClient.get(CONFLUENCE_ENDPOINTS.CONTENT_BY_ID.replace('{id}', pageId), {
                params: {
                    expand: 'body.storage,space'
                }
            });
            const page = pageResponse.data;
            const bodyContent = page.body?.storage?.value || '';
            // Strip HTML tags and compress content
            const cleanContent = this.stripHtmlAndCompress(bodyContent);
            return {
                id: page.id,
                title: page.title || 'Untitled',
                content: cleanContent,
                url: pageUrl
            };
        }
        catch (error) {
            console.warn(`Warning: Could not fetch Confluence page content from ${pageUrl}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    /**
     * Manually remove HTML tags without using regex to prevent ReDoS attacks
     * This approach is O(n) linear time and completely safe from backtracking
     */
    removeHtmlTagsManually(htmlContent) {
        let result = '';
        let insideTag = false;
        let tagDepth = 0;
        for (const char of htmlContent) {
            if (char === '<') {
                insideTag = true;
                tagDepth++;
                result += ' '; // Replace tag with space
            }
            else if (char === '>') {
                insideTag = false;
                tagDepth = Math.max(0, tagDepth - 1);
            }
            else if (!insideTag) {
                result += char;
            }
            // Skip characters inside tags
        }
        return result;
    }
    /**
     * Strip HTML tags and compress content for AI consumption
     * Uses manual parsing instead of regex to prevent ReDoS attacks
     */
    stripHtmlAndCompress(htmlContent) {
        if (!htmlContent)
            return '';
        // Input validation to prevent ReDoS attacks
        // Limit input size to prevent excessive processing
        const maxInputLength = 100000; // 100KB limit
        if (htmlContent.length > maxInputLength) {
            htmlContent = htmlContent.substring(0, maxInputLength);
        }
        // Remove HTML tags using a secure approach that follows OWASP secure coding practices
        // Use manual parsing instead of regex to completely avoid ReDoS vulnerabilities
        let cleanContent = this.removeHtmlTagsManually(htmlContent)
            .replaceAll('&nbsp;', ' ') // Replace &nbsp; with space
            .replaceAll('&amp;', '&') // Replace &amp; with &
            .replaceAll('&lt;', '<') // Replace &lt; with <
            .replaceAll('&gt;', '>') // Replace &gt; with >
            .replaceAll('&quot;', '"') // Replace &quot; with "
            .replaceAll('\t', ' ') // Replace tabs with space
            .replaceAll('\n', ' ') // Replace newlines with space
            .replaceAll('\r', ' ') // Replace carriage returns with space
            // Handle multiple consecutive spaces
            .replaceAll('  ', ' ') // Replace double spaces with single space
            .replaceAll('  ', ' ') // Repeat to handle longer sequences
            .replaceAll('  ', ' ') // Repeat to handle longer sequences
            .trim();
        // If content is too long, truncate intelligently
        if (cleanContent.length > LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH) {
            // Use OWASP-compliant regex with lookahead assertions to prevent ReDoS
            cleanContent = this.truncateAtSentenceBoundary(cleanContent, LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH);
        }
        return cleanContent;
    }
    /**
     * Truncate content at sentence boundaries using OWASP-compliant regex to prevent ReDoS attacks
     * Uses lookahead assertions and backreferences to mimic possessive quantifiers
     */
    truncateAtSentenceBoundary(content, maxLength) {
        // OWASP-compliant regex using lookahead and backreferences to prevent backtracking
        // Pattern: (?=([^.!?]*[.!?]+))\1
        // This mimics possessive quantifiers by using atomic grouping
        const sentenceRegex = /(?=([^.!?]*[.!?]+))\1/g;
        const sentences = [];
        let match;
        // Extract all sentences using the secure regex
        while ((match = sentenceRegex.exec(content)) !== null) {
            sentences.push(match[1]);
        }
        // Build result by adding sentences until we reach the limit
        let result = '';
        for (const sentence of sentences) {
            if ((result + sentence).length > maxLength) {
                break;
            }
            result += sentence;
        }
        // Only add ellipsis if we actually truncated content
        if (result.length < content.length) {
            return result.trim() + '...';
        }
        return result.trim();
    }
    async validateConnection() {
        try {
            await this.client.get('/myself');
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=jira.js.map