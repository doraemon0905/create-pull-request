import * as fs from 'fs';
import * as path from 'path';

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
 * Load configuration from JSON file
 */
export function loadConfig(): EnvironmentConfig {
    if (!fs.existsSync(CONFIG_FILE)) {
        throw new Error(`Configuration file not found at ${CONFIG_FILE}. Please run 'create-pr setup' to create your configuration.`);
    }

    try {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configData);
        return config;
    } catch (error) {
        throw new Error(`Failed to parse configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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