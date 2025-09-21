import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  getConfig,
  getConfigValue,
  validateConfig,
  hasJsonConfig,
  getConfigFilePath,
  EnvironmentConfig
} from '../utils/config';
import { CONFIG } from '../constants';

// Mock dependencies
jest.mock('fs');
jest.mock('os');
jest.mock('path');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('Config Utils', () => {
  const mockHomedir = '/Users/testuser';
  const mockConfigPath = '/Users/testuser/.create-pr/env-config.json';

  const mockValidConfig: EnvironmentConfig = {
    jira: {
      baseUrl: 'https://company.atlassian.net',
      username: 'test@company.com',
      apiToken: 'jira-token',
      projectKey: 'PROJ'
    },
    github: {
      token: 'github-token',
      defaultBranch: 'main'
    },
    copilot: {
      apiToken: 'copilot-token'
    },
    aiProviders: {
      claude: {
        apiKey: 'claude-key',
        model: 'claude-3-5-sonnet-20241022'
      },
      openai: {
        apiKey: 'openai-key',
        model: 'gpt-4o'
      },
      gemini: {
        apiKey: 'gemini-key',
        model: 'gemini-1.5-pro'
      }
    },
    createdAt: '2023-01-01T00:00:00.000Z',
    version: '1.1.8'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedOs.homedir.mockReturnValue(mockHomedir);
    mockedPath.join.mockReturnValue(mockConfigPath);
  });

  describe('getConfigFilePath', () => {
    it('should return correct config file path', () => {
      const result = getConfigFilePath();

      expect(result).toBe(mockConfigPath);
      expect(mockedPath.join).toHaveBeenCalledWith(
        mockHomedir,
        CONFIG.DIRECTORY_NAME,
        CONFIG.FILE_NAME
      );
    });
  });

  describe('hasJsonConfig', () => {
    it('should return true when config file exists', () => {
      mockedFs.existsSync.mockReturnValue(true);

      const result = hasJsonConfig();

      expect(result).toBe(true);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should return false when config file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = hasJsonConfig();

      expect(result).toBe(false);
    });
  });

  describe('loadConfig', () => {
    it('should load and parse valid config file', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockValidConfig));

      const result = loadConfig();

      expect(result).toEqual(mockValidConfig);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf8');
    });

    it('should throw error when config file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => loadConfig()).toThrow(
        `Configuration file not found at ${mockConfigPath}. Please run 'create-pr setup' to create your configuration.`
      );
    });

    it('should throw error when config file is invalid JSON', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');

      expect(() => loadConfig()).toThrow('Failed to parse configuration file:');
    });

    it('should handle file read errors', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadConfig()).toThrow('Failed to parse configuration file: Permission denied');
    });
  });

  describe('getConfig', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockValidConfig));
    });

    it('should return specific configuration section', () => {
      const result = getConfig('jira');

      expect(result).toEqual(mockValidConfig.jira);
    });

    it('should return github configuration', () => {
      const result = getConfig('github');

      expect(result).toEqual(mockValidConfig.github);
    });

    it('should return aiProviders configuration', () => {
      const result = getConfig('aiProviders');

      expect(result).toEqual(mockValidConfig.aiProviders);
    });

    it('should return undefined for non-existent section', () => {
      const result = getConfig('nonexistent' as any);

      expect(result).toBeUndefined();
    });
  });

  describe('getConfigValue', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockValidConfig));
    });

    it('should return specific configuration value', () => {
      const result = getConfigValue('jira', 'baseUrl');

      expect(result).toBe('https://company.atlassian.net');
    });

    it('should return github token', () => {
      const result = getConfigValue('github', 'token');

      expect(result).toBe('github-token');
    });

    it('should return undefined for non-existent key', () => {
      const result = getConfigValue('jira', 'nonexistent' as any);

      expect(result).toBeUndefined();
    });

    it('should throw error for non-existent section', () => {
      expect(() => getConfigValue('nonexistent' as any, 'key' as any)).toThrow(
        "Configuration section 'nonexistent' not found or invalid"
      );
    });

    it('should handle null section config', () => {
      const configWithNull = { ...mockValidConfig, jira: null as any };
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(configWithNull));

      expect(() => getConfigValue('jira', 'baseUrl')).toThrow(
        "Configuration section 'jira' not found or invalid"
      );
    });
  });

  describe('validateConfig', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it('should return true for valid configuration', () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockValidConfig));

      const result = validateConfig();

      expect(result).toBe(true);
    });

    it('should return false when required field is missing', () => {
      const invalidConfig = {
        ...mockValidConfig,
        jira: {
          ...mockValidConfig.jira,
          baseUrl: '' // Missing required field
        }
      };
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      const result = validateConfig();

      expect(result).toBe(false);
    });

    it('should return false when config file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = validateConfig();

      expect(result).toBe(false);
    });

    it('should return false when config is invalid JSON', () => {
      mockedFs.readFileSync.mockReturnValue('invalid json');

      const result = validateConfig();

      expect(result).toBe(false);
    });

    it('should validate all required fields', () => {
      const testCases = [
        { path: 'jira.baseUrl', value: '' },
        { path: 'jira.username', value: '' },
        { path: 'jira.apiToken', value: '' },
        { path: 'github.token', value: '' }
      ];

      testCases.forEach(({ path, value }) => {
        const invalidConfig = JSON.parse(JSON.stringify(mockValidConfig));
        const keys = path.split('.');
        let obj = invalidConfig;
        
        for (let i = 0; i < keys.length - 1; i++) {
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;

        mockedFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

        const result = validateConfig();
        expect(result).toBe(false);
      });
    });

    it('should handle missing sections gracefully', () => {
      const configMissingSections = {
        createdAt: '2023-01-01T00:00:00.000Z',
        version: '1.1.8'
      };
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(configMissingSections));

      const result = validateConfig();

      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle filesystem errors gracefully', () => {
      mockedFs.existsSync.mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      expect(() => hasJsonConfig()).toThrow('Filesystem error');
    });

    it('should handle JSON parsing errors with detailed message', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{ invalid json }');

      expect(() => loadConfig()).toThrow(/Failed to parse configuration file:/);
    });

    it('should handle missing config gracefully in validation', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = validateConfig();

      expect(result).toBe(false);
    });
  });

  describe('Configuration structure validation', () => {
    it('should handle optional fields correctly', () => {
      const configWithOptionalFields = {
        ...mockValidConfig,
        jira: {
          ...mockValidConfig.jira,
          projectKey: null // Optional field
        },
        aiProviders: {
          claude: {
            apiKey: 'claude-key'
            // model is optional
          }
        }
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(configWithOptionalFields));

      const result = validateConfig();

      expect(result).toBe(true);
    });

    it('should handle empty aiProviders section', () => {
      const configWithoutAI = {
        ...mockValidConfig,
        aiProviders: {}
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(configWithoutAI));

      const result = validateConfig();

      expect(result).toBe(true);
    });

    it('should handle missing copilot section', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { copilot, ...configWithoutCopilot } = mockValidConfig;

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(configWithoutCopilot));

      const result = validateConfig();

      expect(result).toBe(true);
    });
  });

  describe('Path resolution', () => {
    it('should handle different operating systems', () => {
      const windowsPath = 'C:\\Users\\testuser\\.create-pr\\env-config.json';
      mockedPath.join.mockReturnValue(windowsPath);

      const result = getConfigFilePath();

      expect(result).toBe(windowsPath);
    });

    it('should handle home directory variations', () => {
      mockedOs.homedir.mockReturnValue('/home/testuser');
      mockedPath.join.mockReturnValue('/home/testuser/.create-pr/env-config.json');

      const result = getConfigFilePath();

      expect(result).toBe('/home/testuser/.create-pr/env-config.json');
    });
  });
});