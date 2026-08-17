/**
 * Central error model for PawTag.
 *
 * All application errors should extend AppError for consistent
 * classification, HTTP status mapping, and structured logging.
 */

import { createHash } from 'node:crypto';

export type ErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'BUSINESS_RULE_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'CONFLICT_ERROR'
  | 'INTEGRATION_ERROR'
  | 'SYSTEM_ERROR'
  | 'UNEXPECTED_ERROR';

export type ErrorSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ErrorMetadata {
  [key: string]: unknown;
}

/**
 * Default severity mapping by error code.
 */
const DEFAULT_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  VALIDATION_ERROR: 'LOW',
  NOT_FOUND_ERROR: 'LOW',
  RATE_LIMIT_ERROR: 'LOW',
  AUTHENTICATION_ERROR: 'MEDIUM',
  AUTHORIZATION_ERROR: 'MEDIUM',
  CONFLICT_ERROR: 'MEDIUM',
  BUSINESS_RULE_ERROR: 'MEDIUM',
  TIMEOUT_ERROR: 'HIGH',
  NETWORK_ERROR: 'HIGH',
  EXTERNAL_SERVICE_ERROR: 'HIGH',
  INTEGRATION_ERROR: 'HIGH',
  DATABASE_ERROR: 'HIGH',
  CONFIGURATION_ERROR: 'HIGH',
  SYSTEM_ERROR: 'CRITICAL',
  UNEXPECTED_ERROR: 'CRITICAL',
};

/**
 * Default retryability mapping by error code.
 */
const DEFAULT_RETRYABLE: Record<ErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  NOT_FOUND_ERROR: false,
  AUTHENTICATION_ERROR: false,
  AUTHORIZATION_ERROR: false,
  CONFLICT_ERROR: false,
  BUSINESS_RULE_ERROR: false,
  RATE_LIMIT_ERROR: true,
  TIMEOUT_ERROR: true,
  NETWORK_ERROR: true,
  EXTERNAL_SERVICE_ERROR: true,
  INTEGRATION_ERROR: true,
  DATABASE_ERROR: true,
  CONFIGURATION_ERROR: false,
  SYSTEM_ERROR: false,
  UNEXPECTED_ERROR: false,
};

/**
 * Generate a stable fingerprint for grouping repeated errors.
 * Based on error code + message (normalized) so identical errors
 * across different requests get the same fingerprint.
 */
export function generateErrorFingerprint(code: ErrorCode, message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{24}/gi, '<id>')       // MongoDB ObjectIds
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>') // UUIDs
    .replace(/\d+/g, '<n>')                   // Numbers
    .replace(/\s+/g, ' ')                     // Normalize whitespace
    .trim();

  return createHash('sha256')
    .update(`${code}:${normalized}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Base application error class.
 * All PawTag errors should extend this.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly isOperational: boolean;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly fingerprint: string;
  public readonly metadata: ErrorMetadata;
  public readonly cause?: Error;
  public readonly userMessage: string;
  public readonly operation?: string;

  constructor(
    message: string,
    options: {
      code: ErrorCode;
      httpStatus: number;
      isOperational?: boolean;
      severity?: ErrorSeverity;
      retryable?: boolean;
      userMessage?: string;
      operation?: string;
      metadata?: ErrorMetadata;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.isOperational = options.isOperational ?? true;
    this.severity = options.severity ?? DEFAULT_SEVERITY[options.code];
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[options.code];
    this.fingerprint = generateErrorFingerprint(options.code, message);
    this.metadata = options.metadata ?? {};
    this.cause = options.cause;
    this.userMessage = options.userMessage ?? message;
    this.operation = options.operation;

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
      severity: this.severity,
      retryable: this.retryable,
      fingerprint: this.fingerprint,
      metadata: this.metadata,
    };
  }

  /**
   * Get a safe response object for client-facing responses.
   * Strips internal details in production.
   */
  toResponse(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      success: false,
      error: this.isOperational ? this.userMessage : 'Internal server error',
      code: this.code,
    };

    if (this.isOperational && 'details' in this) {
      base.details = (this as any).details;
    }

    return base;
  }
}

// ─── Specific Error Classes ─────────────────────────────────────────

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', metadata?: ErrorMetadata) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      httpStatus: 401,
      userMessage: 'Please log in to continue',
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
      userMessage: 'You do not have permission to perform this action',
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
      userMessage: 'Please check your input and try again',
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
      userMessage: 'The requested item could not be found',
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
      userMessage: 'This item already exists',
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
      userMessage: message,
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
      userMessage: 'A system error occurred. Please try again later',
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
      userMessage: 'A third-party service is temporarily unavailable. Please try again later',
      metadata: { ...metadata, provider },
      cause,
    });
    this.name = 'ExternalServiceError';
    this.provider = provider;
  }
}

export class NetworkError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata, cause?: Error) {
    super(message, {
      code: 'NETWORK_ERROR',
      httpStatus: 502,
      userMessage: 'A network error occurred. Please try again later',
      metadata,
      cause,
    });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, metadata?: ErrorMetadata) {
    super(`Operation timed out: ${operation}`, {
      code: 'TIMEOUT_ERROR',
      httpStatus: 504,
      operation,
      userMessage: 'The operation took too long. Please try again later',
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
      userMessage: 'Too many requests. Please wait and try again',
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
      userMessage: 'A system error occurred. Please try again later',
      metadata,
    });
    this.name = 'ConfigurationError';
  }
}

export class IntegrationError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message: string, metadata?: ErrorMetadata, cause?: Error) {
    super(`${provider}: ${message}`, {
      code: 'INTEGRATION_ERROR',
      httpStatus: 502,
      userMessage: 'A third-party service is temporarily unavailable. Please try again later',
      metadata: { ...metadata, provider },
      cause,
    });
    this.name = 'IntegrationError';
    this.provider = provider;
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
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return new DatabaseError(error.message, { mongoError: true }, error);
    }
    if (error.name === 'TimeoutError' || error.message?.includes('timed out')) {
      return new TimeoutError(error.message, { originalName: error.name });
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
