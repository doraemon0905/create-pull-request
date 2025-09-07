"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.AppError = void 0;
exports.handleError = handleError;
exports.createErrorHandler = createErrorHandler;
exports.createJiraError = createJiraError;
exports.createGitHubError = createGitHubError;
exports.createGitError = createGitError;
exports.createValidationError = createValidationError;
const chalk_1 = __importDefault(require("chalk"));
class AppError extends Error {
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
exports.AppError = AppError;
function handleError(error) {
    if (error instanceof AppError) {
        console.error(chalk_1.default.red('❌ Error:'), error.message);
        if (error.code) {
            console.error(chalk_1.default.gray('Code:'), error.code);
        }
    }
    else if (error instanceof Error) {
        console.error(chalk_1.default.red('❌ Unexpected Error:'), error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error(chalk_1.default.gray('Stack:'), error.stack);
        }
    }
    else {
        console.error(chalk_1.default.red('❌ Unknown Error:'), String(error));
    }
    // Exit with error code
    process.exit(1);
}
function createErrorHandler(context) {
    return (error) => {
        if (error instanceof Error) {
            throw new AppError(`${context}: ${error.message}`);
        }
        throw new AppError(`${context}: ${String(error)}`);
    };
}
// Common error patterns
exports.ERROR_CODES = {
    INVALID_CONFIG: 'INVALID_CONFIG',
    JIRA_API_ERROR: 'JIRA_API_ERROR',
    GITHUB_API_ERROR: 'GITHUB_API_ERROR',
    GIT_ERROR: 'GIT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR'
};
function createJiraError(message, statusCode) {
    return new AppError(message, exports.ERROR_CODES.JIRA_API_ERROR, statusCode);
}
function createGitHubError(message, statusCode) {
    return new AppError(message, exports.ERROR_CODES.GITHUB_API_ERROR, statusCode);
}
function createGitError(message) {
    return new AppError(message, exports.ERROR_CODES.GIT_ERROR);
}
function createValidationError(message) {
    return new AppError(message, exports.ERROR_CODES.VALIDATION_ERROR);
}
//# sourceMappingURL=error-handler.js.map