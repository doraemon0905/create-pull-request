import axios, { AxiosInstance } from 'axios';
import { JiraService, JiraTicket } from '../services/jira';
import { getConfig } from '../utils/config';
import { validateJiraTicket } from '../utils/validation';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils/config');
jest.mock('../utils/validation');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedValidateJiraTicket = validateJiraTicket as jest.MockedFunction<typeof validateJiraTicket>;

describe('JiraService', () => {
  let jiraService: JiraService;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const mockConfig = {
    baseUrl: 'https://company.atlassian.net',
    username: 'test@company.com',
    apiToken: 'test-api-token',
    projectKey: 'PROJ'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: {}
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedGetConfig.mockReturnValue(mockConfig);
    mockedValidateJiraTicket.mockReturnValue(true);

    jiraService = new JiraService();
  });

  describe('constructor', () => {
    it('should initialize axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://company.atlassian.net/rest/api/3',
        auth: {
          username: 'test@company.com',
          password: 'test-api-token'
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    });

    it('should throw error when Jira config is missing', () => {
      mockedGetConfig.mockImplementation(() => {
        throw new Error('Config not found');
      });

      expect(() => new JiraService()).toThrow('Config not found');
    });

    it('should handle missing config fields', () => {
      mockedGetConfig.mockReturnValue({
        baseUrl: '',
        username: '',
        apiToken: ''
      });

      expect(() => new JiraService()).not.toThrow();
    });
  });

  describe('getTicket', () => {
    const mockTicketResponse = {
      data: {
        key: 'PROJ-123',
        fields: {
          summary: 'Test feature implementation',
          description: 'Implement a new test feature for the application',
          issuetype: {
            name: 'Story'
          },
          status: {
            name: 'In Progress'
          },
          assignee: {
            displayName: 'John Doe',
            emailAddress: 'john@company.com'
          },
          priority: {
            name: 'High'
          },
          created: '2023-01-01T10:00:00.000Z',
          updated: '2023-01-02T15:30:00.000Z'
        }
      }
    };

    it('should fetch and return ticket successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockTicketResponse);

      const result = await jiraService.getTicket('PROJ-123');

      expect(result).toEqual({
        key: 'PROJ-123',
        summary: 'Test feature implementation',
        description: 'Implement a new test feature for the application',
        issueType: 'Story',
        status: 'In Progress',
        assignee: 'John Doe',
        priority: 'High',
        created: '2023-01-01T10:00:00.000Z',
        updated: '2023-01-02T15:30:00.000Z'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123');
    });

    it('should handle missing optional fields', async () => {
      const minimalResponse = {
        data: {
          key: 'PROJ-123',
          fields: {
            summary: 'Test feature',
            issuetype: {
              name: 'Story'
            },
            status: {
              name: 'To Do'
            }
            // Missing description, assignee, priority, etc.
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(minimalResponse);

      const result = await jiraService.getTicket('PROJ-123');

      expect(result).toEqual({
        key: 'PROJ-123',
        summary: 'Test feature',
        description: null,
        issueType: 'Story',
        status: 'To Do',
        assignee: null,
        priority: null,
        created: undefined,
        updated: undefined
      });
    });

    it('should validate ticket key before making request', async () => {
      mockedValidateJiraTicket.mockReturnValue(false);

      await expect(jiraService.getTicket('invalid-key')).rejects.toThrow(
        'Invalid Jira ticket key format: invalid-key'
      );

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle 404 errors for non-existent tickets', async () => {
      const error = new Error('Issue not found');
      (error as any).response = {
        status: 404,
        data: { message: 'Issue does not exist or you do not have permission to see it' }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-999')).rejects.toThrow(
        'Jira ticket PROJ-999 not found or access denied'
      );
    });

    it('should handle 401 authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = {
        status: 401,
        data: { message: 'Authentication failed' }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Jira authentication failed. Please check your credentials'
      );
    });

    it('should handle 403 permission errors', async () => {
      const error = new Error('Forbidden');
      (error as any).response = {
        status: 403,
        data: { message: 'Insufficient permissions' }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Insufficient permissions to access Jira ticket PROJ-123'
      );
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Failed to fetch Jira ticket: Network Error'
      );
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        data: {
          // Missing key and fields
        }
      };

      mockAxiosInstance.get.mockResolvedValue(malformedResponse);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Invalid response format from Jira API'
      );
    });
  });

  describe('searchTickets', () => {
    const mockSearchResponse = {
      data: {
        issues: [
          {
            key: 'PROJ-123',
            fields: {
              summary: 'First ticket',
              issuetype: { name: 'Story' },
              status: { name: 'In Progress' }
            }
          },
          {
            key: 'PROJ-124',
            fields: {
              summary: 'Second ticket',
              issuetype: { name: 'Bug' },
              status: { name: 'To Do' }
            }
          }
        ],
        total: 2,
        startAt: 0,
        maxResults: 50
      }
    };

    it('should search tickets by project key', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockSearchResponse);

      const result = await jiraService.searchTickets('PROJ');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'PROJ-123',
        summary: 'First ticket',
        description: null,
        issueType: 'Story',
        status: 'In Progress',
        assignee: null,
        priority: null,
        created: undefined,
        updated: undefined
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: {
          jql: 'project = PROJ ORDER BY created DESC',
          maxResults: 50,
          startAt: 0
        }
      });
    });

    it('should search tickets with custom JQL', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockSearchResponse);

      const customJql = 'project = PROJ AND status = "In Progress"';
      await jiraService.searchTickets(undefined, customJql);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: {
          jql: customJql,
          maxResults: 50,
          startAt: 0
        }
      });
    });

    it('should handle pagination parameters', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockSearchResponse);

      await jiraService.searchTickets('PROJ', undefined, 100, 50);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: {
          jql: 'project = PROJ ORDER BY created DESC',
          maxResults: 100,
          startAt: 50
        }
      });
    });

    it('should handle empty search results', async () => {
      const emptyResponse = {
        data: {
          issues: [],
          total: 0,
          startAt: 0,
          maxResults: 50
        }
      };

      mockAxiosInstance.get.mockResolvedValue(emptyResponse);

      const result = await jiraService.searchTickets('EMPTY');

      expect(result).toHaveLength(0);
    });

    it('should throw error when neither projectKey nor jql provided', async () => {
      await expect(jiraService.searchTickets()).rejects.toThrow(
        'Either projectKey or jql must be provided'
      );

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle search API errors', async () => {
      const error = new Error('Bad Request');
      (error as any).response = {
        status: 400,
        data: { message: 'Invalid JQL query' }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.searchTickets('PROJ')).rejects.toThrow(
        'Jira search failed: Bad Request'
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

  describe('formatTicketUrl', () => {
    it('should format ticket URL correctly', () => {
      const url = jiraService.formatTicketUrl('PROJ-123');

      expect(url).toBe('https://company.atlassian.net/browse/PROJ-123');
    });

    it('should handle base URL without trailing slash', () => {
      mockedGetConfig.mockReturnValue({
        ...mockConfig,
        baseUrl: 'https://company.atlassian.net'
      });

      jiraService = new JiraService();
      const url = jiraService.formatTicketUrl('PROJ-123');

      expect(url).toBe('https://company.atlassian.net/browse/PROJ-123');
    });

    it('should handle base URL with trailing slash', () => {
      mockedGetConfig.mockReturnValue({
        ...mockConfig,
        baseUrl: 'https://company.atlassian.net/'
      });

      jiraService = new JiraService();
      const url = jiraService.formatTicketUrl('PROJ-123');

      expect(url).toBe('https://company.atlassian.net/browse/PROJ-123');
    });
  });

  describe('Error response parsing', () => {
    it('should extract error message from Jira API response', async () => {
      const error = new Error('API Error');
      (error as any).response = {
        status: 400,
        data: {
          errorMessages: ['Field "summary" is required'],
          errors: {
            summary: 'Summary is mandatory'
          }
        }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      try {
        await jiraService.getTicket('PROJ-123');
      } catch (e) {
        expect(e.message).toContain('Field "summary" is required');
      }
    });

    it('should handle errors without response data', async () => {
      const error = new Error('Network timeout');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Failed to fetch Jira ticket: Network timeout'
      );
    });
  });

  describe('Rate limiting', () => {
    it('should handle rate limit errors', async () => {
      const error = new Error('Too Many Requests');
      (error as any).response = {
        status: 429,
        headers: {
          'retry-after': '60'
        },
        data: {
          errorMessages: ['Rate limit exceeded']
        }
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow(
        'Jira API rate limit exceeded. Please try again later'
      );
    });
  });

  describe('Integration with validation', () => {
    it('should use validateJiraTicket for key validation', async () => {
      await jiraService.getTicket('PROJ-123');

      expect(mockedValidateJiraTicket).toHaveBeenCalledWith('PROJ-123');
    });

    it('should respect validation result', async () => {
      mockedValidateJiraTicket.mockReturnValue(false);

      await expect(jiraService.getTicket('invalid')).rejects.toThrow(
        'Invalid Jira ticket key format'
      );
    });
  });
});