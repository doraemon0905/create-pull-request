export interface ConfluencePage {
    id: string;
    title: string;
    content: string;
    url: string;
}
export interface JiraTicket {
    key: string;
    summary: string;
    description: string;
    issueType: string;
    status: string;
    assignee: string | null;
    reporter: string;
    created: string;
    updated: string;
    parentTicket?: {
        key: string;
        summary: string;
        issueType: string;
    } | null;
    confluencePages?: ConfluencePage[];
}
export declare class JiraService {
    private client;
    private confluenceClient;
    private readonly jiraConfig;
    constructor();
    private initializeConfluenceClient;
    getTicket(ticketKey: string, fetchConfluence?: boolean): Promise<JiraTicket>;
    /**
     * Fetch parent ticket information if it exists and is not an Epic
     */
    private fetchParentTicket;
    /**
     * Fetch Confluence pages if requested
     */
    private fetchConfluencePagesIfRequested;
    /**
     * Build the JiraTicket object from the fetched data
     */
    private buildJiraTicket;
    /**
     * Handle Jira API errors with specific error messages
     */
    private handleJiraApiError;
    /**
     * Check if a Jira ticket has linked Confluence pages
     */
    hasConfluencePages(ticketKey: string): Promise<boolean>;
    /**
     * Get Confluence pages linked to a Jira ticket
     */
    getConfluencePages(ticketKey: string): Promise<ConfluencePage[]>;
    /**
     * Get content of a specific Confluence page
     */
    getConfluencePageContent(pageUrl: string): Promise<ConfluencePage | null>;
    /**
     * Manually remove HTML tags without using regex to prevent ReDoS attacks
     * This approach is O(n) linear time and completely safe from backtracking
     */
    private removeHtmlTagsManually;
    /**
     * Strip HTML tags and compress content for AI consumption
     * Uses manual parsing instead of regex to prevent ReDoS attacks
     */
    private stripHtmlAndCompress;
    /**
     * Truncate content at sentence boundaries using OWASP-compliant regex to prevent ReDoS attacks
     * Uses lookahead assertions and backreferences to mimic possessive quantifiers
     */
    private truncateAtSentenceBoundary;
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=jira.d.ts.map