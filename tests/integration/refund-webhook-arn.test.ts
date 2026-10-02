import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order } from '@pawtag/db';
import mongoose from 'mongoose';
import { createSuperAdmin } from './helpers';

vi.mock('../../packages/api/src/services/orderNotification.service', () => ({
  notifyRefundUpdate: vi.fn().mockResolvedValue(undefined),
  notifyCustomerOfStatusChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../packages/api/src/commerce/services/refund-retry.service', () => ({
  onRefundFailed: vi.fn().mockResolvedValue(undefined),
  scheduleRefundRetry: vi.fn().mockResolvedValue(undefined),
  cancelRefundRetry: vi.fn().mockResolvedValue(undefined),
  manualRefundRetry: vi.fn(),
  getPendingRetries: vi.fn().mockResolvedValue([]),
}));

import { handleStripeWebhookEvent } from '../../packages/api/src/routes/stripe-webhooks';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Stripe refund webhooks — ARN/arrival persistence', () => {
  it('persists arn and expected arrival on refund.updated', async () => {
    await createSuperAdmin();
    const userId = new mongoose.Types.ObjectId();
    const order = await Order.create({
      orderNumber: 'PT-WH-REFUND-1',
      userId,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
      }],
      status: 'cancelled',
      payment: {
        method: 'card',
        status: 'refunded',
        transactionId: 'pi_wh_refund_1',
        stripePaymentIntentId: 'pi_wh_refund_1',
        amount: 10,
        currency: 'NZD',
        paidAt: new Date(),
        cardBrand: 'visa',
        cardLast4: '9999',
      },
      shippingAddress: {
        line1: '1 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
      refundId: 're_wh_1',
      refundStatus: 'pending',
    });

    await handleStripeWebhookEvent('refund.updated', {
      id: 're_wh_1',
      status: 'succeeded',
      amount: 1000,
      payment_intent: 'pi_wh_refund_1',
      arn: 'ARN_WEBHOOK_1',
      arrival_date: 1760000000,
      failure_reason: null,
    });

    const updated = await Order.findById(order._id).lean();
    expect(updated!.refundStatus).toBe('succeeded');
    expect(updated!.refundArn).toBe('ARN_WEBHOOK_1');
    expect(updated!.refundExpectedArrival).toBeTruthy();
    expect(updated!.refundSettledAt).toBeTruthy();

    const activity = (updated!.activity || []).find((a: any) => a.type === 'refund_succeeded');
    expect(activity).toBeTruthy();
    expect(activity!.message).toContain('ARN_WEBHOOK_1');
    expect(activity!.metadata.arn).toBe('ARN_WEBHOOK_1');
  });
});
