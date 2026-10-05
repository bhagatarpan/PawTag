import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';
import { createCustomer, createCustomerWithRBAC } from './helpers';
import { CUSTOMER_INVOICE_LIST_PAGE_SIZE } from '@pawtag/shared';

let userId: string;
let otherUserId: string;
let token: string;
let otherToken: string;

beforeAll(async () => {
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();

  const customer = await createCustomerWithRBAC({
    email: 'invoices-portal@example.com',
    fullName: 'Invoice Portal',
  });
  userId = customer.userId;
  token = customer.token;

  const other = await createCustomer({
    email: 'invoices-other@example.com',
    fullName: 'Other Customer',
  });
  otherUserId = other.userId;
  otherToken = other.token;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await mongoose.connection.collections.invoices?.deleteMany({});
});

async function insertInvoice(opts?: {
  userId?: string;
  type?: string;
  invoiceNumber?: string;
  amount?: number;
  status?: string;
}) {
  return mongoose.connection.collections.invoices.insertOne({
    userId: new mongoose.Types.ObjectId(opts?.userId || userId),
    invoiceNumber: opts?.invoiceNumber || `INV-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    type: opts?.type || 'invoice',
    amount: opts?.amount ?? 89,
    currency: 'NZD',
    status: opts?.status || 'paid',
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('Customer invoices portal API', () => {
  it('lists only the authenticated user invoices', async () => {
    await insertInvoice({ invoiceNumber: 'INV-MINE-1', amount: 89 });
    await insertInvoice({ invoiceNumber: 'INV-MINE-CN', type: 'credit_note', amount: 10 });
    await insertInvoice({ userId: otherUserId, invoiceNumber: 'INV-THEIRS-1' });

    const res = await request(app)
      .get('/api/customer/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data.data;
    expect(data).toHaveLength(2);
    const numbers = data.map((i: any) => i.invoiceNumber);
    expect(numbers).toContain('INV-MINE-1');
    expect(numbers).toContain('INV-MINE-CN');
    expect(data.some((i: any) => i.type === 'credit_note')).toBe(true);
    expect(res.body.data.pageSize).toBe(CUSTOMER_INVOICE_LIST_PAGE_SIZE);
  });

  it('returns invoice detail for owner only', async () => {
    const inv = await insertInvoice({ invoiceNumber: 'INV-DETAIL-1' });

    const ok = await request(app)
      .get(`/api/customer/invoices/${inv.insertedId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.invoiceNumber).toBe('INV-DETAIL-1');

    const denied = await request(app)
      .get(`/api/customer/invoices/${inv.insertedId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(denied.status).toBe(404);
  });

  it('detail includes related order/membership/subscription projections when present', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const membershipId = new mongoose.Types.ObjectId();
    const subscriptionId = new mongoose.Types.ObjectId();
    const tierId = new mongoose.Types.ObjectId();

    await mongoose.connection.collections.orders.insertOne({
      _id: orderId,
      orderNumber: 'WO-INV-1',
      userId: new mongoose.Types.ObjectId(userId),
      status: 'delivered',
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Classic',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
          tagId: 'PT-TEST1',
        },
      ],
      subtotal: 29.99,
      shippingCost: 0,
      tax: 4.35,
      discount: { percent: 0, amount: 0, reason: '' },
      payment: { method: 'card', status: 'completed', amount: 34.34, currency: 'NZD', cardBrand: 'visa', cardLast4: '4242' },
      shippingAddress: { line1: '1 Test St', city: 'Auckland', country: 'NZ' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mongoose.connection.collections.membershiptiers.insertOne({
      _id: tierId,
      tier: 'gold',
      name: 'Gold',
      displayName: 'Gold',
      price: 89,
      currency: 'NZD',
      isActive: true,
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mongoose.connection.collections.usermemberships.insertOne({
      _id: membershipId,
      userId: new mongoose.Types.ObjectId(userId),
      tierId,
      status: 'active',
      billingCycle: 'annual',
      price: 89,
      currency: 'NZD',
      startDate: new Date('2026-10-05'),
      currentPeriodStart: new Date('2026-10-05'),
      currentPeriodEnd: new Date('2027-10-05'),
      autoRenew: true,
      cardBrand: 'visa',
      cardLast4: '4242',
      adminExtensionGraceUsed: false,
      adminExtensionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mongoose.connection.collections.subscriptions.insertOne({
      _id: subscriptionId,
      userId: new mongoose.Types.ObjectId(userId),
      tagId: new mongoose.Types.ObjectId(),
      planName: 'PawTag Classic',
      planType: 'gold',
      status: 'active',
      price: 3.99,
      renewalMethod: 'monthly',
      startDate: new Date('2026-10-05'),
      currentPeriodStart: new Date('2026-10-05'),
      currentPeriodEnd: new Date('2026-11-05'),
      autoRenew: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const inv = await insertInvoice({
      invoiceNumber: 'INV-ENRICHED-1',
      amount: 34.34,
    });
    await mongoose.connection.collections.invoices.updateOne(
      { _id: inv.insertedId },
      {
        $set: {
          orderId,
          userMembershipId: membershipId,
          subscriptionId,
          paymentMethod: 'card',
          billingPeriod: { start: new Date('2026-10-05'), end: new Date('2027-10-05') },
        },
      },
    );

    const res = await request(app)
      .get(`/api/customer/invoices/${inv.insertedId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.order.orderNumber).toBe('WO-INV-1');
    expect(data.order.items[0].productName).toBe('PawTag Classic');
    expect(data.order.cardLast4).toBe('4242');
    expect(data.membership.tierName).toBe('Gold');
    expect(data.membership.cardLast4).toBe('4242');
    expect(data.subscription.planName).toBe('PawTag Classic');
    expect(data.paymentMethod).toBe('card');
    // Must not leak admin/internal fields
    expect(data.stripeCustomerId).toBeUndefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/customer/invoices');
    expect(res.status).toBe(401);
  });
});
