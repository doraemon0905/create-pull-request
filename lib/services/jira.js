"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const constants_1 = require("../constants");
class JiraService {
    constructor() {
        const jiraConfig = (0, config_1.getConfig)('jira');
        if (!jiraConfig.baseUrl || !jiraConfig.username || !jiraConfig.apiToken) {
            throw new Error('Missing Jira configuration. Please run "create-pr setup" to configure your credentials.');
        }
        this.client = axios_1.default.create({
            baseURL: `${jiraConfig.baseUrl}${constants_1.API_URLS.JIRA_API_VERSION}`,
            auth: {
                username: jiraConfig.username,
                password: jiraConfig.apiToken
            },
            headers: {
                'Accept': constants_1.HEADERS.JSON_CONTENT_TYPE,
                'Content-Type': constants_1.HEADERS.JSON_CONTENT_TYPE
            }
        });
    }
    async getTicket(ticketKey) {
        try {
            const response = await this.client.get(`${constants_1.JIRA_ENDPOINTS.ISSUE}${ticketKey}`, {
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
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === constants_1.HTTP_STATUS.NOT_FOUND) {
                    throw new Error(`Jira ticket '${ticketKey}' not found. Please check the ticket key.`);
                }
                else if (error.response?.status === constants_1.HTTP_STATUS.UNAUTHORIZED) {
                    throw new Error('Authentication failed. Please check your Jira credentials.');
                }
                else if (error.response?.status === constants_1.HTTP_STATUS.FORBIDDEN) {
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
exports.JiraService = JiraService;
//# sourceMappingURL=jira.js.map