import axios from 'axios';
import { getConfig } from '../../utils/config.js';
import { HEADERS, HTTP_STATUS, LIMITS } from '../../constants/index.js';
export class BaseAtlassianService {
    constructor(configKey) {
        this.config = getConfig(configKey);
        if (!this.config.baseUrl || !this.config.username || !this.config.apiToken) {
            throw new Error(`Missing ${configKey} configuration. Please run "create-pr setup" to configure your credentials.`);
        }
        this.client = axios.create({
            baseURL: this.config.baseUrl,
            auth: {
                username: this.config.username,
                password: this.config.apiToken
            },
            headers: {
                'Accept': HEADERS.JSON_CONTENT_TYPE,
                'Content-Type': HEADERS.JSON_CONTENT_TYPE
            },
            timeout: LIMITS.API_TIMEOUT_MS
        });
    }
    /**
     * Handle API errors with specific error messages
     */
    handleApiError(error, context) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === HTTP_STATUS.NOT_FOUND) {
                throw new Error(`${context} not found. Please check your request.`);
            }
            else if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
                throw new Error('Authentication failed. Please check your credentials.');
            }
            else if (error.response?.status === HTTP_STATUS.FORBIDDEN) {
                throw new Error('Access denied. Please check your permissions.');
            }
            throw new Error(`${context} API error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
        }
        throw error;
    }
    /**
     * Validate connection to the service
     */
    async validateConnection() {
        await this.client.get('/myself');
        return true;
    }
    /**
     * Manually remove HTML tags without using regex to prevent ReDoS attacks
     * This approach is O(n) linear time and completely safe from backtracking
     */
    removeHtmlTagsManually(htmlContent) {
        let result = '';
        let insideTag = false;
        let tagDepth = 0;
        for (const char of htmlContent) {
            if (char === '<') {
                insideTag = true;
                tagDepth++;
                result += ' '; // Replace tag with space
            }
            else if (char === '>') {
                insideTag = false;
                tagDepth = Math.max(0, tagDepth - 1);
            }
            else if (!insideTag) {
                result += char;
            }
            // Skip characters inside tags
        }
        return result;
    }
    /**
     * Strip HTML tags and compress content for AI consumption
     * Uses manual parsing instead of regex to prevent ReDoS attacks
     */
    stripHtmlAndCompress(htmlContent) {
        if (!htmlContent)
            return '';
        // Input validation to prevent ReDoS attacks
        // Limit input size to prevent excessive processing
        const maxInputLength = 100000; // 100KB limit
        if (htmlContent.length > maxInputLength) {
            htmlContent = htmlContent.substring(0, maxInputLength);
        }
        // Remove HTML tags using a secure approach that follows OWASP secure coding practices
        // Use manual parsing instead of regex to completely avoid ReDoS vulnerabilities
        let cleanContent = this.removeHtmlTagsManually(htmlContent)
            .replaceAll('&nbsp;', ' ') // Replace &nbsp; with space
            .replaceAll('&amp;', '&') // Replace &amp; with &
            .replaceAll('&lt;', '<') // Replace &lt; with <
            .replaceAll('&gt;', '>') // Replace &gt; with >
            .replaceAll('&quot;', '"') // Replace &quot; with "
            .replaceAll('\t', ' ') // Replace tabs with space
            .replaceAll('\n', ' ') // Replace newlines with space
            .replaceAll('\r', ' ') // Replace carriage returns with space
            // Handle multiple consecutive spaces
            .replaceAll('  ', ' ') // Replace double spaces with single space
            .replaceAll('  ', ' ') // Repeat to handle longer sequences
            .replaceAll('  ', ' ') // Repeat to handle longer sequences
            .trim();
        // If content is too long, truncate intelligently
        if (cleanContent.length > LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH) {
            // Use OWASP-compliant regex with lookahead assertions to prevent ReDoS
            cleanContent = this.truncateAtSentenceBoundary(cleanContent, LIMITS.MAX_CONFLUENCE_CONTENT_LENGTH);
        }
        return cleanContent;
    }
    /**
     * Truncate content at sentence boundaries using OWASP-compliant regex to prevent ReDoS attacks
     * Uses lookahead assertions and backreferences to mimic possessive quantifiers
     */
    truncateAtSentenceBoundary(content, maxLength) {
        // OWASP-compliant regex using lookahead and backreferences to prevent backtracking
        // Pattern: (?=([^.!?]*[.!?]+))\1
        // This mimics possessive quantifiers by using atomic grouping
        const sentenceRegex = /(?=([^.!?]*[.!?]+))\1/g;
        const sentences = [];
        let match;
        // Extract all sentences using the secure regex
        while ((match = sentenceRegex.exec(content)) !== null) {
            sentences.push(match[1]);
        }
        // Build result by adding sentences until we reach the limit
        let result = '';
        for (const sentence of sentences) {
            if ((result + sentence).length > maxLength) {
                break;
            }
            result += sentence;
        }
        // Only add ellipsis if we actually truncated content
        if (result.length < content.length) {
            return result.trim() + '...';
        }
        return result.trim();
    }
}
//# sourceMappingURL=base.js.map