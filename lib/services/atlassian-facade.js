import { JiraService as AtlassianJiraService } from './atlassian/jira.js';
import { ConfluenceService } from './atlassian/confluence.js';
export class JiraService {
    constructor() {
        this.confluenceService = null;
        this.jiraService = new AtlassianJiraService();
        // Initialize Confluence service
        this.confluenceService = new ConfluenceService();
    }
    async getTicket(ticketKey, fetchConfluence = false) {
        // Get the base Jira ticket
        const jiraTicket = await this.jiraService.getTicket(ticketKey);
        // Fetch Confluence pages if requested
        let confluencePages = [];
        if (fetchConfluence && this.confluenceService) {
            const remoteLinks = await this.jiraService.getRemoteLinks(ticketKey);
            confluencePages = await this.confluenceService.getConfluencePages(ticketKey, remoteLinks);
        }
        // Return the ticket with Confluence pages if any
        return {
            ...jiraTicket,
            confluencePages: confluencePages.length > 0 ? confluencePages : undefined
        };
    }
    /**
     * Check if a Jira ticket has linked Confluence pages
     */
    async hasConfluencePages(ticketKey) {
        return this.jiraService.hasConfluencePages(ticketKey);
    }
    /**
     * Get Confluence pages linked to a Jira ticket
     */
    async getConfluencePages(ticketKey) {
        if (!this.confluenceService) {
            return [];
        }
        const remoteLinks = await this.jiraService.getRemoteLinks(ticketKey);
        return await this.confluenceService.getConfluencePages(ticketKey, remoteLinks);
    }
    /**
     * Get content of a specific Confluence page
     */
    async getConfluencePageContent(pageUrl) {
        if (!this.confluenceService) {
            return null;
        }
        return this.confluenceService.getConfluencePageContent(pageUrl);
    }
    /**
     * Validate connection to Jira
     */
    async validateConnection() {
        return this.jiraService.validateConnection();
    }
}
//# sourceMappingURL=atlassian-facade.js.map