import { BaseAtlassianService } from './base.js';
import { CONFLUENCE_ENDPOINTS, LIMITS } from '../../constants/index.js';
export class ConfluenceService extends BaseAtlassianService {
    constructor() {
        super('jira'); // Use jira config since Confluence typically shares the same credentials
        // Override base URL to include Confluence API version
        this.client.defaults.baseURL = `${this.config.baseUrl}${CONFLUENCE_ENDPOINTS.API_VERSION}`;
    }
    /**
     * Get Confluence pages linked to a Jira ticket
     */
    async getConfluencePages(ticketKey, remoteLinks) {
        const confluencePages = [];
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
            const pageContent = await this.getConfluencePageContent(link.object.url);
            if (pageContent) {
                confluencePages.push(pageContent);
            }
        }
        return confluencePages;
    }
    /**
     * Get content of a specific Confluence page
     */
    async getConfluencePageContent(pageUrl) {
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
            const searchResponse = await this.client.get(`${CONFLUENCE_ENDPOINTS.SEARCH}?cql=space=${encodedSpaceKey}+AND+title="${encodedPageTitle}"`);
            if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                pageId = searchResponse.data.results[0].id;
            }
        }
        if (!pageId) {
            return null;
        }
        // Fetch page content with expanded body storage
        const pageResponse = await this.client.get(CONFLUENCE_ENDPOINTS.CONTENT_BY_ID.replace('{id}', pageId), {
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
    /**
     * Validate Confluence connection
     */
    async validateConnection() {
        // Try to access Confluence REST API
        await this.client.get('/user/current');
        return true;
    }
}
//# sourceMappingURL=confluence.js.map