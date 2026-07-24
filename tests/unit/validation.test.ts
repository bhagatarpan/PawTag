import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../packages/api/src/middleware/validation';

function createReqBody(body: unknown) {
  return { body } as Request;
}

function createRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createNext() {
  return vi.fn() as NextFunction;
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(0),
  });

  it('calls next() for valid data', () => {
    const req = createReqBody({ name: 'Alice', age: 5 });
    const res = createRes();
    const next = createNext();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 400 with error details for invalid data', () => {
    const req = createReqBody({ name: '', age: -1 });
    const res = createRes();
    const next = createNext();

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'name', message: 'Name is required' }),
          expect.objectContaining({ field: 'age' }),
        ]),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('replaces req.body with parsed (coerced/defaulted) data', () => {
    const strictSchema = z.object({
      name: z.string(),
      role: z.enum(['user', 'admin']).default('user'),
    });
    const req = createReqBody({ name: 'Bob' });
    const res = createRes();
    const next = createNext();

    validate(strictSchema)(req, res, next);

    expect(req.body).toEqual({ name: 'Bob', role: 'user' });
    expect(next).toHaveBeenCalled();
  });

  it('handles nested path errors', () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1, 'Name is required'),
        }),
      }),
    });
    const req = createReqBody({ user: { profile: { name: '' } } });
    const res = createRes();
    const next = createNext();

    validate(nestedSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'user.profile.name', message: 'Name is required' }),
      ]),
    );
  });
});
