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
  TimeoutError,
  RateLimitError,
  ConfigurationError,
  isAppError,
  toAppError,
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

  it('should serialize to JSON', () => {
    const error = new AppError('Test', {
      code: 'SYSTEM_ERROR',
      httpStatus: 500,
      metadata: { key: 'value' },
    });

    const json = error.toJSON();
    expect(json.code).toBe('SYSTEM_ERROR');
    expect(json.httpStatus).toBe(500);
    expect(json.metadata).toEqual({ key: 'value' });
  });
});

describe('Specific Error Classes', () => {
  it('AuthenticationError has correct defaults', () => {
    const error = new AuthenticationError();
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.httpStatus).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('AuthorizationError has correct defaults', () => {
    const error = new AuthorizationError();
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.httpStatus).toBe(403);
  });

  it('ValidationError includes details', () => {
    const details = [{ field: 'name', message: 'Required' }];
    const error = new ValidationError('Validation failed', details);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('NotFoundError includes resource name', () => {
    const error = new NotFoundError('Pet');
    expect(error.message).toBe('Pet not found');
    expect(error.httpStatus).toBe(404);
  });

  it('ConflictError has correct defaults', () => {
    const error = new ConflictError();
    expect(error.code).toBe('CONFLICT_ERROR');
    expect(error.httpStatus).toBe(409);
  });

  it('BusinessRuleError has 422 status', () => {
    const error = new BusinessRuleError('Cannot delete active subscription');
    expect(error.httpStatus).toBe(422);
  });

  it('DatabaseError has correct defaults', () => {
    const error = new DatabaseError();
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.httpStatus).toBe(500);
  });

  it('ExternalServiceError includes provider', () => {
    const error = new ExternalServiceError('Stripe', 'Payment failed');
    expect(error.provider).toBe('Stripe');
    expect(error.message).toBe('Stripe: Payment failed');
    expect(error.httpStatus).toBe(502);
  });

  it('TimeoutError has 504 status', () => {
    const error = new TimeoutError('database query');
    expect(error.httpStatus).toBe(504);
  });

  it('RateLimitError has 429 status', () => {
    const error = new RateLimitError();
    expect(error.httpStatus).toBe(429);
  });

  it('ConfigurationError is not operational', () => {
    const error = new ConfigurationError('Missing DB_URL');
    expect(error.isOperational).toBe(false);
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

  it('wraps unknown values as UNEXPECTED_ERROR', () => {
    const appError = toAppError('string error');
    expect(appError.code).toBe('UNEXPECTED_ERROR');
    expect(appError.httpStatus).toBe(500);
  });
});
