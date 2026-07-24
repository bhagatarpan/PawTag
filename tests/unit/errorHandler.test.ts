import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../packages/api/src/middleware/errorHandler';

function createRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createReq() {
  return {} as Request;
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
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Validation failed' });
  });

  it('returns 400 for CastError', () => {
    const err = new Error('Cast failed') as Error & { name: string };
    err.name = 'CastError';
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid ID format' });
  });

  it('returns 409 for duplicate key error (code 11000)', () => {
    const err = new Error('duplicate key') as Error & { code: number };
    err.code = 11000;
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Duplicate value' });
  });

  it('returns 500 for unknown errors', () => {
    const err = new Error('Something broke');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Something broke',
    });
  });

  it('hides error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Secret error details');
    const res = createRes();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    });

    process.env.NODE_ENV = originalEnv;
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with route not found message', () => {
    const req = createReq();
    const res = createRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Route not found' });
  });
});
