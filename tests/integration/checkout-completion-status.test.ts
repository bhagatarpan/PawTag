import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { Order } from '../../packages/db/src/models/Order';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// COMPLETION STATUS TRACKING
// ═══════════════════════════════════════════

describe('Integration: Order Completion Status', () => {
  it('new order has completionStatus "pending"', async () => {
    const order = await Order.create({
      orderNumber: 'PT-TEST-001',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'pending',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 0,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        zip: '1010',
      },
    });

    expect(order.completionStatus).toBe('pending');
  });

  it('order can be updated to completionStatus "complete"', async () => {
    const order = await Order.create({
      orderNumber: 'PT-TEST-002',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'pending',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 0,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        zip: '1010',
      },
    });

    await Order.findByIdAndUpdate(order._id, { completionStatus: 'complete' });
    const updated = await Order.findById(order._id);
    expect(updated?.completionStatus).toBe('complete');
  });

  it('order can be updated to completionStatus "repair_required" with errors', async () => {
    const order = await Order.create({
      orderNumber: 'PT-TEST-003',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'pending',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 0,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        zip: '1010',
      },
    });

    const errors = [
      { step: 'tag_subscription_creation', error: 'Database connection timeout', timestamp: new Date() },
    ];

    await Order.findByIdAndUpdate(order._id, {
      completionStatus: 'repair_required',
      completionErrors: errors,
    });

    const updated = await Order.findById(order._id);
    expect(updated?.completionStatus).toBe('repair_required');
    expect(updated?.completionErrors).toHaveLength(1);
    expect(updated?.completionErrors?.[0].step).toBe('tag_subscription_creation');
  });

  it('repair_required orders are queryable for reconciliation', async () => {
    const userId = new mongoose.Types.ObjectId();

    // Create multiple orders with different statuses
    await Order.create({
      orderNumber: 'PT-COMPLETE-001',
      userId,
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'complete',
      payment: { method: 'card', status: 'completed', amount: 0, currency: 'NZD' },
      shippingAddress: { line1: '123 Test St', city: 'Auckland', zip: '1010' },
    });

    await Order.create({
      orderNumber: 'PT-REPAIR-001',
      userId,
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'repair_required',
      completionErrors: [
        { step: 'tag_subscription_creation', error: 'Service unavailable', timestamp: new Date() },
      ],
      payment: { method: 'card', status: 'completed', amount: 0, currency: 'NZD' },
      shippingAddress: { line1: '123 Test St', city: 'Auckland', zip: '1010' },
    });

    await Order.create({
      orderNumber: 'PT-REPAIR-002',
      userId,
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'repair_required',
      completionErrors: [
        { step: 'invoice_creation', error: 'Counter not found', timestamp: new Date() },
      ],
      payment: { method: 'card', status: 'completed', amount: 0, currency: 'NZD' },
      shippingAddress: { line1: '123 Test St', city: 'Auckland', zip: '1010' },
    });

    // Query for repair_required orders
    const repairOrders = await Order.find({ completionStatus: 'repair_required' });
    expect(repairOrders).toHaveLength(2);
    expect(repairOrders.map(o => o.orderNumber)).toContain('PT-REPAIR-001');
    expect(repairOrders.map(o => o.orderNumber)).toContain('PT-REPAIR-002');
  });

  it('correlation ID is preserved across completion steps', async () => {
    const correlationId = 'test-correlation-123';
    const order = await Order.create({
      orderNumber: 'PT-CORR-001',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      subtotal: 0,
      status: 'paid',
      completionStatus: 'pending',
      completionCorrelationId: correlationId,
      payment: { method: 'card', status: 'completed', amount: 0, currency: 'NZD' },
      shippingAddress: { line1: '123 Test St', city: 'Auckland', zip: '1010' },
    });

    // Simulate adding error with correlation ID preserved
    await Order.findByIdAndUpdate(order._id, {
      completionStatus: 'repair_required',
      completionErrors: [
        { step: 'inventory_confirmation', error: 'Stock unavailable', timestamp: new Date() },
      ],
    });

    const updated = await Order.findById(order._id);
    expect(updated?.completionCorrelationId).toBe(correlationId);
    expect(updated?.completionStatus).toBe('repair_required');
  });
});
