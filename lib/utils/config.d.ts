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
export interface AIProvidersConfig {
    openai?: {
        apiKey?: string | null;
        model?: string;
    };
    gemini?: {
        apiKey?: string | null;
        model?: string;
    };
    copilot?: {
        apiToken?: string | null;
        model?: string;
    };
}
export interface EnvironmentConfig {
    jira: JiraConfig;
    github: GitHubConfig;
    copilot: CopilotConfig;
    aiProviders?: AIProvidersConfig;
    createdAt: string;
    version: string;
}
/**
 * Load configuration from JSON file
 */
export declare function loadConfig(): EnvironmentConfig;
/**
 * Get specific configuration section
 */
export declare function getConfig<T extends keyof EnvironmentConfig>(section: T): EnvironmentConfig[T];
/**
 * Get specific configuration value
 */
export declare function getConfigValue<T extends keyof EnvironmentConfig, K extends keyof EnvironmentConfig[T]>(section: T, key: K): EnvironmentConfig[T][K];
/**
 * Check if configuration exists and is valid
 */
export declare function validateConfig(): boolean;
/**
 * Get configuration file path
 */
export declare function getConfigFilePath(): string;
/**
 * Check if JSON config file exists
 */
export declare function hasJsonConfig(): boolean;
//# sourceMappingURL=config.d.ts.map