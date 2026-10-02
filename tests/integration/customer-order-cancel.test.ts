import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, PaymentTransaction } from '@pawtag/db';
import { createCustomer, createCustomerWithRBAC } from './helpers';

const createRefund = vi.fn();
const retrieveRefund = vi.fn();
const listRefundsByPaymentIntent = vi.fn();

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: (...args: any[]) => createRefund(...args),
    retrieveRefund: (...args: any[]) => retrieveRefund(...args),
    listRefundsByPaymentIntent: (...args: any[]) => listRefundsByPaymentIntent(...args),
    isConfigured: () => true,
  },
}));

vi.mock('../../packages/api/src/services/orderNotification.service', () => ({
  notifyCustomerOfStatusChange: vi.fn().mockResolvedValue(undefined),
}));

async function createPaidOrderForUser(
  userId: string,
  overrides: Partial<{
    orderNumber: string;
    stripePaymentIntentId: string;
    paymentStatus: string;
    status: string;
    amount: number;
    cardBrand: string;
    cardLast4: string;
  }> = {},
) {
  const productId = new mongoose.Types.ObjectId();
  const order = await Order.create({
    orderNumber: overrides.orderNumber || `PT-CUST-CANCEL-${Date.now()}`,
    userId,
    items: [{
      productId,
      productName: 'PawTag Test',
      quantity: 1,
      unitPrice: overrides.amount ?? 19.99,
      totalPrice: overrides.amount ?? 19.99,
    }],
    status: overrides.status || 'paid',
    payment: {
      method: 'card',
      status: overrides.paymentStatus || 'completed',
      transactionId: overrides.stripePaymentIntentId || 'pi_customer_cancel_test',
      stripePaymentIntentId: overrides.stripePaymentIntentId || 'pi_customer_cancel_test',
      amount: overrides.amount ?? 19.99,
      currency: 'NZD',
      paidAt: new Date(),
      cardBrand: overrides.cardBrand || 'visa',
      cardLast4: overrides.cardLast4 || '1234',
    },
    shippingAddress: {
      line1: '123 Test St',
      city: 'Auckland',
      state: 'Auckland',
      zip: '1010',
      country: 'NZ',
    },
  });

  await mongoose.connection.collections.products.insertOne({
    _id: productId,
    name: 'PawTag Test',
    sku: `SKU-${productId}`,
    price: overrides.amount ?? 19.99,
    stock: 10,
    reserved: 1,
    productType: 'physical',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return order;
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
  createRefund.mockReset();
  retrieveRefund.mockReset();
  listRefundsByPaymentIntent.mockReset();
  listRefundsByPaymentIntent.mockResolvedValue([]);
});

describe('POST /api/customer/returns/orders/:id/cancel', () => {
  it('cancels a paid order after successful Stripe refund and records initiatedBy=customer', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cancel-ok@example.com' });
    const order = await createPaidOrderForUser(userId);

    createRefund.mockResolvedValue({
      success: true,
      refundId: 're_customer_cancel_ok',
      status: 'succeeded',
      amount: 19.99,
      arn: 'ARN_CUSTOMER_OK',
      expectedArrival: new Date('2026-10-10T00:00:00.000Z'),
    });

    const res = await request(app)
      .post(`/api/customer/returns/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Changed my mind', portal: 'customer-web' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.refundId).toBe('re_customer_cancel_ok');

    const updated = await Order.findById(order._id).lean();
    expect(updated!.status).toBe('cancelled');
    expect(updated!.payment.status).toBe('refunded');
    expect(updated!.refundId).toBe('re_customer_cancel_ok');
    expect(updated!.refundArn).toBe('ARN_CUSTOMER_OK');
    expect(updated!.refundExpectedArrival).toBeTruthy();
    expect(updated!.cancelledBy).toBe('Customer (Test Customer)');
    expect(updated!.cancelledByType).toBe('Customer');
    expect(updated!.cancelledByPortal).toBe('customer-web');

    const cancelActivity = (updated!.activity || []).find((a: any) => a.type === 'cancelled');
    expect(cancelActivity).toBeTruthy();
    expect(cancelActivity!.actor).toBe('customer');
    expect(cancelActivity!.metadata.cancelledBy).toBe('Customer (Test Customer)');

    const txn = await PaymentTransaction.findOne({
      orderId: order._id,
      type: 'refund',
      providerTransactionId: 're_customer_cancel_ok',
    }).lean();
    expect(txn).toBeTruthy();
    expect(txn!.initiatedBy).toBe('customer');
    expect(txn!.status).toBe('succeeded');
    expect(txn!.arn).toBe('ARN_CUSTOMER_OK');
    expect(txn!.cardBrand).toBe('visa');
    expect(txn!.cardLast4).toBe('1234');
    expect(txn!.refundDestination).toBe('Visa ••••1234 (original payment method)');
  });

  it('returns 502 and does not cancel when Stripe refund fails', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cancel-fail@example.com' });
    const order = await createPaidOrderForUser(userId, {
      orderNumber: 'PT-CUST-CANCEL-FAIL',
      stripePaymentIntentId: 'pi_customer_cancel_fail',
    });

    listRefundsByPaymentIntent.mockResolvedValue([]);
    createRefund.mockResolvedValue({
      success: false,
      error: 'Stripe is not configured (no STRIPE_SECRET_KEY)',
    });

const res = await request(app)
      .post(`/api/customer/returns/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Payment issue' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);

    const updated = await Order.findById(order._id).lean();
    expect(updated!.status).toBe('paid');
    expect(updated!.payment.status).toBe('completed');

    const txnCount = await PaymentTransaction.countDocuments({ orderId: order._id });
    expect(txnCount).toBe(0);
  });

  it('reconciles local cancel when Stripe already refunded the charge', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cancel-reconcile@example.com' });
    const order = await createPaidOrderForUser(userId, {
      orderNumber: 'PT-CUST-CANCEL-RECON',
      stripePaymentIntentId: 'pi_customer_cancel_recon',
    });

    listRefundsByPaymentIntent.mockResolvedValue([{
      success: true,
      refundId: 're_already_exists',
      status: 'succeeded',
      amount: 19.99,
    }]);
    createRefund.mockResolvedValue({
      success: false,
      error: 'Charge has been refunded',
    });

    const res = await request(app)
      .post(`/api/customer/returns/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Retry after earlier failure' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.refundId).toBe('re_already_exists');

    // Must not attempt a second Stripe refund after finding an existing one
    expect(createRefund).not.toHaveBeenCalled();

    const updated = await Order.findById(order._id).lean();
    expect(updated!.status).toBe('cancelled');
    expect(updated!.payment.status).toBe('refunded');
    expect(updated!.refundId).toBe('re_already_exists');

    const txn = await PaymentTransaction.findOne({
      providerTransactionId: 're_already_exists',
      type: 'refund',
    }).lean();
    expect(txn).toBeTruthy();
    expect(txn!.initiatedBy).toBe('customer');
  });

  it('rejects cancelling another user order', async () => {
    const owner = await createCustomerWithRBAC({ email: 'cancel-owner@example.com' });
    // Route only requires authentication (not RBAC), so a plain customer token is enough.
    const other = await createCustomer({ email: 'cancel-other@example.com', fullName: 'Other Customer' });
    const order = await createPaidOrderForUser(owner.userId, {
      orderNumber: 'PT-CUST-CANCEL-OWN',
    });

    const res = await request(app)
      .post(`/api/customer/returns/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ reason: 'Not mine' });

    expect(res.status).toBe(403);
  });

  it('rejects cancelling a shipped order', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cancel-shipped@example.com' });
    const order = await createPaidOrderForUser(userId, {
      orderNumber: 'PT-CUST-CANCEL-SHIP',
      status: 'shipped',
    });

    const res = await request(app)
      .post(`/api/customer/returns/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Too late' });

    expect(res.status).toBe(400);
  });
});
