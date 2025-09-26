import chalk from 'chalk';
export class AppError extends Error {
    constructor(message, code, statusCode, isOperational = true) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = 'AppError';
        // Maintains proper stack trace for where error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}
export function handleError(error) {
    if (error instanceof AppError) {
        console.error(chalk.red('❌ Error:'), error.message);
        if (error.code) {
            console.error(chalk.gray('Code:'), error.code);
        }
    }
    else if (error instanceof Error) {
        console.error(chalk.red('❌ Unexpected Error:'), error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error(chalk.gray('Stack:'), error.stack);
        }
    }
    else {
        console.error(chalk.red('❌ Unknown Error:'), String(error));
    }
    // Exit with error code
    process.exit(1);
}
export function createErrorHandler(context) {
    return (error) => {
        if (error instanceof Error) {
            throw new AppError(`${context}: ${error.message}`);
        }
        throw new AppError(`${context}: ${String(error)}`);
    };
}
// Common error patterns
export const ERROR_CODES = {
    INVALID_CONFIG: 'INVALID_CONFIG',
    JIRA_API_ERROR: 'JIRA_API_ERROR',
    GITHUB_API_ERROR: 'GITHUB_API_ERROR',
    GIT_ERROR: 'GIT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR'
};
export function createJiraError(message, statusCode) {
    return new AppError(message, ERROR_CODES.JIRA_API_ERROR, statusCode);
}
export function createGitHubError(message, statusCode) {
    return new AppError(message, ERROR_CODES.GITHUB_API_ERROR, statusCode);
}
export function createGitError(message) {
    return new AppError(message, ERROR_CODES.GIT_ERROR);
}
export function createValidationError(message) {
    return new AppError(message, ERROR_CODES.VALIDATION_ERROR);
}
export function createError(message, code, details) {
    const error = new Error(message);
    if (code)
        error.code = code;
    if (details)
        error.details = details;
    return error;
}
export function isAxiosError(error) {
    return !!(error && error.isAxiosError === true);
}
export function extractErrorDetails(error) {
    if (isAxiosError(error)) {
        if (error.response) {
            return {
                type: 'HTTP_ERROR',
                statusCode: error.response.status,
                statusText: error.response.statusText,
                url: error.config?.url,
                responseData: error.response.data
            };
        }
        else {
            return {
                type: 'NETWORK_ERROR',
                code: error.code,
                url: error.config?.url,
                message: error.message
            };
        }
    }
    else if (error instanceof Error) {
        const details = {
            type: 'GENERIC_ERROR',
            message: error.message
        };
        if (error.code) {
            details.code = error.code;
        }
        return details;
    }
    else if (error) {
        return {
            type: 'UNKNOWN_ERROR',
            message: String(error)
        };
    }
    else {
        return {
            type: 'UNKNOWN_ERROR',
            message: 'Unknown error occurred'
        };
    }
}
export function formatErrorMessage(error) {
    if (!error) {
        return 'Unknown error occurred';
    }
    if (typeof error === 'string') {
        return error || 'Unknown error occurred';
    }
    const details = extractErrorDetails(error);
    switch (details.type) {
        case 'HTTP_ERROR': {
            let message = `HTTP Error (${details.statusCode})`;
            if (details.responseData?.message) {
                message += `: ${details.responseData.message}`;
            }
            else if (details.statusText) {
                message += `: ${details.statusText}`;
            }
            if (details.url) {
                message += ` [${details.url}]`;
            }
            return message;
        }
        case 'NETWORK_ERROR': {
            let netMessage = details.message || 'Network Error';
            if (details.code) {
                netMessage += ` (${details.code})`;
            }
            return netMessage;
        }
        case 'GENERIC_ERROR': {
            let genMessage = details.message || 'Error occurred';
            if (details.code) {
                genMessage += ` [${details.code}]`;
            }
            return genMessage;
        }
        default:
            return details.message || 'Unknown error occurred';
    }
}
// Handle error with prefix and re-throw (for testing)
export function handleErrorWithPrefix(error, prefix = '') {
    const formattedMessage = formatErrorMessage(error);
    const logPrefix = prefix ? `${prefix} Error:` : 'Error:';
    console.error(logPrefix, formattedMessage);
    // Re-throw the original error to preserve stack trace and type
    if (error instanceof Error) {
        throw error;
    }
    else {
        throw new Error(formattedMessage);
    }
}
//# sourceMappingURL=error-handler.js.map