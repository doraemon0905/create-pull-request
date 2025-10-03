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
    private jiraConfig;
    constructor();
    private initializeConfluenceClient;
    getTicket(ticketKey: string, fetchConfluence?: boolean): Promise<JiraTicket>;
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
     * Strip HTML tags and compress content for AI consumption
     */
    private stripHtmlAndCompress;
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=jira.d.ts.map