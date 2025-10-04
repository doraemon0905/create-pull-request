import axios, { AxiosInstance } from 'axios';
import { JiraService, JiraTicket } from '../../services/atlassian/jira.js';
import { getConfig } from '../../utils/config.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

// Mock axios.isAxiosError
(axios as any).isAxiosError = jest.fn();

describe('JiraService', () => {
    let jiraService: JiraService;
    let mockAxiosInstance: jest.Mocked<AxiosInstance>;

    const mockConfig = {
        baseUrl: 'https://company.atlassian.net/',
        username: 'test@company.com',
        apiToken: 'test-token'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (axios.isAxiosError as any).mockReturnValue(false);

        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            defaults: {
                baseURL: 'https://company.atlassian.net/rest/api/3'
            }
        } as any;

        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        mockedGetConfig.mockReturnValue(mockConfig);

        jiraService = new JiraService();
    });

    describe('constructor', () => {
        it('should initialize with Jira configuration', () => {
            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://company.atlassian.net/',
                auth: {
                    username: 'test@company.com',
                    password: 'test-token'
                },
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 3000000
            });
        });

        it('should set correct base URL for Jira API', () => {
            expect(mockAxiosInstance.defaults.baseURL).toBe('https://company.atlassian.net//rest/api/3');
        });
    });

    describe('getTicket', () => {
        const mockTicketResponse = {
            data: {
                key: 'PROJ-123',
                fields: {
                    summary: 'Test ticket',
                    description: 'Test description',
                    issuetype: { name: 'Story' },
                    status: { name: 'In Progress' },
                    assignee: { displayName: 'John Doe' },
                    reporter: { displayName: 'Jane Doe' },
                    created: '2023-01-01T00:00:00.000Z',
                    updated: '2023-01-02T00:00:00.000Z'
                }
            }
        };

        it('should fetch and transform ticket data correctly', async () => {
            mockAxiosInstance.get.mockResolvedValue(mockTicketResponse);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result).toEqual({
                key: 'PROJ-123',
                summary: 'Test ticket',
                description: 'Test description',
                issueType: 'Story',
                status: 'In Progress',
                assignee: 'John Doe',
                reporter: 'Jane Doe',
                created: '2023-01-01T00:00:00.000Z',
                updated: '2023-01-02T00:00:00.000Z',
                parentTicket: null
            });

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123', {
                params: {
                    fields: 'summary,description,issuetype,status,assignee,reporter,created,updated,parent'
                }
            });
        });

        it('should handle tickets with null assignee', async () => {
            const responseWithNullAssignee = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        assignee: null
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(responseWithNullAssignee);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.assignee).toBeNull();
        });

        it('should handle tickets with rich text description', async () => {
            const responseWithRichText = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        description: {
                            content: [
                                {
                                    content: [
                                        {
                                            text: 'Rich text description'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(responseWithRichText);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.description).toBe('Rich text description');
        });

        it('should fetch parent ticket information when available', async () => {
            const responseWithParent = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        issuetype: { name: 'Sub-task' },
                        parent: { key: 'PROJ-100' }
                    }
                }
            };

            const parentTicketResponse = {
                data: {
                    fields: {
                        summary: 'Parent ticket summary',
                        issuetype: { name: 'Story' }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(responseWithParent)
                .mockResolvedValueOnce(parentTicketResponse);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.parentTicket).toEqual({
                key: 'PROJ-100',
                summary: 'Parent ticket summary',
                issueType: 'Story'
            });

            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
            expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/issue/PROJ-100', {
                params: {
                    fields: 'summary,issuetype'
                }
            });
        });

        it('should not fetch parent for Epic tickets', async () => {
            const epicResponse = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        issuetype: { name: 'Epic' },
                        parent: { key: 'PROJ-100' }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(epicResponse);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.parentTicket).toBeNull();
            expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
        });

        it('should throw error when parent ticket fetch fails', async () => {
            const responseWithParent = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        issuetype: { name: 'Sub-task' },
                        parent: { key: 'PROJ-100' }
                    }
                }
            };

            const parentError = new Error('Parent not found');

            mockAxiosInstance.get
                .mockResolvedValueOnce(responseWithParent)
                .mockRejectedValueOnce(parentError);

            await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow('Parent not found');
        });

        it('should handle description fallback when content structure is missing', async () => {
            const responseWithSimpleDescription = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        description: 'Simple text description'
                        // Missing content array structure
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(responseWithSimpleDescription);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.description).toBe('Simple text description');
        });

        it('should handle empty description fallback', async () => {
            const responseWithEmptyDescription = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        description: null
                        // No description at all
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(responseWithEmptyDescription);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.description).toBe('');
        });

        it('should handle empty parent ticket summary', async () => {
            const responseWithParent = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        issuetype: { name: 'Sub-task' },
                        parent: { key: 'PROJ-100' }
                    }
                }
            };

            const parentTicketResponse = {
                data: {
                    fields: {
                        summary: '',
                        issuetype: { name: 'Story' }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(responseWithParent)
                .mockResolvedValueOnce(parentTicketResponse);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.parentTicket).toBeNull();
        });

        it('should handle whitespace-only parent ticket summary', async () => {
            const responseWithParent = {
                ...mockTicketResponse,
                data: {
                    ...mockTicketResponse.data,
                    fields: {
                        ...mockTicketResponse.data.fields,
                        issuetype: { name: 'Sub-task' },
                        parent: { key: 'PROJ-100' }
                    }
                }
            };

            const parentTicketResponse = {
                data: {
                    fields: {
                        summary: '   ',
                        issuetype: { name: 'Story' }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(responseWithParent)
                .mockResolvedValueOnce(parentTicketResponse);

            const result = await jiraService.getTicket('PROJ-123');

            expect(result.parentTicket).toBeNull();
        });

        it('should handle API errors', async () => {
            const error = new Error('API Error');
            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow('API Error');
        });
    });

    describe('hasConfluencePages', () => {
        it('should return true when Confluence pages are linked', async () => {
            const mockRemoteLinksResponse = {
                data: [
                    {
                        id: 1,
                        object: {
                            url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
                            title: 'Requirements Document'
                        }
                    }
                ]
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.hasConfluencePages('PROJ-123');

            expect(result).toBe(true);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123/remotelink');
        });

        it('should return false when no Confluence pages are linked', async () => {
            const mockRemoteLinksResponse = {
                data: [
                    {
                        id: 1,
                        object: {
                            url: 'https://github.com/repo/issues/123',
                            title: 'GitHub Issue'
                        }
                    }
                ]
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.hasConfluencePages('PROJ-123');

            expect(result).toBe(false);
        });

        it('should return false when response is not an array', async () => {
            const mockRemoteLinksResponse = {
                data: null
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.hasConfluencePages('PROJ-123');

            expect(result).toBe(false);
        });

        it('should throw error for API errors', async () => {
            const error = new Error('API Error');
            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(jiraService.hasConfluencePages('PROJ-123')).rejects.toThrow('API Error');
        });

        it('should detect wiki URLs as Confluence pages', async () => {
            const mockRemoteLinksResponse = {
                data: [
                    {
                        id: 1,
                        object: {
                            url: 'https://company.atlassian.net/wiki/spaces/DEV/pages/123456/Test+Page',
                            title: 'Wiki Page'
                        }
                    }
                ]
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.hasConfluencePages('PROJ-123');

            expect(result).toBe(true);
        });
    });

    describe('getRemoteLinks', () => {
        it('should return remote links array', async () => {
            const mockRemoteLinksResponse = {
                data: [
                    {
                        id: 1,
                        object: {
                            url: 'https://github.com/repo/issues/123',
                            title: 'GitHub Issue'
                        }
                    }
                ]
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.getRemoteLinks('PROJ-123');

            expect(result).toEqual(mockRemoteLinksResponse.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123/remotelink');
        });

        it('should return empty array when response is not an array', async () => {
            const mockRemoteLinksResponse = {
                data: null
            };

            mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

            const result = await jiraService.getRemoteLinks('PROJ-123');

            expect(result).toEqual([]);
        });

        it('should throw error for API errors', async () => {
            const error = new Error('API Error');
            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(jiraService.getRemoteLinks('PROJ-123')).rejects.toThrow('API Error');
        });
    });

    describe('validateConnection', () => {
        it('should delegate to parent validateConnection', async () => {
            const mockValidateConnection = jest.fn().mockResolvedValue(true);
            (jiraService as any).validateConnection = mockValidateConnection;

            const result = await jiraService.validateConnection();

            expect(result).toBe(true);
        });
    });
});
