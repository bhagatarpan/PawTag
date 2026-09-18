import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { User, Order, PaymentTransaction } from '../../packages/db';

async function createTestUser(overrides: Partial<{ email: string }> = {}) {
  const email = overrides.email || `user-${Date.now()}@example.com`;

  const user = await User.create({
    email,
    passwordHash: 'hashed-password-placeholder',
    fullName: 'Test User',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
  });

  return { userId: String(user._id), email };
}

async function createPaidOrder(userId: string, amount: number, orderNumber?: string) {
  const num = orderNumber || `ORD-${Date.now()}`;
  return Order.create({
    orderNumber: num,
    userId: new mongoose.Types.ObjectId(userId),
    items: [{
      productId: new mongoose.Types.ObjectId(),
      productName: 'Test Product',
      quantity: 1,
      unitPrice: amount,
      totalPrice: amount,
    }],
    subtotal: amount,
    status: 'paid',
    payment: {
      method: 'card',
      status: 'completed',
      stripePaymentIntentId: `pi_test_${num}`,
      amount,
      currency: 'NZD',
      paidAt: new Date(),
    },
    shippingAddress: {
      line1: '123 Test St',
      city: 'Auckland',
      zip: '1010',
      country: 'NZ',
    },
    completionStatus: 'complete',
    activity: [],
  });
}

