import axios, { AxiosInstance } from 'axios';

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
    const baseURL = process.env.JIRA_BASE_URL;
    const username = process.env.JIRA_USERNAME;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!baseURL || !username || !apiToken) {
      throw new Error('Missing Jira configuration. Please check your environment variables.');
    }

    this.client = axios.create({
      baseURL: `${baseURL}/rest/api/3`,
      auth: {
        username,
        password: apiToken
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  async getTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      const response = await this.client.get(`/issue/${ticketKey}`, {
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
        if (error.response?.status === 404) {
          throw new Error(`Jira ticket '${ticketKey}' not found. Please check the ticket key.`);
        } else if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please check your Jira credentials.');
        } else if (error.response?.status === 403) {
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