import { JiraService } from '../services/atlassian-facade';
import { JiraService as AtlassianJiraService } from '../services/atlassian/jira';
import { ConfluenceService } from '../services/atlassian/confluence';
import { getConfig } from '../utils/config';
import { validateJiraTicket } from '../utils/validation';

// Mock dependencies
jest.mock('../utils/config');
jest.mock('../utils/validation');
jest.mock('../services/atlassian/jira');
jest.mock('../services/atlassian/confluence');

const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockedValidateJiraTicket = validateJiraTicket as jest.MockedFunction<typeof validateJiraTicket>;
const mockedAtlassianJiraService = AtlassianJiraService as jest.MockedClass<typeof AtlassianJiraService>;
const mockedConfluenceService = ConfluenceService as jest.MockedClass<typeof ConfluenceService>;

describe('JiraService', () => {
  let jiraService: JiraService;
  let mockAtlassianJiraService: jest.Mocked<AtlassianJiraService>;
  let mockConfluenceService: jest.Mocked<ConfluenceService>;

  const mockConfig = {
    baseUrl: 'https://company.atlassian.net/',
    username: 'test@company.com',
    apiToken: 'test-token',
    projectKey: 'PROJ'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockAtlassianJiraService = {
      getTicket: jest.fn(),
      hasConfluencePages: jest.fn(),
      getRemoteLinks: jest.fn(),
      validateConnection: jest.fn()
    } as any;

    mockConfluenceService = {
      getConfluencePages: jest.fn(),
      getConfluencePageContent: jest.fn(),
      validateConnection: jest.fn()
    } as any;

    // Mock the constructors
    mockedAtlassianJiraService.mockImplementation(() => mockAtlassianJiraService);
    mockedConfluenceService.mockImplementation(() => mockConfluenceService);
    mockedGetConfig.mockReturnValue(mockConfig);
    mockedValidateJiraTicket.mockReturnValue(true);

    jiraService = new JiraService();
  });

  describe('constructor', () => {
    it('should initialize AtlassianJiraService', () => {
      expect(mockedAtlassianJiraService).toHaveBeenCalled();
    });

    it('should initialize ConfluenceService', () => {
      expect(mockedConfluenceService).toHaveBeenCalled();
    });

    it('should handle ConfluenceService initialization failure', () => {
      mockedConfluenceService.mockImplementation(() => {
        throw new Error('Confluence initialization failed');
      });

      expect(() => new JiraService()).toThrow('Confluence initialization failed');
    });
  });

  describe('getTicket', () => {
    const mockJiraTicket = {
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
    };

    const mockConfluencePages = [
      {
        id: '123456',
        title: 'Requirements Document',
        content: 'Requirements content',
        url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456'
      }
    ];

    it('should fetch ticket data without Confluence pages by default', async () => {
      mockAtlassianJiraService.getTicket.mockResolvedValue(mockJiraTicket);

      const result = await jiraService.getTicket('PROJ-123');

      expect(result).toEqual(mockJiraTicket);
      expect(mockAtlassianJiraService.getTicket).toHaveBeenCalledWith('PROJ-123');
      expect(mockConfluenceService.getConfluencePages).not.toHaveBeenCalled();
    });

    it('should fetch ticket data with Confluence pages when requested', async () => {
      const mockRemoteLinks = [
        {
          id: 1,
          object: {
            url: 'https://company.atlassian.net/confluence/pages/viewpage.action?pageId=123456',
            title: 'Requirements Document'
          }
        }
      ];

      mockAtlassianJiraService.getTicket.mockResolvedValue(mockJiraTicket);
      mockAtlassianJiraService.getRemoteLinks.mockResolvedValue(mockRemoteLinks);
      mockConfluenceService.getConfluencePages.mockResolvedValue(mockConfluencePages);

      const result = await jiraService.getTicket('PROJ-123', true);

      expect(result).toEqual({
        ...mockJiraTicket,
        confluencePages: mockConfluencePages
      });
      expect(mockAtlassianJiraService.getTicket).toHaveBeenCalledWith('PROJ-123');
      expect(mockAtlassianJiraService.getRemoteLinks).toHaveBeenCalledWith('PROJ-123');
      expect(mockConfluenceService.getConfluencePages).toHaveBeenCalledWith('PROJ-123', mockRemoteLinks);
    });

    it('should not include confluencePages field when no pages found', async () => {
      mockAtlassianJiraService.getTicket.mockResolvedValue(mockJiraTicket);
      mockAtlassianJiraService.getRemoteLinks.mockResolvedValue([]);
      mockConfluenceService.getConfluencePages.mockResolvedValue([]);

      const result = await jiraService.getTicket('PROJ-123', true);

      expect(result).toEqual(mockJiraTicket);
      expect(result.confluencePages).toBeUndefined();
    });

    it('should throw error when Confluence fetch fails', async () => {
      mockAtlassianJiraService.getTicket.mockResolvedValue(mockJiraTicket);
      mockAtlassianJiraService.getRemoteLinks.mockRejectedValue(new Error('Confluence API error'));

      await expect(jiraService.getTicket('PROJ-123', true)).rejects.toThrow('Confluence API error');
    });

    it('should throw error when ConfluenceService fails', async () => {
      mockAtlassianJiraService.getRemoteLinks.mockResolvedValue([]);
      mockConfluenceService.getConfluencePages.mockRejectedValue(new Error('Confluence service error'));

      await expect(jiraService.getConfluencePages('PROJ-123')).rejects.toThrow('Confluence service error');
    });

    it('should re-throw errors from AtlassianJiraService', async () => {
      const error = new Error('Jira API error');
      mockAtlassianJiraService.getTicket.mockRejectedValue(error);

      await expect(jiraService.getTicket('PROJ-123')).rejects.toThrow('Jira API error');
    });
  });

  describe('hasConfluencePages', () => {
    it('should delegate to AtlassianJiraService', async () => {
      mockAtlassianJiraService.hasConfluencePages.mockResolvedValue(true);

      const result = await jiraService.hasConfluencePages('PROJ-123');

      expect(result).toBe(true);
      expect(mockAtlassianJiraService.hasConfluencePages).toHaveBeenCalledWith('PROJ-123');
    });
  });

  describe('getConfluencePages', () => {
    it('should delegate to ConfluenceService when available', async () => {
      const mockRemoteLinks = [{ id: 1, object: { url: 'test' } }];
      const mockPages = [{ id: '1', title: 'Test', content: 'Content', url: 'test' }];

      mockAtlassianJiraService.getRemoteLinks.mockResolvedValue(mockRemoteLinks);
      mockConfluenceService.getConfluencePages.mockResolvedValue(mockPages);

      const result = await jiraService.getConfluencePages('PROJ-123');

      expect(result).toEqual(mockPages);
      expect(mockAtlassianJiraService.getRemoteLinks).toHaveBeenCalledWith('PROJ-123');
      expect(mockConfluenceService.getConfluencePages).toHaveBeenCalledWith('PROJ-123', mockRemoteLinks);
    });

    it('should return empty array when ConfluenceService not initialized', async () => {
      // Create service without Confluence service
      const serviceWithoutConfluence = new JiraService();
      (serviceWithoutConfluence as any).confluenceService = null;

      const result = await serviceWithoutConfluence.getConfluencePages('PROJ-123');

      expect(result).toEqual([]);
    });
  });

  describe('getConfluencePageContent', () => {
    it('should delegate to ConfluenceService when available', async () => {
      const mockPage = { id: '1', title: 'Test', content: 'Content', url: 'test' };
      mockConfluenceService.getConfluencePageContent.mockResolvedValue(mockPage);

      const result = await jiraService.getConfluencePageContent('test-url');

      expect(result).toEqual(mockPage);
      expect(mockConfluenceService.getConfluencePageContent).toHaveBeenCalledWith('test-url');
    });

    it('should return null when ConfluenceService not initialized', async () => {
      // Create service without Confluence service
      const serviceWithoutConfluence = new JiraService();
      (serviceWithoutConfluence as any).confluenceService = null;

      const result = await serviceWithoutConfluence.getConfluencePageContent('test-url');

      expect(result).toBeNull();
    });
  });

  describe('validateConnection', () => {
    it('should delegate to AtlassianJiraService', async () => {
      mockAtlassianJiraService.validateConnection.mockResolvedValue(true);

      const result = await jiraService.validateConnection();

      expect(result).toBe(true);
      expect(mockAtlassianJiraService.validateConnection).toHaveBeenCalled();
    });
  });
});