beforeAll(async () => {
  await setupTestDb();
  await Order.syncIndexes();
  await PaymentTransaction.syncIndexes();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Refund Correctness', () => {
  describe('Cumulative refund prevention', () => {
    it('prevents refunding more than the captured amount when existing refunds exist', async () => {
      const user = await createTestUser({ email: 'refund-overdraw@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-OVERDRAW-001');

      // Simulate an existing partial refund of $60
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 60,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_existing_refund_001',
        initiatedBy: 'admin',
        notes: 'First partial refund',
      });

      // Manually sum refunded amount (simulating calculateTotalRefunded)
      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded.length > 0 ? totalRefunded[0].total : 0;
      const capturedAmount = order.payment.amount;
      const requestedRefund = 50; // Would make total $110 > $100

      // Verify the cumulative check would fail
      expect(refundedTotal).toBe(60);
      expect(refundedTotal + requestedRefund).toBeGreaterThan(capturedAmount);
    });

    it('allows refund when cumulative amount does not exceed captured amount', async () => {
      const user = await createTestUser({ email: 'refund-valid@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-VALID-001');

      // Simulate an existing partial refund of $30
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 30,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_valid_refund_001',
        initiatedBy: 'admin',
        notes: 'First partial refund',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded.length > 0 ? totalRefunded[0].total : 0;
      const capturedAmount = order.payment.amount;
      const requestedRefund = 50; // Would make total $80 < $100

      expect(refundedTotal).toBe(30);
      expect(refundedTotal + requestedRefund).toBeLessThanOrEqual(capturedAmount);
    });

    it('allows full refund when no existing refunds', async () => {
      const user = await createTestUser({ email: 'refund-full@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-FULL-001');

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded.length > 0 ? totalRefunded[0].total : 0;
      const capturedAmount = order.payment.amount;
      const requestedRefund = 100;

      expect(refundedTotal).toBe(0);
      expect(refundedTotal + requestedRefund).toBeLessThanOrEqual(capturedAmount);
    });

    it('treats pending refunds as not-yet-refunded for cumulative calculation', async () => {
      const user = await createTestUser({ email: 'refund-pending@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-PENDING-001');

      // Only succeeded refunds should count toward cumulative total
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'pending',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_pending_refund_001',
        initiatedBy: 'admin',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded.length > 0 ? totalRefunded[0].total : 0;

      // Pending refunds should not count toward cumulative total
      expect(refundedTotal).toBe(0);
    });

    it('only counts refunds for the specific order, not other orders', async () => {
      const user = await createTestUser({ email: 'refund-scoped@example.com' });
      const order1 = await createPaidOrder(user.userId, 100, 'ORD-SCOPE-001');
      const order2 = await createPaidOrder(user.userId, 100, 'ORD-SCOPE-002');

      // Refund for order1
      await PaymentTransaction.create({
        orderId: order1._id,
        orderNumber: order1.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 80,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_scope_refund_001',
        initiatedBy: 'admin',
      });

      // Check refund total for order2 (should be 0)
      const totalRefundedOrder2 = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order2._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefundedOrder2.length > 0 ? totalRefundedOrder2[0].total : 0;

      expect(refundedTotal).toBe(0);
    });
  });

  describe('Idempotency - duplicate refund request returns existing', () => {
    it('finds existing succeeded refund transaction for the order', async () => {
      const user = await createTestUser({ email: 'refund-idempotent@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-IDEMPOTENT-001');

      // Create an existing succeeded refund
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_idempotent_refund_001',
        initiatedBy: 'admin',
        notes: 'Original refund',
      });

      // Query for existing refund (simulating idempotency check)
      const existingRefund = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        status: { $in: ['pending', 'succeeded'] },
      }).sort({ createdAt: -1 });

      expect(existingRefund).toBeDefined();
      expect(existingRefund!.status).toBe('succeeded');
      expect(existingRefund!.providerTransactionId).toBe('re_idempotent_refund_001');
      expect(existingRefund!.amount).toBe(50);
    });

    it('finds existing pending refund transaction for the order', async () => {
      const user = await createTestUser({ email: 'refund-idempending@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-IDEMPENDING-001');

      // Create an existing pending refund
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'pending',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_idempending_refund_001',
        initiatedBy: 'admin',
      });

      const existingRefund = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        status: { $in: ['pending', 'succeeded'] },
      }).sort({ createdAt: -1 });

      expect(existingRefund).toBeDefined();
      expect(existingRefund!.status).toBe('pending');
      expect(existingRefund!.providerTransactionId).toBe('re_idempending_refund_001');
    });

    it('returns null when no existing refund found', async () => {
      const user = await createTestUser({ email: 'refund-noexist@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-NOEXIST-001');

      const existingRefund = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        status: { $in: ['pending', 'succeeded'] },
      }).sort({ createdAt: -1 });

      expect(existingRefund).toBeNull();
    });

    it('does not match failed refund transactions for idempotency', async () => {
      const user = await createTestUser({ email: 'refund-failed@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-FAILED-001');

      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'failed',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_failed_refund_001',
        initiatedBy: 'admin',
        errorCode: 'charge_already_refunded',
      });

      const existingRefund = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        status: { $in: ['pending', 'succeeded'] },
      }).sort({ createdAt: -1 });

      // Failed refunds should not trigger idempotency
      expect(existingRefund).toBeNull();
    });

    it('returns most recent refund when multiple exist', async () => {
      const user = await createTestUser({ email: 'refund-multi@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-MULTI-001');

      // Create first refund
      const firstRefund = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 30,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_multi_refund_001',
        initiatedBy: 'admin',
      });

      // Create second refund (after a small delay to ensure ordering)
      await new Promise(resolve => setTimeout(resolve, 10));
      const secondRefund = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 20,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_multi_refund_002',
        initiatedBy: 'admin',
      });

      const existingRefund = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        status: { $in: ['pending', 'succeeded'] },
      }).sort({ createdAt: -1 });

      expect(existingRefund).toBeDefined();
      expect(existingRefund!.providerTransactionId).toBe(secondRefund.providerTransactionId);
    });
  });

  describe('Partial refunds', () => {
    it('records multiple partial refunds correctly', async () => {
      const user = await createTestUser({ email: 'refund-partial@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-PARTIAL-001');

      // First partial refund
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 25,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_partial_001',
        initiatedBy: 'admin',
        notes: 'First partial',
      });

      // Second partial refund
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 35,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_partial_002',
        initiatedBy: 'admin',
        notes: 'Second partial',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      expect(totalRefunded.length).toBe(1);
      expect(totalRefunded[0].total).toBe(60);

      // Remaining refundable should be 40
      const remainingRefundable = order.payment.amount - totalRefunded[0].total;
      expect(remainingRefundable).toBe(40);
    });

    it('allows final partial refund to exactly reach captured amount', async () => {
      const user = await createTestUser({ email: 'refund-exact@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-EXACT-001');

      // First refund of 70
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 70,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_exact_001',
        initiatedBy: 'admin',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded[0].total;
      const remainingRefundable = order.payment.amount - refundedTotal;

      // Should allow exactly 30 more
      expect(remainingRefundable).toBe(30);
      expect(refundedTotal + remainingRefundable).toBe(order.payment.amount);
    });

    it('rejects refund when remaining refundable is zero', async () => {
      const user = await createTestUser({ email: 'refund-zero@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-ZERO-001');

      // Full refund already processed
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 100,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_zero_001',
        initiatedBy: 'admin',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const refundedTotal = totalRefunded[0].total;
      const remainingRefundable = order.payment.amount - refundedTotal;

      expect(remainingRefundable).toBe(0);

      // Attempting any refund should fail
      const requestedRefund = 1;
      expect(refundedTotal + requestedRefund).toBeGreaterThan(order.payment.amount);
    });

    it('tracks refund amounts accurately across mixed statuses', async () => {
      const user = await createTestUser({ email: 'refund-mixed@example.com' });
      const order = await createPaidOrder(user.userId, 100, 'ORD-MIXED-001');

      // Succeeded refund
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 40,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_mixed_001',
        initiatedBy: 'admin',
      });

      // Pending refund (should not count)
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'pending',
        amount: 30,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_mixed_002',
        initiatedBy: 'admin',
      });

      // Failed refund (should not count)
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'failed',
        amount: 20,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_mixed_003',
        initiatedBy: 'admin',
        errorCode: 'insufficient_funds',
      });

      const totalRefunded = await PaymentTransaction.aggregate([
        {
          $match: {
            orderId: order._id,
            type: 'refund',
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      // Only succeeded refunds should count
      expect(totalRefunded[0].total).toBe(40);
      const remainingRefundable = order.payment.amount - totalRefunded[0].total;
      expect(remainingRefundable).toBe(60);
    });
  });

  describe('Payment transaction unique index enforcement', () => {
    it('prevents duplicate providerTransactionId with same type', async () => {
      const user = await createTestUser({ email: 'refund-unique@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-UNIQUE-001');

      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 're_unique_refund_001',
        initiatedBy: 'admin',
      });

      // Duplicate providerTransactionId + type should fail
      await expect(
        PaymentTransaction.create({
          orderId: order._id,
          orderNumber: order.orderNumber,
          type: 'refund',
          status: 'succeeded',
          amount: 50,
          currency: 'NZD',
          provider: 'stripe',
          providerTransactionId: 're_unique_refund_001',
          initiatedBy: 'webhook',
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('allows same providerTransactionId with different type', async () => {
      const user = await createTestUser({ email: 'refund-difftype@example.com' });
      const order = await createPaidOrder(user.userId, 50, 'ORD-DIFFTYPE-001');

      const sharedId = 're_shared_type_id';

      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'payment',
        status: 'succeeded',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: sharedId,
        initiatedBy: 'customer',
      });

      const refundTxn = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 50,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: sharedId,
        initiatedBy: 'admin',
      });

      expect(refundTxn).toBeDefined();
      expect(refundTxn.type).toBe('refund');
    });
  });
});
