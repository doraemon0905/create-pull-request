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
        updated: '2023-01-02T00:00:00.000Z'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123', {
        params: {
          fields: 'summary,description,issuetype,status,assignee,reporter,created,updated'
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
});