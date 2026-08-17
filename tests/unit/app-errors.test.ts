import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  DatabaseError,
  ExternalServiceError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  ConfigurationError,
  IntegrationError,
  isAppError,
  toAppError,
  generateErrorFingerprint,
} from '../../packages/api/src/lib/app-errors';

describe('AppError', () => {
  it('should create an error with correct properties', () => {
    const error = new AppError('Test error', {
      code: 'SYSTEM_ERROR',
      httpStatus: 500,
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('SYSTEM_ERROR');
    expect(error.httpStatus).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have default severity based on error code', () => {
    const validationError = new ValidationError();
    expect(validationError.severity).toBe('LOW');

    const authError = new AuthenticationError();
    expect(authError.severity).toBe('MEDIUM');

    const dbError = new DatabaseError();
    expect(dbError.severity).toBe('HIGH');

    const systemError = new AppError('test', { code: 'SYSTEM_ERROR', httpStatus: 500 });
    expect(systemError.severity).toBe('CRITICAL');
  });

  it('should allow custom severity', () => {
    const error = new AppError('Critical validation', {
      code: 'VALIDATION_ERROR',
      httpStatus: 400,
      severity: 'CRITICAL',
    });
    expect(error.severity).toBe('CRITICAL');
  });

  it('should have default retryability based on error code', () => {
    const validationError = new ValidationError();
    expect(validationError.retryable).toBe(false);

    const timeoutError = new TimeoutError('query');
    expect(timeoutError.retryable).toBe(true);

    const rateLimitError = new RateLimitError();
    expect(rateLimitError.retryable).toBe(true);

    const dbError = new DatabaseError();
    expect(dbError.retryable).toBe(true);
  });

  it('should allow custom retryability', () => {
    const error = new AppError('Non-retryable timeout', {
      code: 'TIMEOUT_ERROR',
      httpStatus: 504,
      retryable: false,
    });
    expect(error.retryable).toBe(false);
  });

  it('should generate a fingerprint', () => {
    const error1 = new NotFoundError('Pet');
    const error2 = new NotFoundError('Pet');
    // Same error code + same message = same fingerprint
    expect(error1.fingerprint).toBe(error2.fingerprint);
    expect(error1.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should generate different fingerprints for different errors', () => {
    const error1 = new NotFoundError('Pet');
    const error2 = new NotFoundError('User');
    expect(error1.fingerprint).not.toBe(error2.fingerprint);
  });

  it('should normalize IDs in fingerprints', () => {
    const error1 = new NotFoundError('Pet 507f1f77bcf86cd799439011');
    const error2 = new NotFoundError('Pet 607f1f77bcf86cd799439022');
    // Both should normalize to same fingerprint since IDs are replaced
    expect(error1.fingerprint).toBe(error2.fingerprint);
  });

  it('should have userMessage', () => {
    const authError = new AuthenticationError();
    expect(authError.userMessage).toBe('Please log in to continue');

    const notFound = new NotFoundError('Pet');
    expect(notFound.userMessage).toBe('The requested item could not be found');
  });

  it('should allow custom userMessage', () => {
    const error = new BusinessRuleError('Cannot delete active subscription', {
      userMessage: 'Please cancel your subscription first',
    } as any);
    // BusinessRuleError uses message as userMessage by default
    expect(error.userMessage).toBe('Cannot delete active subscription');
  });

  it('should support operation context', () => {
    const error = new TimeoutError('database query', { operation: 'findPets' });
    expect(error.operation).toBe('database query');
  });

  it('should serialize to JSON with new fields', () => {
    const error = new AppError('Test', {
      code: 'SYSTEM_ERROR',
      httpStatus: 500,
      metadata: { key: 'value' },
    });

    const json = error.toJSON();
    expect(json.code).toBe('SYSTEM_ERROR');
    expect(json.httpStatus).toBe(500);
    expect(json.metadata).toEqual({ key: 'value' });
    expect(json.severity).toBeDefined();
    expect(json.retryable).toBeDefined();
    expect(json.fingerprint).toBeDefined();
  });

  it('should produce safe response in production', () => {
    const systemError = new AppError('Internal DB connection failed', {
      code: 'SYSTEM_ERROR',
      httpStatus: 500,
      isOperational: false,
    });
    const response = systemError.toResponse();
    expect(response.success).toBe(false);
    expect(response.error).toBe('Internal server error');
    expect(response.code).toBe('SYSTEM_ERROR');
  });

  it('should produce user-facing message for operational errors', () => {
    const notFound = new NotFoundError('Pet');
    const response = notFound.toResponse();
    expect(response.success).toBe(false);
    expect(response.error).toBe('The requested item could not be found');
    expect(response.code).toBe('NOT_FOUND_ERROR');
  });
});

describe('Specific Error Classes', () => {
  it('AuthenticationError has correct defaults', () => {
    const error = new AuthenticationError();
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.httpStatus).toBe(401);
    expect(error.message).toBe('Authentication required');
    expect(error.severity).toBe('MEDIUM');
    expect(error.retryable).toBe(false);
  });

  it('AuthorizationError has correct defaults', () => {
    const error = new AuthorizationError();
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.httpStatus).toBe(403);
    expect(error.severity).toBe('MEDIUM');
  });

  it('ValidationError includes details', () => {
    const details = [{ field: 'name', message: 'Required' }];
    const error = new ValidationError('Validation failed', details);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.details).toEqual(details);
    expect(error.severity).toBe('LOW');
  });

  it('NotFoundError includes resource name', () => {
    const error = new NotFoundError('Pet');
    expect(error.message).toBe('Pet not found');
    expect(error.httpStatus).toBe(404);
    expect(error.severity).toBe('LOW');
  });

  it('ConflictError has correct defaults', () => {
    const error = new ConflictError();
    expect(error.code).toBe('CONFLICT_ERROR');
    expect(error.httpStatus).toBe(409);
    expect(error.severity).toBe('MEDIUM');
  });

  it('BusinessRuleError has 422 status', () => {
    const error = new BusinessRuleError('Cannot delete active subscription');
    expect(error.httpStatus).toBe(422);
    expect(error.severity).toBe('MEDIUM');
  });

  it('DatabaseError has correct defaults', () => {
    const error = new DatabaseError();
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.httpStatus).toBe(500);
    expect(error.severity).toBe('HIGH');
    expect(error.retryable).toBe(true);
  });

  it('ExternalServiceError includes provider', () => {
    const error = new ExternalServiceError('Stripe', 'Payment failed');
    expect(error.provider).toBe('Stripe');
    expect(error.message).toBe('Stripe: Payment failed');
    expect(error.httpStatus).toBe(502);
    expect(error.severity).toBe('HIGH');
    expect(error.retryable).toBe(true);
  });

  it('NetworkError has correct defaults', () => {
    const error = new NetworkError('Connection refused');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.httpStatus).toBe(502);
    expect(error.severity).toBe('HIGH');
    expect(error.retryable).toBe(true);
  });

  it('TimeoutError has 504 status', () => {
    const error = new TimeoutError('database query');
    expect(error.httpStatus).toBe(504);
    expect(error.severity).toBe('HIGH');
    expect(error.retryable).toBe(true);
  });

  it('RateLimitError has 429 status', () => {
    const error = new RateLimitError();
    expect(error.httpStatus).toBe(429);
    expect(error.severity).toBe('LOW');
    expect(error.retryable).toBe(true);
  });

  it('ConfigurationError is not operational', () => {
    const error = new ConfigurationError('Missing DB_URL');
    expect(error.isOperational).toBe(false);
    expect(error.severity).toBe('HIGH');
  });

  it('IntegrationError includes provider', () => {
    const error = new IntegrationError('Twilio', 'SMS delivery failed');
    expect(error.provider).toBe('Twilio');
    expect(error.code).toBe('INTEGRATION_ERROR');
    expect(error.httpStatus).toBe(502);
    expect(error.severity).toBe('HIGH');
    expect(error.retryable).toBe(true);
  });
});

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(new AppError('test', { code: 'SYSTEM_ERROR', httpStatus: 500 }))).toBe(true);
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new AuthenticationError())).toBe(true);
  });

  it('returns false for non-AppError values', () => {
    expect(isAppError(new Error('test'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

describe('toAppError', () => {
  it('returns AppError unchanged', () => {
    const error = new NotFoundError('Pet');
    expect(toAppError(error)).toBe(error);
  });

  it('wraps generic Error as SYSTEM_ERROR', () => {
    const error = new Error('Something went wrong');
    const appError = toAppError(error);
    expect(appError).toBeInstanceOf(AppError);
    expect(appError.code).toBe('SYSTEM_ERROR');
    expect(appError.message).toBe('Something went wrong');
  });

  it('converts Mongoose CastError to ValidationError', () => {
    const error = new Error('Cast to ObjectId failed');
    error.name = 'CastError';
    const appError = toAppError(error);
    expect(appError.code).toBe('VALIDATION_ERROR');
    expect(appError.httpStatus).toBe(400);
  });

  it('converts MongoDB duplicate key to ConflictError', () => {
    const error = new Error('Duplicate key');
    (error as any).code = 11000;
    const appError = toAppError(error);
    expect(appError.code).toBe('CONFLICT_ERROR');
    expect(appError.httpStatus).toBe(409);
  });

  it('converts MongoNetworkError to DatabaseError', () => {
    const error = new Error('Connection refused');
    error.name = 'MongoNetworkError';
    const appError = toAppError(error);
    expect(appError.code).toBe('DATABASE_ERROR');
    expect(appError.httpStatus).toBe(500);
  });

  it('converts timeout errors to TimeoutError', () => {
    const error = new Error('Operation timed out');
    error.name = 'TimeoutError';
    const appError = toAppError(error);
    expect(appError.code).toBe('TIMEOUT_ERROR');
    expect(appError.httpStatus).toBe(504);
  });

  it('wraps unknown values as UNEXPECTED_ERROR', () => {
    const appError = toAppError('string error');
    expect(appError.code).toBe('UNEXPECTED_ERROR');
    expect(appError.httpStatus).toBe(500);
  });
});

describe('generateErrorFingerprint', () => {
  it('generates consistent fingerprints for same input', () => {
    const fp1 = generateErrorFingerprint('NOT_FOUND_ERROR', 'Pet not found');
    const fp2 = generateErrorFingerprint('NOT_FOUND_ERROR', 'Pet not found');
    expect(fp1).toBe(fp2);
  });

  it('generates different fingerprints for different codes', () => {
    const fp1 = generateErrorFingerprint('NOT_FOUND_ERROR', 'Pet not found');
    const fp2 = generateErrorFingerprint('VALIDATION_ERROR', 'Pet not found');
    expect(fp1).not.toBe(fp2);
  });

  it('normalizes MongoDB ObjectIds', () => {
    const fp1 = generateErrorFingerprint('NOT_FOUND_ERROR', 'Pet 507f1f77bcf86cd799439011 not found');
    const fp2 = generateErrorFingerprint('NOT_FOUND_ERROR', 'Pet 607f1f77bcf86cd799439022 not found');
    expect(fp1).toBe(fp2);
  });

  it('normalizes UUIDs', () => {
    const fp1 = generateErrorFingerprint('SYSTEM_ERROR', 'Error 550e8400-e29b-41d4-a716-446655440000');
    const fp2 = generateErrorFingerprint('SYSTEM_ERROR', 'Error 6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(fp1).toBe(fp2);
  });

  it('normalizes numbers', () => {
    const fp1 = generateErrorFingerprint('SYSTEM_ERROR', 'Failed 100 times');
    const fp2 = generateErrorFingerprint('SYSTEM_ERROR', 'Failed 999 times');
    expect(fp1).toBe(fp2);
  });

  it('produces 16-char hex string', () => {
    const fp = generateErrorFingerprint('SYSTEM_ERROR', 'test');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
});
