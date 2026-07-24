import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../packages/api/src/middleware/auth';

vi.mock('../../packages/api/src/config', () => ({
  config: {
    jwtSecret: 'test-secret',
  },
}));

const SECRET = 'test-secret';

function createReq(token?: string): AuthRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers.authorization = token;
  }
  return { headers } as unknown as AuthRequest;
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

describe('authenticate middleware', () => {
  it('calls next() with valid token', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'user' }, SECRET, { expiresIn: '1h' });
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 401 when no token is provided', () => {
    const req = createReq();
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', () => {
    const req = createReq('Bearer invalid.token.here');
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired token' });
  });

  it('returns 401 for expired token', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'user' }, SECRET, { expiresIn: '0s' });
    // Small delay to ensure token is expired
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sets req.user with decoded token data', () => {
    const payload = { id: 'u1', email: 'a@b.com', role: 'user' };
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    const req = createReq(`Bearer ${token}`);
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe('u1');
    expect(req.user!.email).toBe('a@b.com');
    expect(req.user!.role).toBe('user');
  });

  it('handles malformed Authorization header (no Bearer prefix)', () => {
    const req = createReq('Token abc123');
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' });
  });

  it('handles Authorization header with just "Bearer" and no token', () => {
    const req = createReq('Bearer ');
    const res = createRes();
    const next = createNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
