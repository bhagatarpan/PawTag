import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

// We test the pure business logic functions from the subscription service
// by mocking Mongoose models

vi.mock('@pawtag/db', () => {
  const mockFind = vi.fn();
  const mockFindById = vi.fn();
  const mockFindByIdAndUpdate = vi.fn();
  const mockFindOne = vi.fn();
  const mockCountDocuments = vi.fn();
  const mockCreate = vi.fn();
  const mockSave = vi.fn();

  const MockModel: any = function (this: any, data: any) {
    Object.assign(this, data);
    this.save = mockSave;
  };
  MockModel.find = mockFind;
  MockModel.findById = mockFindById;
  MockModel.findByIdAndUpdate = mockFindByIdAndUpdate;
  MockModel.findOne = mockFindOne;
  MockModel.countDocuments = mockCountDocuments;
  MockModel.create = mockCreate;

  return {
    Subscription: MockModel,
    Tag: { findByIdAndUpdate: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]) },
    Invoice: { ...MockModel, countDocuments: mockCountDocuments },
    User: MockModel,
    Notification: MockModel,
    Product: MockModel,
  };
});

vi.mock('../services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({ success: true }),
  sendSubscriptionWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createSubscription,
  renewSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
} from '../../packages/api/src/services/subscription.service';

describe('Subscription Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSubscription', () => {
    it('should create an active subscription with correct dates', async () => {
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        tagId: new mongoose.Types.ObjectId(),
        status: 'active',
        planType: 'annual',
        planName: 'PawTag Annual',
        price: 0.99,
        save: vi.fn().mockResolvedValue(true),
      };

      const { Subscription } = await import('@pawtag/db');
      (Subscription.create as any).mockResolvedValue(mockSub);
      (Subscription as any).Tag = { findByIdAndUpdate: vi.fn().mockResolvedValue({}) };

      const result = await createSubscription({
        userId: mockSub.userId.toString(),
        tagId: mockSub.tagId.toString(),
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.planType).toBe('annual');
    });

    it('should create monthly subscription when planType is monthly', async () => {
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        status: 'active',
        planType: 'monthly',
        planName: 'PawTag Monthly',
        price: 1.99,
        save: vi.fn().mockResolvedValue(true),
      };

      const { Subscription } = await import('@pawtag/db');
      (Subscription.create as any).mockResolvedValue(mockSub);

      const result = await createSubscription({
        userId: new mongoose.Types.ObjectId().toString(),
        tagId: new mongoose.Types.ObjectId().toString(),
        planType: 'monthly',
      });

      expect(result.planType).toBe('monthly');
      expect(result.price).toBe(1.99);
    });

    it('should set free period to 12 months from now', async () => {
      const { Subscription } = await import('@pawtag/db');
      let createdData: any;
      (Subscription.create as any).mockImplementation((data: any) => {
        createdData = data;
        return Promise.resolve({ ...data, _id: new mongoose.Types.ObjectId(), save: vi.fn() });
      });

      await createSubscription({
        userId: new mongoose.Types.ObjectId().toString(),
        tagId: new mongoose.Types.ObjectId().toString(),
      });

      const freeEnd = new Date(createdData.freePeriodEndsAt);
      const now = new Date();
      const monthsDiff = (freeEnd.getFullYear() - now.getFullYear()) * 12 + (freeEnd.getMonth() - now.getMonth());
      expect(monthsDiff).toBe(12);
    });

    it('should update tag subscription status to active', async () => {
      const { Subscription, Tag } = await import('@pawtag/db');
      (Subscription.create as any).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        save: vi.fn(),
      });

      await createSubscription({
        userId: new mongoose.Types.ObjectId().toString(),
        tagId: 'tag123',
      });

      expect((Tag as any).findByIdAndUpdate).toHaveBeenCalledWith(
        'tag123',
        expect.objectContaining({ subscriptionStatus: 'active' }),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should set autoRenew to false and cancelledAt', async () => {
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        status: 'active',
        autoRenew: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(mockSub);

      const result = await cancelSubscription(mockSub._id.toString(), 'Too expensive');

      expect(result.autoRenew).toBe(false);
      expect(result.cancelledAt).toBeDefined();
      expect(result.cancellationReason).toBe('Too expensive');
    });

    it('should throw error if subscription not found', async () => {
      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(null);

      await expect(cancelSubscription(new mongoose.Types.ObjectId().toString()))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('changeSubscriptionPlan', () => {
    it('should change plan type and price', async () => {
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        status: 'active',
        planType: 'annual',
        price: 0.99,
        save: vi.fn().mockResolvedValue(true),
      };

      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(mockSub);

      const result = await changeSubscriptionPlan(mockSub._id.toString(), 'monthly');

      expect(result.planType).toBe('monthly');
      expect(result.price).toBe(1.99);
    });

    it('should throw error for non-active subscription', async () => {
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        status: 'expired',
        save: vi.fn(),
      };

      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(mockSub);

      await expect(changeSubscriptionPlan(mockSub._id.toString(), 'monthly'))
        .rejects.toThrow('Can only change plan for active subscriptions');
    });

    it('should throw error if subscription not found', async () => {
      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(null);

      await expect(changeSubscriptionPlan(new mongoose.Types.ObjectId().toString(), 'monthly'))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('renewSubscription', () => {
    it('should extend current period and set status to active', async () => {
      const periodEnd = new Date('2025-06-01');
      const mockSub = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        tagId: new mongoose.Types.ObjectId(),
        status: 'grace_period',
        renewalMethod: 'annual',
        currentPeriodEnd: periodEnd,
        price: 0.99,
        save: vi.fn().mockResolvedValue(true),
        reminderStates: { graceWeeklySentCount: 0 },
      };

      const { Subscription, Tag } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(mockSub);
      (Tag.findByIdAndUpdate as any).mockResolvedValue({});

      const result = await renewSubscription(mockSub._id.toString(), 'card');

      expect(result.status).toBe('active');
      expect(result.lastPaymentDate).toBeDefined();
    });

    it('should throw error if subscription not found', async () => {
      const { Subscription } = await import('@pawtag/db');
      (Subscription.findById as any).mockResolvedValue(null);

      await expect(renewSubscription(new mongoose.Types.ObjectId().toString()))
        .rejects.toThrow('Subscription not found');
    });
  });
});
