import { 
  handleErrorWithPrefix, 
  formatErrorMessage, 
  isAxiosError, 
  extractErrorDetails,
  createError
} from '../utils/error-handler';

// Mock console to test logging
const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

describe('Error Handler Utils', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('createError', () => {
    it('should create error with message and code', () => {
      const error = createError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create error with additional details', () => {
      const details = { field: 'username', value: 'invalid' };
      const error = createError('Validation failed', 'VALIDATION_ERROR', details);

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should create error without code', () => {
      const error = createError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBeUndefined();
    });
  });

  describe('isAxiosError', () => {
    it('should identify axios errors', () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' }
        },
        config: {},
        message: 'Request failed'
      };

      expect(isAxiosError(axiosError)).toBe(true);
    });

    it('should reject non-axios errors', () => {
      const regularError = new Error('Regular error');

      expect(isAxiosError(regularError)).toBe(false);
      expect(isAxiosError(null)).toBe(false);
      expect(isAxiosError(undefined)).toBe(false);
      expect(isAxiosError({})).toBe(false);
      expect(isAxiosError({ message: 'Not axios' })).toBe(false);
    });

    it('should handle axios error without response', () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Network error',
        config: {}
      };

      expect(isAxiosError(axiosError)).toBe(true);
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract details from axios error with response', () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 422,
          statusText: 'Unprocessable Entity',
          data: {
            message: 'Validation failed',
            errors: ['Field is required']
          }
        },
        config: { url: '/api/test' },
        message: 'Request failed'
      };

      const details = extractErrorDetails(axiosError);

      expect(details).toEqual({
        type: 'HTTP_ERROR',
        statusCode: 422,
        statusText: 'Unprocessable Entity',
        url: '/api/test',
        responseData: {
          message: 'Validation failed',
          errors: ['Field is required']
        }
      });
    });

    it('should extract details from axios error without response', () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Network Error',
        config: { url: '/api/test' },
        code: 'ECONNREFUSED'
      };

      const details = extractErrorDetails(axiosError);

      expect(details).toEqual({
        type: 'NETWORK_ERROR',
        code: 'ECONNREFUSED',
        url: '/api/test',
        message: 'Network Error'
      });
    });

    it('should extract details from regular error', () => {
      const regularError = new Error('Something went wrong');

      const details = extractErrorDetails(regularError);

      expect(details).toEqual({
        type: 'GENERIC_ERROR',
        message: 'Something went wrong'
      });
    });

    it('should handle custom error with code', () => {
      const customError = createError('Custom error', 'CUSTOM_CODE');

      const details = extractErrorDetails(customError);

      expect(details).toEqual({
        type: 'GENERIC_ERROR',
        message: 'Custom error',
        code: 'CUSTOM_CODE'
      });
    });

    it('should handle non-error objects', () => {
      const details = extractErrorDetails('String error');

      expect(details).toEqual({
        type: 'UNKNOWN_ERROR',
        message: 'String error'
      });
    });

    it('should handle null/undefined errors', () => {
      expect(extractErrorDetails(null)).toEqual({
        type: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred'
      });

      expect(extractErrorDetails(undefined)).toEqual({
        type: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred'
      });
    });
  });

  describe('formatErrorMessage', () => {
    it('should format axios error with response', () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Resource not found' }
        },
        config: { url: '/api/users/123' },
        message: 'Request failed'
      };

      const formatted = formatErrorMessage(axiosError);

      expect(formatted).toContain('HTTP Error (404)');
      expect(formatted).toContain('Resource not found');
      expect(formatted).toContain('/api/users/123');
    });

    it('should format axios network error', () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Network Error',
        code: 'ECONNREFUSED'
      };

      const formatted = formatErrorMessage(axiosError);

      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('ECONNREFUSED');
    });

    it('should format regular error', () => {
      const error = new Error('File not found');

      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('File not found');
    });

    it('should format custom error with code', () => {
      const error = createError('Validation failed', 'VALIDATION_ERROR');

      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('VALIDATION_ERROR');
    });

    it('should handle string errors', () => {
      const formatted = formatErrorMessage('String error message');

      expect(formatted).toBe('String error message');
    });

    it('should handle empty/null errors', () => {
      expect(formatErrorMessage(null)).toBe('Unknown error occurred');
      expect(formatErrorMessage(undefined)).toBe('Unknown error occurred');
      expect(formatErrorMessage('')).toBe('Unknown error occurred');
    });
  });

  describe('handleErrorWithPrefix', () => {
    it('should log and throw formatted error', () => {
      const error = new Error('Test error');

      expect(() => handleErrorWithPrefix(error)).toThrow('Test error');
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Test error');
    });

    it('should log and throw with custom prefix', () => {
      const error = new Error('API error');

      expect(() => handleErrorWithPrefix(error, 'API Request')).toThrow('API error');
      expect(consoleSpy).toHaveBeenCalledWith('API Request Error:', 'API error');
    });

    it('should handle axios errors', () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        },
        config: { url: '/api/test' },
        message: 'Request failed'
      };

      expect(() => handleErrorWithPrefix(axiosError)).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error:',
        expect.stringContaining('HTTP Error (500)')
      );
    });

    it('should preserve original error for instanceof checks', () => {
      const originalError = new Error('Original error');

      try {
        handleErrorWithPrefix(originalError);
      } catch (thrownError) {
        expect(thrownError).toBe(originalError);
      }
    });

    it('should handle non-error inputs', () => {
      expect(() => handleErrorWithPrefix('String error')).toThrow('String error');
      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'String error');
    });
  });

  describe('HTTP Status Code Handling', () => {
    const createAxiosError = (status: number, message: string, data?: any) => ({
      isAxiosError: true,
      response: {
        status,
        statusText: message,
        data: data || { message }
      },
      config: { url: '/api/test' },
      message: 'Request failed'
    });

    it('should handle 400 Bad Request', () => {
      const error = createAxiosError(400, 'Bad Request');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (400)');
      expect(formatted).toContain('Bad Request');
    });

    it('should handle 401 Unauthorized', () => {
      const error = createAxiosError(401, 'Unauthorized');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (401)');
      expect(formatted).toContain('Unauthorized');
    });

    it('should handle 403 Forbidden', () => {
      const error = createAxiosError(403, 'Forbidden');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (403)');
      expect(formatted).toContain('Forbidden');
    });

    it('should handle 404 Not Found', () => {
      const error = createAxiosError(404, 'Not Found');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (404)');
      expect(formatted).toContain('Not Found');
    });

    it('should handle 422 Unprocessable Entity with validation errors', () => {
      const error = createAxiosError(422, 'Unprocessable Entity', {
        message: 'Validation failed',
        errors: {
          title: ['Title is required'],
          body: ['Body cannot be empty']
        }
      });
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (422)');
      expect(formatted).toContain('Validation failed');
    });

    it('should handle 429 Rate Limited', () => {
      const error = createAxiosError(429, 'Too Many Requests');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (429)');
      expect(formatted).toContain('Too Many Requests');
    });

    it('should handle 500 Internal Server Error', () => {
      const error = createAxiosError(500, 'Internal Server Error');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('HTTP Error (500)');
      expect(formatted).toContain('Internal Server Error');
    });
  });

  describe('Error Context Preservation', () => {
    it('should preserve error stack trace', () => {
      const originalError = new Error('Original error');
      const originalStack = originalError.stack;

      try {
        handleErrorWithPrefix(originalError);
      } catch (thrownError) {
        expect(thrownError.stack).toBe(originalStack);
      }
    });

    it('should preserve custom error properties', () => {
      const customError = createError('Custom error', 'CUSTOM_CODE', { 
        field: 'username',
        value: 'invalid'
      });

      try {
        handleErrorWithPrefix(customError);
      } catch (thrownError) {
        expect(thrownError.code).toBe('CUSTOM_CODE');
        expect(thrownError.details).toEqual({ field: 'username', value: 'invalid' });
      }
    });
  });
});