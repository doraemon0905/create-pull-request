import chalk from 'chalk';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(chalk.red('❌ Error:'), error.message);
    if (error.code) {
      console.error(chalk.gray('Code:'), error.code);
    }
  } else if (error instanceof Error) {
    console.error(chalk.red('❌ Unexpected Error:'), error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.gray('Stack:'), error.stack);
    }
  } else {
    console.error(chalk.red('❌ Unknown Error:'), String(error));
  }
  
  // Exit with error code
  process.exit(1);
}

export function createErrorHandler(context: string) {
  return (error: unknown): never => {
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
} as const;

export function createJiraError(message: string, statusCode?: number): AppError {
  return new AppError(message, ERROR_CODES.JIRA_API_ERROR, statusCode);
}

export function createGitHubError(message: string, statusCode?: number): AppError {
  return new AppError(message, ERROR_CODES.GITHUB_API_ERROR, statusCode);
}

export function createGitError(message: string): AppError {
  return new AppError(message, ERROR_CODES.GIT_ERROR);
}

export function createValidationError(message: string): AppError {
  return new AppError(message, ERROR_CODES.VALIDATION_ERROR);
}