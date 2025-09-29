import axios from 'axios';
import { getConfig } from '../utils/config.js';
import { API_URLS, JIRA_ENDPOINTS, HEADERS, HTTP_STATUS } from '../constants/index.js';
export class JiraService {
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
    async getTicket(ticketKey) {
        try {
            const response = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${ticketKey}`, {
                params: {
                    fields: 'summary,description,issuetype,status,assignee,reporter,created,updated,parent'
                }
            });
            const issue = response.data;
            const fields = issue.fields;
            // Handle parent ticket information if it exists and is not an Epic
            let parentTicket = null;
            if (fields.parent && fields.issuetype.name.toLowerCase() !== 'epic') {
                try {
                    // Fetch parent ticket details
                    const parentResponse = await this.client.get(`${JIRA_ENDPOINTS.ISSUE}${fields.parent.key}`, {
                        params: {
                            fields: 'summary,issuetype'
                        }
                    });
                    const parentFields = parentResponse.data.fields;
                    // Only include parent ticket if it has meaningful content
                    if (parentFields.summary && parentFields.summary.trim()) {
                        parentTicket = {
                            key: fields.parent.key,
                            summary: parentFields.summary.trim(),
                            issueType: parentFields.issuetype.name
                        };
                    }
                }
                catch (parentError) {
                    // If parent ticket fetch fails, log it but don't fail the main request
                    console.warn(`Warning: Could not fetch parent ticket ${fields.parent.key}:`, parentError instanceof Error ? parentError.message : 'Unknown error');
                }
            }
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
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === HTTP_STATUS.NOT_FOUND) {
                    throw new Error(`Jira ticket '${ticketKey}' not found. Please check the ticket key.`);
                }
                else if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
                    throw new Error('Authentication failed. Please check your Jira credentials.');
                }
                else if (error.response?.status === HTTP_STATUS.FORBIDDEN) {
                    throw new Error('Access denied. Please check your Jira permissions.');
                }
                throw new Error(`Jira API error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
            }
            throw error;
        }
    }
    async validateConnection() {
        try {
            await this.client.get('/myself');
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=jira.js.map