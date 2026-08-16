/**
 * Central error model for PawTag.
 *
 * All application errors should extend AppError for consistent
 * classification, HTTP status mapping, and structured logging.
 */

export type ErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'BUSINESS_RULE_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'CONFLICT_ERROR'
  | 'SYSTEM_ERROR'
  | 'UNEXPECTED_ERROR';

export interface ErrorMetadata {
  [key: string]: unknown;
}

/**
 * Base application error class.
 * All PawTag errors should extend this.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly isOperational: boolean;
  public readonly metadata: ErrorMetadata;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: ErrorCode;
      httpStatus: number;
      isOperational?: boolean;
      metadata?: ErrorMetadata;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.isOperational = options.isOperational ?? true;
    this.metadata = options.metadata ?? {};
    this.cause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      isOperational: this.isOperational,
      metadata: this.metadata,
    };
  }
}

// ─── Specific Error Classes ─────────────────────────────────────────

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', metadata?: ErrorMetadata) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      httpStatus: 401,
      metadata,
    });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', metadata?: ErrorMetadata) {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      httpStatus: 403,
      metadata,
    });
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AppError {
  public readonly details: Array<{ field: string; message: string }>;

  constructor(
    message = 'Validation failed',
    details: Array<{ field: string; message: string }> = [],
    metadata?: ErrorMetadata
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      httpStatus: 400,
      metadata,
    });
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', metadata?: ErrorMetadata) {
    super(`${resource} not found`, {
      code: 'NOT_FOUND_ERROR',
      httpStatus: 404,
      metadata,
    });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', metadata?: ErrorMetadata) {
    super(message, {
      code: 'CONFLICT_ERROR',
      httpStatus: 409,
      metadata,
    });
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      httpStatus: 422,
      metadata,
    });
    this.name = 'BusinessRuleError';
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', metadata?: ErrorMetadata, cause?: Error) {
    super(message, {
      code: 'DATABASE_ERROR',
      httpStatus: 500,
      isOperational: true,
      metadata,
      cause,
    });
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message = 'External service error', metadata?: ErrorMetadata, cause?: Error) {
    super(`${provider}: ${message}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      httpStatus: 502,
      metadata: { ...metadata, provider },
      cause,
    });
    this.name = 'ExternalServiceError';
    this.provider = provider;
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, metadata?: ErrorMetadata) {
    super(`Operation timed out: ${operation}`, {
      code: 'TIMEOUT_ERROR',
      httpStatus: 504,
      metadata,
    });
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', metadata?: ErrorMetadata) {
    super(message, {
      code: 'RATE_LIMIT_ERROR',
      httpStatus: 429,
      metadata,
    });
    this.name = 'RateLimitError';
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      httpStatus: 500,
      isOperational: false,
      metadata,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Check if an error is an AppError (or subclass).
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown errors to AppError for consistent handling.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof Error) {
    // Handle Mongoose-specific errors
    if (error.name === 'ValidationError') {
      // Mongoose ValidationError - return 400 with validation details
      return new AppError(error.message, {
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        isOperational: true,
        metadata: { mongooseError: true },
      });
    }
    if (error.name === 'CastError') {
      return new ValidationError('Invalid ID format');
    }
    if ((error as any).code === 11000) {
      return new ConflictError('Duplicate value');
    }
    if (error.name === 'ZodError') {
      return new ValidationError(error.message, (error as any).issues);
    }

    return new AppError(error.message, {
      code: 'SYSTEM_ERROR',
      httpStatus: 500,
      cause: error,
    });
  }

  return new AppError('An unexpected error occurred', {
    code: 'UNEXPECTED_ERROR',
    httpStatus: 500,
  });
}
