import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export interface JiraConfig {
    baseUrl: string;
    username: string;
    apiToken: string;
    projectKey?: string | null;
}

export interface GitHubConfig {
    token: string;
    defaultBranch: string;
}

export interface CopilotConfig {
    apiToken?: string | null;
}

export interface EnvironmentConfig {
    jira: JiraConfig;
    github: GitHubConfig;
    copilot: CopilotConfig;
    createdAt: string;
    version: string;
}

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'env-config.json');

/**
 * Load configuration from JSON file with fallback to .env file
 */
export function loadConfig(): EnvironmentConfig {
    // Try to load from JSON config file first
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = JSON.parse(configData);
            return config;
        } catch (error) {
            console.warn('Failed to parse JSON config file, falling back to .env file');
        }
    }

    // Fallback to .env file
    dotenv.config();

    const requiredEnvVars = ['JIRA_BASE_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN', 'GITHUB_TOKEN'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. Please run 'npm run setup-env' or create a .env file.`);
    }

    return {
        jira: {
            baseUrl: process.env.JIRA_BASE_URL!,
            username: process.env.JIRA_USERNAME!,
            apiToken: process.env.JIRA_API_TOKEN!,
            projectKey: process.env.JIRA_PROJECT_KEY || null
        },
        github: {
            token: process.env.GITHUB_TOKEN!,
            defaultBranch: process.env.DEFAULT_BRANCH || 'main'
        },
        copilot: {
            apiToken: process.env.COPILOT_API_TOKEN || null
        },
        createdAt: new Date().toISOString(),
        version: '1.0.0'
    };
}

/**
 * Get specific configuration section
 */
export function getConfig<T extends keyof EnvironmentConfig>(section: T): EnvironmentConfig[T] {
    const config = loadConfig();
    return config[section];
}

/**
 * Get specific configuration value
 */
export function getConfigValue<T extends keyof EnvironmentConfig, K extends keyof EnvironmentConfig[T]>(
    section: T,
    key: K
): EnvironmentConfig[T][K] {
    const config = loadConfig();
    return config[section][key];
}

/**
 * Check if configuration exists and is valid
 */
export function validateConfig(): boolean {
    try {
        const config = loadConfig();
        
        // Check required fields
        const required = [
            config.jira.baseUrl,
            config.jira.username,
            config.jira.apiToken,
            config.github.token
        ];
        
        return required.every(field => field && field.trim().length > 0);
    } catch {
        return false;
    }
}

/**
 * Get configuration file path
 */
export function getConfigFilePath(): string {
    return CONFIG_FILE;
}

/**
 * Check if JSON config file exists
 */
export function hasJsonConfig(): boolean {
    return fs.existsSync(CONFIG_FILE);
}