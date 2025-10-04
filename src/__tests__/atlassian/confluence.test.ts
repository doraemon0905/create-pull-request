import axios, { AxiosInstance } from 'axios';
import { ConfluenceService, ConfluencePage } from '../../services/atlassian/confluence.js';
import { getConfig } from '../../utils/config.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

// Mock axios.isAxiosError
(axios as any).isAxiosError = jest.fn();

describe('ConfluenceService', () => {
    let confluenceService: ConfluenceService;
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
                baseURL: 'https://company.atlassian.net/wiki/rest/api'
            }
        } as any;

        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        mockedGetConfig.mockReturnValue(mockConfig);

        confluenceService = new ConfluenceService();
    });

    describe('constructor', () => {
        it('should initialize with Confluence configuration', () => {
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

        it('should set correct base URL for Confluence API', () => {
            expect(mockAxiosInstance.defaults.baseURL).toBe('https://company.atlassian.net//rest/api');
        });
    });

    describe('getConfluencePages', () => {
        const mockRemoteLinks = [
            {
                id: 1,
                object: {
                    url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
                    title: 'Requirements Document'
                }
            },
            {
                id: 2,
                object: {
                    url: 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/Technical+Specifications',
                    title: 'Technical Specifications'
                }
            }
        ];

        it('should fetch and parse Confluence pages from remote links', async () => {
            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Requirements Document',
                    body: {
                        storage: {
                            value: '<p>This is the requirements document content.</p><p>It contains important information.</p>'
                        }
                    }
                }
            };

            const mockSearchResponse = {
                data: {
                    results: [
                        {
                            id: '789012',
                            title: 'Technical Specifications'
                        }
                    ]
                }
            };

            const mockTechSpecResponse = {
                data: {
                    id: '789012',
                    title: 'Technical Specifications',
                    body: {
                        storage: {
                            value: '<h1>Technical Specifications</h1><p>API endpoints and data models.</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(mockPageResponse)
                .mockResolvedValueOnce(mockSearchResponse)
                .mockResolvedValueOnce(mockTechSpecResponse);

            const result = await confluenceService.getConfluencePages('PROJ-123', mockRemoteLinks);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: '123456',
                title: 'Requirements Document',
                content: 'This is the requirements document content. It contains important information.',
                url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456'
            });
            expect(result[1]).toEqual({
                id: '789012',
                title: 'Technical Specifications',
                content: 'Technical Specifications API endpoints and data models.',
                url: 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/Technical+Specifications'
            });
        });

        it('should return empty array when no remote links provided', async () => {
            const result = await confluenceService.getConfluencePages('PROJ-123', []);

            expect(result).toEqual([]);
        });

        it('should return empty array when remote links is not an array', async () => {
            const result = await confluenceService.getConfluencePages('PROJ-123', null as any);

            expect(result).toEqual([]);
        });

        it('should filter out non-Confluence links', async () => {
            const mixedLinks = [
                {
                    id: 1,
                    object: {
                        url: 'https://github.com/repo/issues/123',
                        title: 'GitHub Issue'
                    }
                },
                {
                    id: 2,
                    object: {
                        url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
                        title: 'Confluence Page'
                    }
                }
            ];

            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Confluence Page',
                    body: {
                        storage: {
                            value: '<p>Confluence content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePages('PROJ-123', mixedLinks);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Confluence Page');
        });

        it('should limit the number of Confluence pages fetched', async () => {
            const manyLinks = Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                object: {
                    url: `https://company.atlassian.net/confluence/pages/viewpage.action?pageId=${i + 1}`,
                    title: `Page ${i + 1}`
                }
            }));

            const mockPageResponse = {
                data: {
                    id: '1',
                    title: 'Test Page',
                    body: {
                        storage: {
                            value: '<p>Content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePages('PROJ-123', manyLinks);

            // Should be limited to MAX_CONFLUENCE_PAGES_COUNT (5)
            expect(result.length).toBeLessThanOrEqual(5);
        });

        it('should handle errors when fetching individual pages gracefully', async () => {
            const linksWithError = [
                {
                    id: 1,
                    object: {
                        url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
                        title: 'Valid Page'
                    }
                },
                {
                    id: 2,
                    object: {
                        url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=invalid',
                        title: 'Invalid Page'
                    }
                }
            ];

            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Valid Page',
                    body: {
                        storage: {
                            value: '<p>Valid content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(mockPageResponse)
                .mockRejectedValueOnce(new Error('Page not found'));

            const result = await confluenceService.getConfluencePages('PROJ-123', linksWithError);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Valid Page');
        });

        it('should throw error for API errors', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

            await expect(confluenceService.getConfluencePages('PROJ-123', mockRemoteLinks)).rejects.toThrow('API Error');
        });
    });

    describe('getConfluencePageContent', () => {
        it('should extract page ID from old-style URL and fetch content', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';
            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Test Page',
                    body: {
                        storage: {
                            value: '<h1>Title</h1><p>This is test content with <strong>formatting</strong>.</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result).toEqual({
                id: '123456',
                title: 'Test Page',
                content: 'Title This is test content with formatting .',
                url: pageUrl
            });

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/123456', {
                params: { expand: 'body.storage,space' }
            });
        });

        it('should handle new-style URLs with space and page title', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/API+Documentation';

            const mockSearchResponse = {
                data: {
                    results: [
                        { id: '789012' }
                    ]
                }
            };

            const mockPageResponse = {
                data: {
                    id: '789012',
                    title: 'API Documentation',
                    body: {
                        storage: {
                            value: '<p>API documentation content here.</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(mockSearchResponse)
                .mockResolvedValueOnce(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result).toEqual({
                id: '789012',
                title: 'API Documentation',
                content: 'API documentation content here.',
                url: pageUrl
            });

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/content/search?cql=space=DEV+AND+title="API%20Documentation"');
        });

        it('should handle URLs with plus signs in title', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/API+Documentation+Guide';

            const mockSearchResponse = {
                data: {
                    results: [
                        { id: '789012' }
                    ]
                }
            };

            const mockPageResponse = {
                data: {
                    id: '789012',
                    title: 'API Documentation Guide',
                    body: {
                        storage: {
                            value: '<p>Content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(mockSearchResponse)
                .mockResolvedValueOnce(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result?.title).toBe('API Documentation Guide');
        });

        it('should handle URLs with quotes in title', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/API+"Documentation"';

            const mockSearchResponse = {
                data: {
                    results: [
                        { id: '789012' }
                    ]
                }
            };

            const mockPageResponse = {
                data: {
                    id: '789012',
                    title: 'API "Documentation"',
                    body: {
                        storage: {
                            value: '<p>Content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get
                .mockResolvedValueOnce(mockSearchResponse)
                .mockResolvedValueOnce(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result?.title).toBe('API "Documentation"');
        });

        it('should return null when page ID cannot be extracted', async () => {
            const invalidUrl = 'https://invalid-url.com/page';

            const result = await confluenceService.getConfluencePageContent(invalidUrl);

            expect(result).toBeNull();
        });

        it('should return null when search returns no results', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/spaces/DEV/pages/789012/NonExistent+Page';

            const mockSearchResponse = {
                data: {
                    results: []
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockSearchResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result).toBeNull();
        });

        it('should handle pages without body content', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';
            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Test Page',
                    body: null
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result).toEqual({
                id: '123456',
                title: 'Test Page',
                content: '',
                url: pageUrl
            });
        });

        it('should handle pages without title', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';
            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: null,
                    body: {
                        storage: {
                            value: '<p>Content</p>'
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result?.title).toBe('Untitled');
        });

        it('should throw error for API errors', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';

            mockAxiosInstance.get.mockRejectedValue(new Error('Page not found'));

            await expect(confluenceService.getConfluencePageContent(pageUrl)).rejects.toThrow('Page not found');
        });

        it('should handle long content by truncating intelligently', async () => {
            const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';

            // Create content longer than MAX_CONFLUENCE_CONTENT_LENGTH (2000)
            const longContent = 'This is a very long sentence that repeats many times. '.repeat(50); // ~2650 chars

            const mockPageResponse = {
                data: {
                    id: '123456',
                    title: 'Long Page',
                    body: {
                        storage: {
                            value: `<p>${longContent}</p>`
                        }
                    }
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockPageResponse);

            const result = await confluenceService.getConfluencePageContent(pageUrl);

            expect(result?.content.length).toBeLessThanOrEqual(2000);
            expect(result?.content).toMatch(/\.\.\.$/); // Should end with ...
        });
    });

    describe('validateConnection', () => {
        it('should validate connection successfully', async () => {
            const mockUserResponse = {
                data: {
                    accountId: 'user123',
                    displayName: 'Test User'
                }
            };

            mockAxiosInstance.get.mockResolvedValue(mockUserResponse);

            const result = await confluenceService.validateConnection();

            expect(result).toBe(true);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/current');
        });

        it('should throw error for authentication failures', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));

            await expect(confluenceService.validateConnection()).rejects.toThrow('Unauthorized');
        });

        it('should throw error for network errors', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));

            await expect(confluenceService.validateConnection()).rejects.toThrow('Network Error');
        });
    });
});
