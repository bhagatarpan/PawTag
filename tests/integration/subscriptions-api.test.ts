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

// Mock subscription service
vi.mock('../../packages/api/src/services/subscription.service', () => ({
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  renewSubscription: vi.fn(),
}));

describe('Subscription API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/customer/subscription/create', () => {
    it('should create a subscription', async () => {
      // Mock subscription service
      const mockCreateSubscription = vi.mocked(
        require('../../packages/api/src/services/subscription.service').createSubscription
      );
      
      mockCreateSubscription.mockResolvedValue({
        subscriptionId: 'sub123',
        status: 'active',
        planType: 'annual',
        price: 0.99,
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/customer/subscription/create')
        .send({ planType: 'annual', paymentMethod: 'stripe' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriptionId).toBe('sub123');
      expect(response.body.data.status).toBe('active');
    });

    it('should return 400 for invalid plan type', async () => {
      const response = await request(app)
        .post('/api/customer/subscription/create')
        .send({ planType: 'invalid', paymentMethod: 'stripe' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid plan type');
    });
  });

  describe('POST /api/customer/subscription/cancel', () => {
    it('should cancel a subscription', async () => {
      // Mock subscription service
      const mockCancelSubscription = vi.mocked(
        require('../../packages/api/src/services/subscription.service').cancelSubscription
      );
      
      mockCancelSubscription.mockResolvedValue({
        subscriptionId: 'sub123',
        status: 'cancelled',
        endDate: new Date(),
      });

      const response = await request(app)
        .post('/api/customer/subscription/cancel')
        .send({ reason: 'Too expensive' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('GET /api/customer/subscription/status', () => {
    it('should return subscription status', async () => {
      // Mock user with subscription
      vi.mocked(require('@pawtag/db').User.findById).mockReturnValue({
        lean: vi.fn().mockReturnValue({
          subscription: {
            id: 'sub123',
            status: 'active',
            planType: 'annual',
            price: 0.99,
            startDate: new Date(),
            nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        }),
      } as any);

      const response = await request(app)
        .get('/api/customer/subscription/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.planType).toBe('annual');
    });
  });
});
