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
export interface CreateJiraTicketRequest {
    summary: string;
    description: string;
    projectKey: string;
    issueType?: string;
}
export declare class JiraService {
    private client;
    constructor();
    getTicket(ticketKey: string): Promise<JiraTicket>;
    validateConnection(): Promise<boolean>;
    createTicket(request: CreateJiraTicketRequest): Promise<{
        key: string;
        url: string;
    }>;
}
//# sourceMappingURL=jira.d.ts.map