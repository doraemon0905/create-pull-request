export declare class AppError extends Error {
    code?: string | undefined;
    statusCode?: number | undefined;
    isOperational: boolean;
    constructor(message: string, code?: string | undefined, statusCode?: number | undefined, isOperational?: boolean);
}
export declare function handleError(error: unknown): void;
export declare function createErrorHandler(context: string): (error: unknown) => never;
export declare const ERROR_CODES: {
    readonly INVALID_CONFIG: "INVALID_CONFIG";
    readonly JIRA_API_ERROR: "JIRA_API_ERROR";
    readonly GITHUB_API_ERROR: "GITHUB_API_ERROR";
    readonly GIT_ERROR: "GIT_ERROR";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly AUTH_ERROR: "AUTH_ERROR";
};
export declare function createJiraError(message: string, statusCode?: number): AppError;
export declare function createGitHubError(message: string, statusCode?: number): AppError;
export declare function createGitError(message: string): AppError;
export declare function createValidationError(message: string): AppError;
//# sourceMappingURL=error-handler.d.ts.map