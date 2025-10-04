import { JiraService as AtlassianJiraService } from './atlassian/jira.js';
import { ConfluenceService } from './atlassian/confluence.js';

// Re-export interfaces for backward compatibility
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
  private jiraService: AtlassianJiraService;
  private confluenceService: ConfluenceService | null = null;

  constructor() {
    this.jiraService = new AtlassianJiraService();

    // Initialize Confluence service
    this.confluenceService = new ConfluenceService();
  }

  async getTicket(ticketKey: string, fetchConfluence: boolean = false): Promise<JiraTicket> {
    // Get the base Jira ticket
    const jiraTicket = await this.jiraService.getTicket(ticketKey);

    // Fetch Confluence pages if requested
    let confluencePages: ConfluencePage[] = [];
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
  async hasConfluencePages(ticketKey: string): Promise<boolean> {
    return this.jiraService.hasConfluencePages(ticketKey);
  }

  /**
   * Get Confluence pages linked to a Jira ticket
   */
  async getConfluencePages(ticketKey: string): Promise<ConfluencePage[]> {
    if (!this.confluenceService) {
      return [];
    }

    const remoteLinks = await this.jiraService.getRemoteLinks(ticketKey);
    return await this.confluenceService.getConfluencePages(ticketKey, remoteLinks);
  }

  /**
   * Get content of a specific Confluence page
   */
  async getConfluencePageContent(pageUrl: string): Promise<ConfluencePage | null> {
    if (!this.confluenceService) {
      return null;
    }
    return this.confluenceService.getConfluencePageContent(pageUrl);
  }

  /**
   * Validate connection to Jira
   */
  async validateConnection(): Promise<boolean> {
    return this.jiraService.validateConnection();
  }
}
