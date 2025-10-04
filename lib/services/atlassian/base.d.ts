import { AxiosInstance } from 'axios';
export interface AtlassianConfig {
    baseUrl: string;
    username: string;
    apiToken: string;
}
export declare abstract class BaseAtlassianService {
    protected client: AxiosInstance;
    protected readonly config: AtlassianConfig;
    constructor(configKey: keyof import('../../utils/config.js').EnvironmentConfig);
    /**
     * Handle API errors with specific error messages
     */
    protected handleApiError(error: any, context: string): never;
    /**
     * Validate connection to the service
     */
    validateConnection(): Promise<boolean>;
    /**
     * Manually remove HTML tags without using regex to prevent ReDoS attacks
     * This approach is O(n) linear time and completely safe from backtracking
     */
    protected removeHtmlTagsManually(htmlContent: string): string;
    /**
     * Strip HTML tags and compress content for AI consumption
     * Uses manual parsing instead of regex to prevent ReDoS attacks
     */
    protected stripHtmlAndCompress(htmlContent: string): string;
    /**
     * Truncate content at sentence boundaries using OWASP-compliant regex to prevent ReDoS attacks
     * Uses lookahead assertions and backreferences to mimic possessive quantifiers
     */
    protected truncateAtSentenceBoundary(content: string, maxLength: number): string;
}
//# sourceMappingURL=base.d.ts.map