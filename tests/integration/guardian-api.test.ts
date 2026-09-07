import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { createServer } from 'http';

// Mock the database connection
vi.mock('mongoose', () => ({
  connect: vi.fn(),
  connection: {
    readyState: 1,
    close: vi.fn(),
  },
}));

// Mock the models
vi.mock('@pawtag/db', () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Subscription: {
    findOne: vi.fn(),
  },
  GuardianPointsLedger: {
    find: vi.fn(),
    create: vi.fn(),
  },
  PawRewardsLedger: {
    find: vi.fn(),
    create: vi.fn(),
  },
  GuardianTierHistory: {
    find: vi.fn(),
    create: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../../packages/api/src/middleware/auth', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { id: 'user123', email: 'test@example.com', role: 'customer' };
    next();
  }),
  requireAuth: vi.fn((req, res, next) => {
    req.user = { id: 'user123', email: 'test@example.com', role: 'customer' };
    next();
  }),
}));

// Mock permission middleware
vi.mock('../../packages/api/src/middleware/permission', () => ({
  requirePermission: vi.fn(() => (req, res, next) => next()),
}));

describe('Guardian API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Import and mount the routes
    const guardianRoutes = require('../../packages/api/src/routes/customer-guardian');
    app.use('/api/customer/guardian', guardianRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/customer/guardian/points', () => {
    it('should return user points balance', async () => {
      // Mock user
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({ guardianPoints: 150 }),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/points')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.points).toBe(150);
    });
  });

  describe('GET /api/customer/guardian/rewards', () => {
    it('should return user rewards balance', async () => {
      // Mock user
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({ pawRewardsBalance: 15.50 }),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/rewards')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(15.50);
    });
  });

  describe('GET /api/customer/guardian/tier', () => {
    it('should return user tier information', async () => {
      // Mock user
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({ guardianPoints: 150 }),
      } as any);

      // Mock tier history
      vi.mocked(require('@pawtag/db').GuardianTierHistory.find).mockReturnValue({
        lean: vi.fn().mockReturnValue([]),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/tier')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tier).toBe('NURTURE');
      expect(response.body.data.points).toBe(150);
      expect(response.body.data.pointsToNextTier).toBe(50);
    });
  });

  describe('POST /api/customer/guardian/rewards/redeem', () => {
    it('should redeem rewards successfully', async () => {
      // Mock user
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({ _id: 'user123', pawRewardsBalance: 10 }),
      } as any);

      // Mock ledger creation
      vi.mocked(require('@pawtag/db').PawRewardsLedger.create).mockResolvedValue({} as any);

      // Mock user update
      vi.mocked(require('@pawtag/db').User.findByIdAndUpdate).mockReturnValue({
        lean: vi.fn().mockReturnValue({ pawRewardsBalance: 5 }),
      } as any);

      const response = await request(app)
        .post('/api/customer/guardian/rewards/redeem')
        .send({ amount: 5, orderId: 'order123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amountRedeemed).toBe(5);
      expect(response.body.data.newBalance).toBe(5);
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/api/customer/guardian/rewards/redeem')
        .send({ amount: -5, orderId: 'order123' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid amount');
    });
  });
});
