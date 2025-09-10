export declare const API_URLS: {
    readonly OPENAI_BASE_URL: "https://api.openai.com/v1";
    readonly GEMINI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta";
    readonly COPILOT_BASE_URL: "https://api.githubcopilot.com";
    readonly JIRA_API_VERSION: "/rest/api/3";
};
export declare const DEFAULT_MODELS: {
    readonly OPENAI: "gpt-4o";
    readonly GEMINI: "gemini-1.5-pro";
    readonly COPILOT: "gpt-4o";
};
export declare const LIMITS: {
    readonly API_TIMEOUT_MS: 30000;
    readonly MAX_API_TOKENS: 4000;
    readonly MAX_PR_TITLE_LENGTH: 256;
    readonly DEFAULT_MAX_DIFF_LINES: 1000;
    readonly MAX_DESCRIPTION_PREVIEW_LENGTH: 500;
    readonly MAX_TEMPLATE_PREVIEW_LENGTH: 800;
    readonly MAX_DIFF_CONTENT_LENGTH: 1000;
    readonly MAX_OVERALL_DIFF_LENGTH: 3000;
    readonly HUNK_HEADER_OFFSET: 10;
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
};
export declare const CONFIG: {
    readonly DIRECTORY_NAME: ".create-pr";
    readonly FILE_NAME: "env-config.json";
    readonly VERSION: "1.1.0";
    readonly DEFAULT_BRANCH: "main";
    readonly DEFAULT_REMOTE: "origin";
    readonly CLI_NAME: "create-pr";
    readonly CLI_VERSION: "1.0.0";
};
export declare const FILE_PATHS: {
    readonly PR_TEMPLATE_PATHS: readonly [".github/pull_request_template.md", ".github/PULL_REQUEST_TEMPLATE.md", "pull_request_template.md", "PULL_REQUEST_TEMPLATE.md", ".github/PULL_REQUEST_TEMPLATE/default.md"];
};
export declare const REGEX_PATTERNS: {
    readonly JIRA_TICKET: RegExp;
    readonly JIRA_TICKET_FROM_BRANCH: RegExp;
    readonly GITHUB_URL: RegExp;
};
export declare const HEADERS: {
    readonly JSON_CONTENT_TYPE: "application/json";
    readonly USER_AGENT: "create-pr-cli";
};
export declare const JIRA_ENDPOINTS: {
    readonly ISSUE: "/issue/";
    readonly USER: "/myself";
};
export declare const SYSTEM: {
    readonly EXECUTABLE_PERMISSIONS: "755";
    readonly MIN_NODE_VERSION: ">=18.0.0";
};
//# sourceMappingURL=index.d.ts.map