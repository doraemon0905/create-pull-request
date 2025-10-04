import { BaseAtlassianService } from './base.js';
import { API_URLS, JIRA_ENDPOINTS } from '../../constants/index.js';

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

export class JiraService extends BaseAtlassianService {
    constructor() {
        super('jira');

        // Override base URL to include Jira API version
        this.client.defaults.baseURL = `${this.config.baseUrl}${API_URLS.JIRA_API_VERSION}`;
    }

    async getTicket(ticketKey: string): Promise<JiraTicket> {
        const response = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${ticketKey}`, {
            params: {
                fields: 'summary,description,issuetype,status,assignee,reporter,created,updated,parent'
            }
        });

        const issue = response.data;
        const fields = issue.fields;

        const parentTicket = await this.fetchParentTicket(fields);

        return this.buildJiraTicket(issue, fields, parentTicket);
    }

    /**
     * Fetch parent ticket information if it exists and is not an Epic
     */
    private async fetchParentTicket(fields: any): Promise<any> {
        if (!fields.parent || fields.issuetype.name.toLowerCase() === 'epic') {
            return null;
        }

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

    /**
     * Build the JiraTicket object from the fetched data
     */
    private buildJiraTicket(issue: any, fields: any, parentTicket: any): JiraTicket {
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
            parentTicket
        };
    }

    /**
     * Check if a Jira ticket has linked Confluence pages
     */
    async hasConfluencePages(ticketKey: string): Promise<boolean> {
        const remoteLinksResponse = await this.client.get(
            JIRA_ENDPOINTS.REMOTE_LINK.replace('{issueKey}', ticketKey)
        );

        const remoteLinks = remoteLinksResponse.data;
        if (!Array.isArray(remoteLinks)) {
            return false;
        }

        // Check if any links are Confluence pages
        return remoteLinks.some((link: any) =>
            link.object?.url &&
            (link.object.url.includes('confluence') || link.object.url.includes('wiki'))
        );
    }

    /**
     * Get remote links from a Jira ticket
     */
    async getRemoteLinks(ticketKey: string): Promise<any[]> {
        const remoteLinksResponse = await this.client.get(
            JIRA_ENDPOINTS.REMOTE_LINK.replace('{issueKey}', ticketKey)
        );

        const remoteLinks = remoteLinksResponse.data;
        return Array.isArray(remoteLinks) ? remoteLinks : [];
    }
}
