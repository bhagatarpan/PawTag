import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../packages/api/src/middleware/auth';

// ─── Mock authorization.service ─────────────────────────────────────
vi.mock('../../packages/api/src/services/authorization.service', () => ({
  userHasPermission: vi.fn(),
}));

import { requirePermission } from '../../packages/api/src/middleware/permission';
import { userHasPermission } from '../../packages/api/src/services/authorization.service';

const mockUserHasPermission = vi.mocked(userHasPermission);

function createReq(user?: AuthRequest['user']): AuthRequest {
  return { user } as AuthRequest;
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

describe('permission middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when req.user is not set', async () => {
    const req = createReq(undefined);
    const res = createRes();
    const next = createNext();

    const middleware = requirePermission('manage_users');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Not authenticated',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when userHasPermission returns allowed:true', async () => {
    mockUserHasPermission.mockResolvedValue({ allowed: true, scope: null });

    const req = createReq({ id: 'user-1', email: 'test@test.com', role: 'admin' });
    const res = createRes();
    const next = createNext();

    const middleware = requirePermission('manage_users');
    await middleware(req, res, next);

    expect(mockUserHasPermission).toHaveBeenCalledWith('user-1', 'manage_users', undefined);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when userHasPermission returns allowed:false', async () => {
    mockUserHasPermission.mockResolvedValue({ allowed: false, scope: null });

    const req = createReq({ id: 'user-2', email: 'test@test.com', role: 'user' });
    const res = createRes();
    const next = createNext();

    const middleware = requirePermission('manage_users');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Insufficient permissions',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when authorization throws an error', async () => {
    mockUserHasPermission.mockRejectedValue(new Error('Database connection failed'));

    const req = createReq({ id: 'user-3', email: 'test@test.com', role: 'user' });
    const res = createRes();
    const next = createNext();

    const middleware = requirePermission('manage_users');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authorization check failed',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes scopeCode through to userHasPermission', async () => {
    mockUserHasPermission.mockResolvedValue({ allowed: true, scope: 'own' });

    const req = createReq({ id: 'user-4', email: 'test@test.com', role: 'admin' });
    const res = createRes();
    const next = createNext();

    const middleware = requirePermission('manage_pets', 'own');
    await middleware(req, res, next);

    expect(mockUserHasPermission).toHaveBeenCalledWith('user-4', 'manage_pets', 'own');
    expect(next).toHaveBeenCalled();
  });
});
