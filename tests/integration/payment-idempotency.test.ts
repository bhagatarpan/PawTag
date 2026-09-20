import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { User, Order, PaymentTransaction, Invoice } from '@pawtag/db';

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

beforeAll(async () => {
  await setupTestDb();
  // Ensure unique indexes are created in the test database
  await Order.syncIndexes();
  await PaymentTransaction.syncIndexes();
  await Invoice.syncIndexes();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Payment Idempotency', () => {
  describe('Duplicate PaymentIntent cannot create duplicate orders', () => {
    it('inserting two orders with the same stripePaymentIntentId fails at database level', async () => {
      const user = await createTestUser({ email: 'idempotency-test@example.com' });
      const paymentIntentId = 'pi_duplicate_test_123';

      await Order.create({
        orderNumber: 'ORD-000001',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: paymentIntentId,
          amount: 39.00,
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

      await expect(
        Order.create({
          orderNumber: 'ORD-000002',
          userId: new mongoose.Types.ObjectId(user.userId),
          items: [{
            productId: new mongoose.Types.ObjectId(),
            productName: 'Test Product 2',
            quantity: 1,
            unitPrice: 49.00,
            totalPrice: 49.00,
          }],
          subtotal: 49.00,
          status: 'paid',
          payment: {
            method: 'card',
            status: 'completed',
            stripePaymentIntentId: paymentIntentId,
            amount: 49.00,
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
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('orders with different stripePaymentIntentIds can coexist', async () => {
      const user = await createTestUser({ email: 'idempotency-diff@example.com' });

      await Order.create({
        orderNumber: 'ORD-000003',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_unique_111',
          amount: 39.00,
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

      const secondOrder = await Order.create({
        orderNumber: 'ORD-000004',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product 2',
          quantity: 1,
          unitPrice: 49.00,
          totalPrice: 49.00,
        }],
        subtotal: 49.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_unique_222',
          amount: 49.00,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '456 Test Ave',
          city: 'Wellington',
          zip: '6011',
          country: 'NZ',
        },
        completionStatus: 'complete',
        activity: [],
      });

      expect(secondOrder).toBeDefined();
      expect(secondOrder.payment.stripePaymentIntentId).toBe('pi_unique_222');
    });

    it('orders without stripePaymentIntentId are not affected by the unique index', async () => {
      const user = await createTestUser({ email: 'idempotency-nopi@example.com' });

      const order1 = await Order.create({
        orderNumber: 'ORD-000005',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'pending',
        payment: {
          method: 'card',
          status: 'pending',
          amount: 39.00,
          currency: 'NZD',
        },
        shippingAddress: {
          line1: '123 Test St',
          city: 'Auckland',
          zip: '1010',
          country: 'NZ',
        },
        completionStatus: 'pending',
        activity: [],
      });

      const order2 = await Order.create({
        orderNumber: 'ORD-000006',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product 2',
          quantity: 1,
          unitPrice: 49.00,
          totalPrice: 49.00,
        }],
        subtotal: 49.00,
        status: 'pending',
        payment: {
          method: 'card',
          status: 'pending',
          amount: 49.00,
          currency: 'NZD',
        },
        shippingAddress: {
          line1: '456 Test Ave',
          city: 'Wellington',
          zip: '6011',
          country: 'NZ',
        },
        completionStatus: 'pending',
        activity: [],
      });

      expect(order1).toBeDefined();
      expect(order2).toBeDefined();
    });
  });

  describe('Duplicate refund transactions are prevented', () => {
    it('inserting two refund transactions with the same providerTransactionId and type fails', async () => {
      const user = await createTestUser({ email: 'refund-dup@example.com' });

      const order = await Order.create({
        orderNumber: 'ORD-REFUND-001',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_refund_test',
          amount: 39.00,
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

      const refundTransactionId = 're_duplicate_refund_123';

      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 39.00,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: refundTransactionId,
        initiatedBy: 'admin',
      });

      await expect(
        PaymentTransaction.create({
          orderId: order._id,
          orderNumber: order.orderNumber,
          type: 'refund',
          status: 'succeeded',
          amount: 39.00,
          currency: 'NZD',
          provider: 'stripe',
          providerTransactionId: refundTransactionId,
          initiatedBy: 'webhook',
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('transactions with same providerTransactionId but different type can coexist', async () => {
      const user = await createTestUser({ email: 'refund-difftype@example.com' });

      const order = await Order.create({
        orderNumber: 'ORD-REFUND-002',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_refund_test2',
          amount: 39.00,
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

      const sharedTransactionId = 're_shared_id_123';

      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'payment',
        status: 'succeeded',
        amount: 39.00,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: sharedTransactionId,
        initiatedBy: 'customer',
      });

      const refundTxn = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 39.00,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: sharedTransactionId,
        initiatedBy: 'admin',
      });

      expect(refundTxn).toBeDefined();
      expect(refundTxn.type).toBe('refund');
    });

    it('transactions without providerTransactionId are not affected', async () => {
      const user = await createTestUser({ email: 'refund-noprov@example.com' });

      const order = await Order.create({
        orderNumber: 'ORD-REFUND-003',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_noprov_test',
          amount: 39.00,
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

      const txn1 = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'payment',
        status: 'succeeded',
        amount: 39.00,
        currency: 'NZD',
        provider: 'stripe',
        initiatedBy: 'customer',
      });

      const txn2 = await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: 'refund',
        status: 'succeeded',
        amount: 39.00,
        currency: 'NZD',
        provider: 'stripe',
        initiatedBy: 'admin',
      });

      expect(txn1).toBeDefined();
      expect(txn2).toBeDefined();
    });
  });

  describe('Invoice idempotency works', () => {
    it('inserting two invoices with the same stripeInvoiceId fails at database level', async () => {
      const user = await createTestUser({ email: 'invoice-dup@example.com' });

      const order = await Order.create({
        orderNumber: 'ORD-INV-001',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_invoice_test',
          amount: 39.00,
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

      const stripeInvoiceId = 'in_duplicate_invoice_123';

      await Invoice.create({
        orderId: order._id,
        userId: new mongoose.Types.ObjectId(user.userId),
        invoiceNumber: 'INV-000001',
        amount: 39.00,
        currency: 'NZD',
        status: 'paid',
        stripeInvoiceId,
        paidAt: new Date(),
      });

      await expect(
        Invoice.create({
          orderId: order._id,
          userId: new mongoose.Types.ObjectId(user.userId),
          invoiceNumber: 'INV-000002',
          amount: 49.00,
          currency: 'NZD',
          status: 'paid',
          stripeInvoiceId,
          paidAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('invoices with different stripeInvoiceIds can coexist', async () => {
      const user = await createTestUser({ email: 'invoice-diff@example.com' });

      const order = await Order.create({
        orderNumber: 'ORD-INV-002',
        userId: new mongoose.Types.ObjectId(user.userId),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 39.00,
          totalPrice: 39.00,
        }],
        subtotal: 39.00,
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          stripePaymentIntentId: 'pi_invoice_diff',
          amount: 39.00,
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

      await Invoice.create({
        orderId: order._id,
        userId: new mongoose.Types.ObjectId(user.userId),
        invoiceNumber: 'INV-000003',
        amount: 39.00,
        currency: 'NZD',
        status: 'paid',
        stripeInvoiceId: 'in_unique_111',
        paidAt: new Date(),
      });

      const secondInvoice = await Invoice.create({
        orderId: order._id,
        userId: new mongoose.Types.ObjectId(user.userId),
        invoiceNumber: 'INV-000004',
        amount: 49.00,
        currency: 'NZD',
        status: 'paid',
        stripeInvoiceId: 'in_unique_222',
        paidAt: new Date(),
      });

      expect(secondInvoice).toBeDefined();
      expect(secondInvoice.stripeInvoiceId).toBe('in_unique_222');
    });

    it('invoices without stripeInvoiceId are not affected by the unique index', async () => {
      const user = await createTestUser({ email: 'invoice-nosti@example.com' });

      const inv1 = await Invoice.create({
        userId: new mongoose.Types.ObjectId(user.userId),
        invoiceNumber: 'INV-000005',
        amount: 39.00,
        currency: 'NZD',
        status: 'pending',
        paidAt: new Date(),
      });

      const inv2 = await Invoice.create({
        userId: new mongoose.Types.ObjectId(user.userId),
        invoiceNumber: 'INV-000006',
        amount: 49.00,
        currency: 'NZD',
        status: 'pending',
        paidAt: new Date(),
      });

      expect(inv1).toBeDefined();
      expect(inv2).toBeDefined();
    });
  });
});
