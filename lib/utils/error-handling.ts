/**
 * Custom application error class with additional metadata
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'GENERIC_ERROR',
    public statusCode: number = 500,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Convert any error type to AppError for consistent handling
 */
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR');
  }

  return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR');
}

/**
 * Log error with context information
 * In production, this could send to monitoring service
 */
export function logError(error: unknown, context?: string) {
  const appError = handleError(error);
  console.error(`[${context || 'ERROR'}]`, {
    message: appError.message,
    code: appError.code,
    stack: appError.stack
  });

  // In production, you might want to send to a monitoring service
  // if (process.env.NODE_ENV === 'production') {
  //   captureException(appError);
  // }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name, stack: error.stack }
    );
  }
}
/**
 * Placeholder for error reporting to external services
 * Replace with actual implementation when needed
 */
function reportErrorToMonitoring(error: AppError, context?: string) {
  // Implementation for external error reporting service
  // Example: Sentry.captureException(error, { tags: { context } });
}
