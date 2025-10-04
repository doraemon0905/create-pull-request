import axios, { AxiosInstance } from 'axios';
import { JiraService } from '../services/jira';
import { getConfig } from '../utils/config';
import { validateJiraTicket } from '../utils/validation';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils/config');
jest.mock('../utils/validation');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedValidateJiraTicket = validateJiraTicket as jest.MockedFunction<typeof validateJiraTicket>;

// Mock axios.isAxiosError
(axios as any).isAxiosError = jest.fn();

describe('JiraService', () => {
  let jiraService: JiraService;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const mockConfig = {
    baseUrl: 'https://company.atlassian.net/',
    username: 'test@company.com',
    apiToken: 'test-token',
    projectKey: 'PROJ'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.isAxiosError as any).mockReturnValue(false);

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedGetConfig.mockReturnValue(mockConfig);
    mockedValidateJiraTicket.mockReturnValue(true);

    jiraService = new JiraService();
  });

  describe('constructor', () => {
    it('should initialize with Jira configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://company.atlassian.net//rest/api/3',
        auth: {
          username: 'test@company.com',
          password: 'test-token'
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should throw error when configuration is missing', () => {
      mockedGetConfig.mockReturnValue({
        baseUrl: '',
        username: '',
        apiToken: ''
      });

      expect(() => new JiraService()).toThrow(
        'Missing Jira configuration. Please run "create-pr setup" to configure your credentials.'
      );
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

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // getTicket, parent ticket (no confluence by default)
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
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // getTicket only (Epic doesn't fetch parent, no confluence by default)
    });

    it('should handle missing parent ticket gracefully', async () => {
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

      const parentError = {
        isAxiosError: true,
        response: { status: 404 },
        message: 'Parent not found'
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce(responseWithParent)
        .mockRejectedValueOnce(parentError);

      const result = await jiraService.getTicket('PROJ-123');

      expect(result.parentTicket).toBeNull();
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

    it('should handle API errors with specific error messages', async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { errorMessages: ['Issue does not exist'] }
        },
        message: 'Request failed'
      };

      (axios.isAxiosError as any).mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        "Jira ticket 'PROJ-123' not found. Please check the ticket key."
      );
    });

    it('should handle network errors', async () => {
      const error = new Error('Network timeout');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Network timeout'
      );
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      const mockUserResponse = {
        data: {
          accountId: 'user123',
          displayName: 'Test User',
          emailAddress: 'test@company.com'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockUserResponse);

      const result = await jiraService.validateConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/myself');
    });

    it('should return false for authentication failures', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = { status: 401 };

      mockAxiosInstance.get.mockRejectedValue(error);

      const result = await jiraService.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));

      const result = await jiraService.validateConnection();

      expect(result).toBe(false);
    });
  });

  describe('Error response parsing', () => {
    it('should extract error message from Jira API response', async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            errorMessages: ['Field "summary" is required'],
            errors: {
              summary: 'Summary is mandatory'
            }
          }
        },
        message: 'Request failed'
      };

      (axios.isAxiosError as any).mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValue(error);

      try {
        await jiraService.getTicket('PROJ-123');
      } catch (e) {
        expect((e as Error).message).toContain('Field "summary" is required');
      }
    });

    it('should handle errors without response data', async () => {
      const error = new Error('Network timeout');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Network timeout'
      );
    });
  });

  describe('Confluence Integration', () => {
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

      it('should return false when Confluence client not initialized', async () => {
        const serviceWithoutConfluence = new JiraService();
        (serviceWithoutConfluence as any).confluenceClient = null;

        const result = await serviceWithoutConfluence.hasConfluencePages('PROJ-123');

        expect(result).toBe(false);
      });

      it('should throw error when API call fails', async () => {
        mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

        await expect(jiraService.hasConfluencePages('PROJ-123')).rejects.toThrow('API Error');
      });

      it('should return false when response is not an array', async () => {
        const mockRemoteLinksResponse = {
          data: null
        };

        mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

        const result = await jiraService.hasConfluencePages('PROJ-123');

        expect(result).toBe(false);
      });
    });

    describe('getConfluencePages', () => {
      it('should fetch and parse Confluence pages linked to Jira ticket', async () => {
        const mockRemoteLinksResponse = {
          data: [
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
          ]
        };

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

        // Mock Jira remote links call
        mockAxiosInstance.get.mockResolvedValueOnce(mockRemoteLinksResponse);

        // Mock Confluence client
        const mockConfluenceInstance = {
          get: jest.fn()
        };

        // Setup Confluence client responses
        mockConfluenceInstance.get
          .mockResolvedValueOnce(mockPageResponse) // First page content
          .mockResolvedValueOnce(mockSearchResponse) // Search for second page
          .mockResolvedValueOnce(mockTechSpecResponse); // Second page content

        // Replace axios.create to return our confluence mock on second call
        mockedAxios.create
          .mockReturnValueOnce(mockAxiosInstance) // JIRA client
          .mockReturnValueOnce(mockConfluenceInstance as any); // Confluence client

        // Create new instance to trigger re-initialization
        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePages('PROJ-123');

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

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123/remotelink');
      });

      it('should return empty array when no Confluence links found', async () => {
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

        const result = await jiraService.getConfluencePages('PROJ-123');

        expect(result).toEqual([]);
      });

      it('should handle Confluence client not initialized', async () => {
        // Mock console.warn to verify warning message
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Create service without Confluence client initialization
        mockedGetConfig.mockReturnValue({
          baseUrl: '',
          username: '',
          apiToken: ''
        });

        let _serviceWithoutConfluence: JiraService;
        try {
          _serviceWithoutConfluence = new JiraService();
        } catch {
          // Expected to throw, create a mock service for testing
          _serviceWithoutConfluence = {
            getConfluencePages: async () => []
          } as any;
        }

        // Reset config for proper service creation
        mockedGetConfig.mockReturnValue(mockConfig);
        const serviceWithValidConfig = new JiraService();

        // Manually set confluenceClient to null to simulate initialization failure
        (serviceWithValidConfig as any).confluenceClient = null;

        const result = await serviceWithValidConfig.getConfluencePages('PROJ-123');

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith('Confluence client not initialized, skipping Confluence pages fetch');

        consoleSpy.mockRestore();
      });

      it('should handle API errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

        const result = await jiraService.getConfluencePages('PROJ-123');

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Warning: Could not fetch Confluence pages for ticket PROJ-123:'),
          'API Error'
        );

        consoleSpy.mockRestore();
      });

      it('should limit the number of Confluence pages fetched', async () => {
        const mockRemoteLinksResponse = {
          data: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            object: {
              url: `https://company.atlassian.net/confluence/pages/viewpage.action?pageId=${i + 1}`,
              title: `Page ${i + 1}`
            }
          }))
        };

        mockAxiosInstance.get.mockResolvedValue(mockRemoteLinksResponse);

        // Mock Confluence client
        const mockConfluenceInstance = {
          get: jest.fn().mockResolvedValue({
            data: {
              id: '1',
              title: 'Test Page',
              body: { storage: { value: '<p>Content</p>' } }
            }
          })
        };

        mockedAxios.create
          .mockReturnValueOnce(mockAxiosInstance)
          .mockReturnValueOnce(mockConfluenceInstance as any);

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePages('PROJ-123');

        // Should be limited to MAX_CONFLUENCE_PAGES_COUNT (5)
        expect(result.length).toBeLessThanOrEqual(5);
      });
    });

    describe('getConfluencePageContent', () => {
      let mockConfluenceInstance: any;

      beforeEach(() => {
        mockConfluenceInstance = {
          get: jest.fn()
        };

        // Setup axios.create to return confluence client on second call
        mockedAxios.create
          .mockReturnValueOnce(mockAxiosInstance)
          .mockReturnValueOnce(mockConfluenceInstance);
      });

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

        mockConfluenceInstance.get.mockResolvedValue(mockPageResponse);

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePageContent(pageUrl);

        expect(result).toEqual({
          id: '123456',
          title: 'Test Page',
          content: 'Title This is test content with formatting .',
          url: pageUrl
        });

        expect(mockConfluenceInstance.get).toHaveBeenCalledWith('/content/123456', {
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

        mockConfluenceInstance.get
          .mockResolvedValueOnce(mockSearchResponse)
          .mockResolvedValueOnce(mockPageResponse);

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePageContent(pageUrl);

        expect(result).toEqual({
          id: '789012',
          title: 'API Documentation',
          content: 'API documentation content here.',
          url: pageUrl
        });

        expect(mockConfluenceInstance.get).toHaveBeenCalledWith('/content/search?cql=space=DEV+AND+title="API%20Documentation"');
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

        mockConfluenceInstance.get.mockResolvedValue(mockPageResponse);

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePageContent(pageUrl);

        expect(result?.content.length).toBeLessThanOrEqual(2000);
        expect(result?.content).toMatch(/\.\.\.$/); // Should end with ...
      });

      it('should return null when Confluence client not available', async () => {
        const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';

        // Create service without Confluence client
        const serviceWithoutConfluence = new JiraService();
        (serviceWithoutConfluence as any).confluenceClient = null;

        const result = await serviceWithoutConfluence.getConfluencePageContent(pageUrl);

        expect(result).toBeNull();
      });

      it('should handle invalid URLs gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const invalidUrl = 'https://invalid-url.com/page';

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePageContent(invalidUrl);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(`Could not extract page ID from URL: ${invalidUrl}`);

        consoleSpy.mockRestore();
      });

      it('should handle API errors when fetching page content', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const pageUrl = 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456';

        mockConfluenceInstance.get.mockRejectedValue(new Error('Page not found'));

        const newJiraService = new JiraService();
        const result = await newJiraService.getConfluencePageContent(pageUrl);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Warning: Could not fetch Confluence page content from ${pageUrl}:`),
          'Page not found'
        );

        consoleSpy.mockRestore();
      });
    });

    describe('stripHtmlAndCompress', () => {
      it('should strip HTML tags and compress whitespace', async () => {
        const htmlContent = '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> text.</p><div>More content</div>';

        // Access the private method through a test
        const newJiraService = new JiraService();
        const result = (newJiraService as any).stripHtmlAndCompress(htmlContent);

        expect(result).toBe('Title This is bold and italic text. More content');
      });

      it('should handle HTML entities correctly', async () => {
        const htmlContent = '<p>Text with &amp; ampersand, &lt; less than, &gt; greater than, &quot; quotes &nbsp; and non-breaking spaces.</p>';

        const newJiraService = new JiraService();
        const result = (newJiraService as any).stripHtmlAndCompress(htmlContent);

        expect(result).toBe('Text with & ampersand, < less than, > greater than, " quotes and non-breaking spaces.');
      });

      it('should return empty string for empty input', async () => {
        const newJiraService = new JiraService();
        const result = (newJiraService as any).stripHtmlAndCompress('');

        expect(result).toBe('');
      });

      it('should truncate long content at sentence boundaries', async () => {
        // Create content longer than MAX_CONFLUENCE_CONTENT_LENGTH (2000)
        const longSentences = Array.from({ length: 100 }, (_, i) => `This is a very long sentence number ${i + 1} that contains quite a bit of text to make it realistically long.`).join(' ');

        const newJiraService = new JiraService();
        const result = (newJiraService as any).stripHtmlAndCompress(longSentences);

        expect(result.length).toBeLessThanOrEqual(2000);
        expect(result).toMatch(/\.\.\.$/);
      });
    });

    describe('getTicket with Confluence integration', () => {
      it('should not include Confluence pages by default', async () => {
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

        mockAxiosInstance.get.mockResolvedValue(mockTicketResponse);

        const result = await jiraService.getTicket('PROJ-123');

        expect(result.confluencePages).toBeUndefined();
        // Should only call getTicket, not remote links
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      });

      it('should include Confluence pages when explicitly requested', async () => {
        const mockTicketResponse = {
          data: {
            key: 'PROJ-123',
            fields: {
              summary: 'Test ticket with Confluence pages',
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

        const mockRemoteLinksResponse = {
          data: [
            {
              id: 1,
              object: {
                url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
                title: 'Requirements'
              }
            }
          ]
        };

        const mockPageResponse = {
          data: {
            id: '123456',
            title: 'Requirements',
            body: {
              storage: {
                value: '<p>Requirements content</p>'
              }
            }
          }
        };

        const mockConfluenceInstance = {
          get: jest.fn().mockResolvedValue(mockPageResponse)
        };

        // Setup mocks for both JIRA and Confluence clients
        mockAxiosInstance.get
          .mockResolvedValueOnce(mockTicketResponse) // getTicket call
          .mockResolvedValueOnce(mockRemoteLinksResponse); // getConfluencePages call

        mockedAxios.create
          .mockReturnValueOnce(mockAxiosInstance)
          .mockReturnValueOnce(mockConfluenceInstance as any);

        const newJiraService = new JiraService();
        const result = await newJiraService.getTicket('PROJ-123', true);

        expect(result.confluencePages).toBeDefined();
        expect(result.confluencePages).toHaveLength(1);
        expect(result.confluencePages![0]).toEqual({
          id: '123456',
          title: 'Requirements',
          content: 'Requirements content',
          url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456'
        });
      });

      it('should not include confluencePages field when no pages found', async () => {
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

        const mockRemoteLinksResponse = { data: [] };

        mockAxiosInstance.get
          .mockResolvedValueOnce(mockTicketResponse)
          .mockResolvedValueOnce(mockRemoteLinksResponse);

        const result = await jiraService.getTicket('PROJ-123');

        expect(result.confluencePages).toBeUndefined();
      });

      it('should handle Confluence fetch errors gracefully when explicitly requested', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

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

        mockAxiosInstance.get
          .mockResolvedValueOnce(mockTicketResponse)
          .mockRejectedValueOnce(new Error('Confluence API error'));

        const result = await jiraService.getTicket('PROJ-123', true);

        expect(result.confluencePages).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Warning: Could not fetch Confluence pages for ticket PROJ-123:'),
          'Confluence API error'
        );

        consoleSpy.mockRestore();
      });
    });
  });
});
