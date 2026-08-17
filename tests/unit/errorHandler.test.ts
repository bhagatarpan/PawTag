import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../packages/api/src/middleware/errorHandler';

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../../packages/api/src/lib/request-context', () => ({
  getRequestContext: vi.fn().mockReturnValue(undefined),
}));

function createRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createReq() {
  return { originalUrl: '/api/test', method: 'GET', headers: {}, ip: '127.0.0.1' } as unknown as Request;
}

function createNext() {
  return vi.fn() as NextFunction;
}

describe('errorHandler', () => {
  let req: Request;
  let next: NextFunction;

  beforeEach(() => {
    req = createReq();
    next = createNext();
  });

  it('returns 400 for ValidationError', () => {
    const err = new Error('Validation failed') as Error & { name: string };
    err.name = 'ValidationError';
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Validation failed');
    expect(jsonCall.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for CastError', () => {
    const err = new Error('Cast failed') as Error & { name: string };
    err.name = 'CastError';
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Invalid ID format');
    expect(jsonCall.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 for duplicate key error (code 11000)', () => {
    const err = new Error('duplicate key') as Error & { code: number };
    err.code = 11000;
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Duplicate value');
    expect(jsonCall.code).toBe('CONFLICT_ERROR');
  });

  it('returns 500 for unknown errors', () => {
    const err = new Error('Something broke');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Something broke');
    expect(jsonCall.code).toBe('SYSTEM_ERROR');
  });

  it('hides error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Secret error details');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Internal server error');
    expect(jsonCall.code).toBe('SYSTEM_ERROR');

    process.env.NODE_ENV = originalEnv;
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with route not found message', () => {
    const req = createReq();
    const res = createRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.success).toBe(false);
    expect(jsonCall.error).toBe('Route not found');
    expect(jsonCall.path).toBeDefined();
  });
});
