import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config';
import { API_URLS, JIRA_ENDPOINTS, HEADERS, HTTP_STATUS } from '../constants';

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
}

export class JiraService {
  private client: AxiosInstance;

  constructor() {
    const jiraConfig = getConfig('jira');
    
    if (!jiraConfig.baseUrl || !jiraConfig.username || !jiraConfig.apiToken) {
      throw new Error('Missing Jira configuration. Please run "create-pr setup" to configure your credentials.');
    }

    this.client = axios.create({
      baseURL: `${jiraConfig.baseUrl}${API_URLS.JIRA_API_VERSION}`,
      auth: {
        username: jiraConfig.username,
        password: jiraConfig.apiToken
      },
      headers: {
        'Accept': HEADERS.JSON_CONTENT_TYPE,
        'Content-Type': HEADERS.JSON_CONTENT_TYPE
      }
    });
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      const response = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${ticketKey}`, {
        params: {
          fields: 'summary,description,issuetype,status,assignee,reporter,created,updated'
        }
      });

      const issue = response.data;
      const fields = issue.fields;

      return {
        key: issue.key,
        summary: fields.summary,
        description: fields.description?.content?.[0]?.content?.[0]?.text || fields.description || '',
        issueType: fields.issuetype.name,
        status: fields.status.name,
        assignee: fields.assignee?.displayName || null,
        reporter: fields.reporter.displayName,
        created: fields.created,
        updated: fields.updated
      };
    } catch (error) {
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