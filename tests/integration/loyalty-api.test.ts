import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

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
    countDocuments: vi.fn(),
  },
  PawRewardsLedger: {
    find: vi.fn(),
    create: vi.fn(),
  },
  GuardianTierHistory: {
    find: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
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

describe('Loyalty API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Import and mount the routes
    const loyaltyRoutes = require('../../packages/api/src/routes/customer-guardian');
    app.use('/api/customer/guardian', loyaltyRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/customer/guardian/points/history', () => {
    it('should return points history', async () => {
      // Mock ledger history
      vi.mocked(require('@pawtag/db').GuardianPointsLedger.find).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue([
              { points: 50, activity: 'purchase', createdAt: new Date() },
              { points: 10, activity: 'review', createdAt: new Date() },
            ]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/points/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(2);
      expect(response.body.data.history[0].points).toBe(50);
    });
  });

  describe('GET /api/customer/guardian/rewards/history', () => {
    it('should return rewards history', async () => {
      // Mock ledger history
      vi.mocked(require('@pawtag/db').PawRewardsLedger.find).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue([
              { amount: 5, type: 'redemption', createdAt: new Date() },
              { amount: 2, type: 'allocation', createdAt: new Date() },
            ]),
          }),
        }),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/rewards/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(2);
      expect(response.body.data.history[0].amount).toBe(5);
    });
  });

  describe('GET /api/customer/guardian/benefits', () => {
    it('should return user benefits', async () => {
      // Mock user
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({ guardianPoints: 150 }),
      } as any);

      // Mock subscription
      vi.mocked(require('@pawtag/db').Subscription.findOne).mockReturnValue({
        lean: vi.fn().mockReturnValue({ planType: 'annual', price: 0.99 }),
      } as any);

      // Mock tier history
      vi.mocked(require('@pawtag/db').GuardianTierHistory.find).mockReturnValue({
        lean: vi.fn().mockReturnValue([]),
      } as any);

      const response = await request(app)
        .get('/api/customer/guardian/benefits')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tier).toBe('NURTURE');
      expect(response.body.data.points).toBe(150);
      expect(response.body.data.benefits).toBeDefined();
    });
  });
});
