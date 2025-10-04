import { BaseAtlassianService } from './base.js';
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
}
export declare class JiraService extends BaseAtlassianService {
    constructor();
    getTicket(ticketKey: string): Promise<JiraTicket>;
    /**
     * Fetch parent ticket information if it exists and is not an Epic
     */
    private fetchParentTicket;
    /**
     * Build the JiraTicket object from the fetched data
     */
    private buildJiraTicket;
    /**
     * Check if a Jira ticket has linked Confluence pages
     */
    hasConfluencePages(ticketKey: string): Promise<boolean>;
    /**
     * Get remote links from a Jira ticket
     */
    getRemoteLinks(ticketKey: string): Promise<any[]>;
}
//# sourceMappingURL=jira.d.ts.map