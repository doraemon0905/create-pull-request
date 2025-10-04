import axios, { AxiosInstance } from 'axios';
import { BaseAtlassianService } from '../../services/atlassian/base.js';
import { getConfig } from '../../utils/config.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

// Mock axios.isAxiosError
(axios as any).isAxiosError = jest.fn();

// Create a concrete implementation for testing
class TestAtlassianService extends BaseAtlassianService {
    constructor() {
        super('jira');
    }
}

describe('BaseAtlassianService', () => {
    let service: TestAtlassianService;
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
                baseURL: 'https://company.atlassian.net/'
            }
        } as any;

        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        mockedGetConfig.mockReturnValue(mockConfig);

        service = new TestAtlassianService();
    });

    describe('constructor', () => {
        it('should initialize with configuration', () => {
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

        it('should throw error when baseUrl is missing', () => {
            mockedGetConfig.mockReturnValue({
                baseUrl: '',
                username: 'test@company.com',
                apiToken: 'test-token'
            });

            expect(() => new TestAtlassianService()).toThrow(
                'Missing jira configuration. Please run "create-pr setup" to configure your credentials.'
            );
        });

        it('should throw error when username is missing', () => {
            mockedGetConfig.mockReturnValue({
                baseUrl: 'https://company.atlassian.net/',
                username: '',
                apiToken: 'test-token'
            });

            expect(() => new TestAtlassianService()).toThrow(
                'Missing jira configuration. Please run "create-pr setup" to configure your credentials.'
            );
        });

        it('should throw error when apiToken is missing', () => {
            mockedGetConfig.mockReturnValue({
                baseUrl: 'https://company.atlassian.net/',
                username: 'test@company.com',
                apiToken: ''
            });

            expect(() => new TestAtlassianService()).toThrow(
                'Missing jira configuration. Please run "create-pr setup" to configure your credentials.'
            );
        });
    });

    describe('handleApiError', () => {
        it('should handle 404 errors', () => {
            const error = {
                isAxiosError: true,
                response: { status: 404 },
                message: 'Not found'
            };

            (axios.isAxiosError as any).mockReturnValue(true);

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Test resource not found. Please check your request.'
            );
        });

        it('should handle 401 errors', () => {
            const error = {
                isAxiosError: true,
                response: { status: 401 },
                message: 'Unauthorized'
            };

            (axios.isAxiosError as any).mockReturnValue(true);

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Authentication failed. Please check your credentials.'
            );
        });

        it('should handle 403 errors', () => {
            const error = {
                isAxiosError: true,
                response: { status: 403 },
                message: 'Forbidden'
            };

            (axios.isAxiosError as any).mockReturnValue(true);

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Access denied. Please check your permissions.'
            );
        });

        it('should handle other axios errors with error messages', () => {
            const error = {
                isAxiosError: true,
                response: {
                    status: 400,
                    data: { errorMessages: ['Field is required'] }
                },
                message: 'Bad request'
            };

            (axios.isAxiosError as any).mockReturnValue(true);

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Test resource API error: Field is required'
            );
        });

        it('should handle axios errors without error messages', () => {
            const error = {
                isAxiosError: true,
                response: { status: 500 },
                message: 'Internal server error'
            };

            (axios.isAxiosError as any).mockReturnValue(true);

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Test resource API error: Internal server error'
            );
        });

        it('should re-throw non-axios errors', () => {
            const error = new Error('Custom error');

            expect(() => (service as any).handleApiError(error, 'Test resource')).toThrow(
                'Custom error'
            );
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

            const result = await service.validateConnection();

            expect(result).toBe(true);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/myself');
        });

        it('should throw error for authentication failures', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));

            await expect(service.validateConnection()).rejects.toThrow('Unauthorized');
        });

        it('should throw error for network errors', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));

            await expect(service.validateConnection()).rejects.toThrow('Network Error');
        });
    });

    describe('removeHtmlTagsManually', () => {
        it('should remove HTML tags correctly', () => {
            const htmlContent = '<h1>Title</h1><p>This is <strong>bold</strong> text.</p>';
            const result = (service as any).removeHtmlTagsManually(htmlContent);

            expect(result).toBe(' Title  This is  bold  text. ');
        });

        it('should handle nested tags', () => {
            const htmlContent = '<div><p><span>Nested content</span></p></div>';
            const result = (service as any).removeHtmlTagsManually(htmlContent);

            expect(result).toBe('   Nested content   ');
        });

        it('should handle malformed HTML', () => {
            const htmlContent = '<p>Unclosed tag <strong>bold</p>';
            const result = (service as any).removeHtmlTagsManually(htmlContent);

            expect(result).toBe(' Unclosed tag  bold ');
        });

        it('should handle empty content', () => {
            const result = (service as any).removeHtmlTagsManually('');
            expect(result).toBe('');
        });

        it('should handle content without tags', () => {
            const htmlContent = 'Plain text content';
            const result = (service as any).removeHtmlTagsManually(htmlContent);

            expect(result).toBe('Plain text content');
        });
    });

    describe('stripHtmlAndCompress', () => {
        it('should strip HTML tags and compress whitespace', () => {
            const htmlContent = '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
            const result = (service as any).stripHtmlAndCompress(htmlContent);

            expect(result).toBe('Title This is bold and italic text.');
        });

        it('should handle HTML entities correctly', () => {
            const htmlContent = '<p>Text with &amp; ampersand, &lt; less than, &gt; greater than, &quot; quotes &nbsp; and non-breaking spaces.</p>';
            const result = (service as any).stripHtmlAndCompress(htmlContent);

            expect(result).toBe('Text with & ampersand, < less than, > greater than, " quotes and non-breaking spaces.');
        });

        it('should return empty string for empty input', () => {
            const result = (service as any).stripHtmlAndCompress('');
            expect(result).toBe('');
        });

        it('should handle null input', () => {
            const result = (service as any).stripHtmlAndCompress(null as any);
            expect(result).toBe('');
        });

        it('should handle undefined input', () => {
            const result = (service as any).stripHtmlAndCompress(undefined as any);
            expect(result).toBe('');
        });

        it('should truncate content longer than max input length', () => {
            const longContent = 'a'.repeat(150000); // Longer than 100KB limit
            const result = (service as any).stripHtmlAndCompress(longContent);

            expect(result.length).toBeLessThanOrEqual(100000);
        });

        it('should truncate content longer than max content length', () => {
            // Create content longer than MAX_CONFLUENCE_CONTENT_LENGTH (2000)
            const longSentences = Array.from({ length: 100 }, (_, i) =>
                `This is sentence number ${i + 1} that contains quite a bit of text to make it realistically long.`
            ).join(' ');

            const result = (service as any).stripHtmlAndCompress(longSentences);

            expect(result.length).toBeLessThanOrEqual(2000);
            expect(result).toMatch(/\.\.\.$/);
        });

        it('should handle multiple consecutive spaces', () => {
            const htmlContent = '<p>Text   with    multiple     spaces</p>';
            const result = (service as any).stripHtmlAndCompress(htmlContent);

            expect(result).toBe('Text with multiple spaces');
        });

        it('should handle tabs and newlines', () => {
            const htmlContent = '<p>Text\twith\nnewlines\rand\ttabs</p>';
            const result = (service as any).stripHtmlAndCompress(htmlContent);

            expect(result).toBe('Text with newlines and tabs');
        });
    });

    describe('truncateAtSentenceBoundary', () => {
        it('should truncate at sentence boundaries', () => {
            const content = 'First sentence. Second sentence. Third sentence.';
            const result = (service as any).truncateAtSentenceBoundary(content, 20);

            expect(result).toBe('First sentence....');
        });

        it('should add ellipsis when content is truncated', () => {
            const content = 'First sentence. Second sentence. Third sentence.';
            const result = (service as any).truncateAtSentenceBoundary(content, 15);

            expect(result).toBe('First sentence....');
        });

        it('should not add ellipsis when content is not truncated', () => {
            const content = 'Short sentence.';
            const result = (service as any).truncateAtSentenceBoundary(content, 50);

            expect(result).toBe('Short sentence.');
        });

        it('should handle content without sentence endings', () => {
            const content = 'This is a long sentence without proper ending';
            const result = (service as any).truncateAtSentenceBoundary(content, 20);

            expect(result).toBe('...');
        });

        it('should handle empty content', () => {
            const result = (service as any).truncateAtSentenceBoundary('', 100);
            expect(result).toBe('');
        });

        it('should handle multiple sentences', () => {
            const content = 'First. Second! Third? Fourth.';
            const result = (service as any).truncateAtSentenceBoundary(content, 15);

            expect(result).toBe('First. Second!...');
        });
    });
});
