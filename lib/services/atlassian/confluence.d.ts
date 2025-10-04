import { BaseAtlassianService } from './base.js';
export interface ConfluencePage {
    id: string;
    title: string;
    content: string;
    url: string;
}
export declare class ConfluenceService extends BaseAtlassianService {
    constructor();
    /**
     * Get Confluence pages linked to a Jira ticket
     */
    getConfluencePages(ticketKey: string, remoteLinks: any[]): Promise<ConfluencePage[]>;
    /**
     * Get content of a specific Confluence page
     */
    getConfluencePageContent(pageUrl: string): Promise<ConfluencePage | null>;
    /**
     * Validate Confluence connection
     */
    validateConnection(): Promise<boolean>;
}
//# sourceMappingURL=confluence.d.ts.map