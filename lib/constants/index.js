"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM = exports.JIRA_ENDPOINTS = exports.HEADERS = exports.REGEX_PATTERNS = exports.FILE_PATHS = exports.CONFIG = exports.HTTP_STATUS = exports.LIMITS = exports.DEFAULT_MODELS = exports.API_URLS = void 0;
// Load package.json to get dynamic version
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Function to get version from package.json
function getPackageVersion() {
    try {
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version || '1.0.0';
    }
    catch (error) {
        // Fallback version if package.json can't be read
        return '1.0.0';
    }
}
// API Configuration
exports.API_URLS = {
    CLAUDE_BASE_URL: 'https://api.anthropic.com',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    COPILOT_BASE_URL: 'https://api.githubcopilot.com',
    JIRA_API_VERSION: '/rest/api/3'
};
// Default Models
exports.DEFAULT_MODELS = {
    CLAUDE: 'claude-3-5-sonnet-20241022',
    OPENAI: 'gpt-4o',
    GEMINI: 'gemini-1.5-pro',
    COPILOT: 'gpt-4o'
};
// Limits and Timeouts
exports.LIMITS = {
    API_TIMEOUT_MS: 30000,
    MAX_API_TOKENS: 4000,
    MAX_PR_TITLE_LENGTH: 256,
    DEFAULT_MAX_DIFF_LINES: 1000,
    MAX_DESCRIPTION_PREVIEW_LENGTH: 500,
    MAX_TEMPLATE_PREVIEW_LENGTH: 800,
    MAX_DIFF_CONTENT_LENGTH: 1000,
    MAX_OVERALL_DIFF_LENGTH: 3000,
    HUNK_HEADER_OFFSET: 10
};
// HTTP Status Codes
exports.HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404
};
// Configuration Constants
exports.CONFIG = {
    DIRECTORY_NAME: '.create-pr',
    FILE_NAME: 'env-config.json',
    VERSION: getPackageVersion(),
    DEFAULT_BRANCH: 'main',
    DEFAULT_REMOTE: 'origin',
    CLI_NAME: 'create-pr',
    CLI_VERSION: getPackageVersion()
};
// File System
exports.FILE_PATHS = {
    PR_TEMPLATE_PATHS: [
        '.github/pull_request_template.md',
        '.github/PULL_REQUEST_TEMPLATE.md',
        'pull_request_template.md',
        'PULL_REQUEST_TEMPLATE.md',
        '.github/PULL_REQUEST_TEMPLATE/default.md'
    ]
};
// Regular Expressions
exports.REGEX_PATTERNS = {
    JIRA_TICKET: /^[A-Z][A-Z0-9]*-\d+$/,
    JIRA_TICKET_FROM_BRANCH: /(?:^|[/\-_])([A-Z][A-Z0-9]*-\d+)(?:[/\-_]|$)/i,
    GITHUB_URL: /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
};
// Content Types and Headers
exports.HEADERS = {
    JSON_CONTENT_TYPE: 'application/json',
    USER_AGENT: 'create-pr-cli'
};
// JIRA Endpoints
exports.JIRA_ENDPOINTS = {
    ISSUE: '/issue/',
    USER: '/myself'
};
// System Constants
exports.SYSTEM = {
    EXECUTABLE_PERMISSIONS: '755',
    MIN_NODE_VERSION: '>=18.0.0'
};
//# sourceMappingURL=index.js.map