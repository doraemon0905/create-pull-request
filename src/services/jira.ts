import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config.js';
import { API_URLS, JIRA_ENDPOINTS, CONFLUENCE_ENDPOINTS, HEADERS, HTTP_STATUS, LIMITS } from '../constants/index.js';

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

export class JiraService {
  private client: AxiosInstance;
  private confluenceClient: AxiosInstance | null = null;
  private jiraConfig: any;

  constructor() {
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

  private initializeConfluenceClient(): void {
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
    } catch (error) {
      console.warn('Warning: Could not initialize Confluence client:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getTicket(ticketKey: string, fetchConfluence: boolean = false): Promise<JiraTicket> {
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
    } catch (error) {
      this.handleJiraApiError(error, ticketKey);
    }
  }

  /**
   * Fetch parent ticket information if it exists and is not an Epic
   */
  private async fetchParentTicket(fields: any): Promise<any> {
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
    } catch (parentError) {
      console.warn(`Warning: Could not fetch parent ticket ${fields.parent.key}:`,
        parentError instanceof Error ? parentError.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Fetch Confluence pages if requested
   */
  private async fetchConfluencePagesIfRequested(ticketKey: string, fetchConfluence: boolean): Promise<ConfluencePage[]> {
    if (!fetchConfluence) {
      return [];
    }

    try {
      return await this.getConfluencePages(ticketKey);
    } catch (error) {
      console.warn(`Warning: Could not fetch Confluence pages for ticket ${ticketKey}:`,
        error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Build the JiraTicket object from the fetched data
   */
  private buildJiraTicket(issue: any, fields: any, parentTicket: any, confluencePages: ConfluencePage[]): JiraTicket {
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
  private handleJiraApiError(error: any, ticketKey: string): never {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === HTTP_STATUS.NOT_FOUND) {
        throw new Error(`Jira ticket '${ticketKey}' not found. Please check the ticket key.`);
      } else if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
        throw new Error('Authentication failed. Please check your Jira credentials.');
      } else if (error.response?.status === HTTP_STATUS.FORBIDDEN) {
        throw new Error('Access denied. Please check your Jira permissions.');
      }
      throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
    throw error;
  }

  /**
   * Check if a Jira ticket has linked Confluence pages
   */
  async hasConfluencePages(ticketKey: string): Promise<boolean> {
    if (!this.confluenceClient) {
      return false;
    }

    try {
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
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get Confluence pages linked to a Jira ticket
   */
  async getConfluencePages(ticketKey: string): Promise<ConfluencePage[]> {
    if (!this.confluenceClient) {
      console.warn('Confluence client not initialized, skipping Confluence pages fetch');
      return [];
    }

    try {
      // Get remote links from Jira ticket
      const remoteLinksResponse = await this.client.get(
        JIRA_ENDPOINTS.REMOTE_LINK.replace('{issueKey}', ticketKey)
      );

      const confluencePages: ConfluencePage[] = [];
      const remoteLinks = remoteLinksResponse.data;

      if (!Array.isArray(remoteLinks)) {
        return [];
      }

      // Filter for Confluence links and limit the count
      const confluenceLinks = remoteLinks
        .filter((link: any) =>
          link.object?.url &&
          (link.object.url.includes('confluence') || link.object.url.includes('wiki'))
        )
        .slice(0, LIMITS.MAX_CONFLUENCE_PAGES_COUNT);

      // Fetch content for each Confluence page
      for (const link of confluenceLinks) {
        try {
          const pageContent = await this.getConfluencePageContent(link.object.url);
          if (pageContent) {
            confluencePages.push(pageContent);
          }
        } catch (error) {
          console.warn(`Warning: Could not fetch Confluence page content for ${link.object.url}:`,
            error instanceof Error ? error.message : 'Unknown error');
        }
      }

      return confluencePages;
    } catch (error) {
      console.warn(`Warning: Could not fetch Confluence pages for ticket ${ticketKey}:`,
        error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get content of a specific Confluence page
   */
  async getConfluencePageContent(pageUrl: string): Promise<ConfluencePage | null> {
    if (!this.confluenceClient) {
      return null;
    }

    try {
      // Extract page ID from URL (typical format: /pages/viewpage.action?pageId=123456)
      const pageIdMatch = pageUrl.match(/pageId=(\d+)/);
      const spaceKeyPageTitleMatch = pageUrl.match(/\/spaces\/([^/]+)\/pages\/\d+\/([^/?]+)/);

      let pageId: string | null = null;

      if (pageIdMatch) {
        pageId = pageIdMatch[1];
      } else if (spaceKeyPageTitleMatch) {
        // For newer Confluence URLs, we need to search by space and title
        const spaceKey = spaceKeyPageTitleMatch[1];
        const pageTitle = decodeURIComponent(spaceKeyPageTitleMatch[2].replace(/\+/g, ' '));

        // Properly encode spaceKey and pageTitle to prevent CQL injection
        const encodedSpaceKey = encodeURIComponent(spaceKey);
        const encodedPageTitle = encodeURIComponent(pageTitle).replace(/"/g, '\\"');
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
      const pageResponse = await this.confluenceClient.get(
        CONFLUENCE_ENDPOINTS.CONTENT_BY_ID.replace('{id}', pageId),
        {
          params: {
            expand: 'body.storage,space'
          }
        }
      );

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
    } catch (error) {
      console.warn(`Warning: Could not fetch Confluence page content from ${pageUrl}:`,
        error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Manually remove HTML tags without using regex to prevent ReDoS attacks
   * This approach is O(n) linear time and completely safe from backtracking
   */
  private removeHtmlTagsManually(htmlContent: string): string {
    let result = '';
    let insideTag = false;
    let tagDepth = 0;

    for (let i = 0; i < htmlContent.length; i++) {
      const char = htmlContent[i];

      if (char === '<') {
        insideTag = true;
        tagDepth++;
        result += ' '; // Replace tag with space
      } else if (char === '>') {
        insideTag = false;
        tagDepth = Math.max(0, tagDepth - 1);
      } else if (!insideTag) {
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
  private stripHtmlAndCompress(htmlContent: string): string {
    if (!htmlContent) return '';

    // Input validation to prevent ReDoS attacks
    // Limit input size to prevent excessive processing
    const maxInputLength = 100000; // 100KB limit
    if (htmlContent.length > maxInputLength) {
      htmlContent = htmlContent.substring(0, maxInputLength);
    }

    // Remove HTML tags using a secure approach that follows OWASP secure coding practices
    // Use manual parsing instead of regex to completely avoid ReDoS vulnerabilities
    let cleanContent = this.removeHtmlTagsManually(htmlContent)
      .replace(/&nbsp;/g, ' ')                   // Replace &nbsp; with space
      .replace(/&amp;/g, '&')                   // Replace &amp; with &
      .replace(/&lt;/g, '<')                    // Replace &lt; with <
      .replace(/&gt;/g, '>')                    // Replace &gt; with >
      .replace(/&quot;/g, '"')                  // Replace &quot; with "
      .replace(/\s+/g, ' ')                     // Replace multiple whitespace with single space
      .trim();

    // If content is too long, truncate intelligently
    if (cleanContent.length > LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH) {
      // Try to truncate at sentence boundaries while preserving original punctuation
      const sentenceMatches = cleanContent.match(/[^.!?]*[.!?]+/g) || [];
      let truncated = '';

      for (const sentence of sentenceMatches) {
        if ((truncated + sentence).length > LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH) {
          break;
        }
        truncated += sentence;
      }

      // Only add ellipsis if we actually truncated content
      if (truncated.length < cleanContent.length) {
        cleanContent = truncated.trim() + '...';
      } else {
        cleanContent = truncated.trim();
      }
    }

    return cleanContent;
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.get('/myself');
      return true;
    } catch {
      return false;
    }
  }
}
