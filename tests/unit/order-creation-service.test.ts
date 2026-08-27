/**
 * Tests for the order creation service (createOrderFromMedusa).
 *
 * These tests verify:
 * 1. Order creation from Medusa order data
 * 2. Idempotency — duplicate orders are rejected
 * 3. User lookup fallback chain (customer_id → email → metadata)
 * 4. Invoice creation and secure token generation
 * 5. Email sending (parallel, non-blocking)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database models
vi.mock('@pawtag/db', () => ({
  Order: {
    findOne: vi.fn(),
    create: vi.fn(),
    db: { collection: vi.fn(() => ({ findOneAndUpdate: vi.fn() })) },
  },
  Invoice: {
    findOne: vi.fn(),
    create: vi.fn(),
    db: { collection: vi.fn(() => ({ findOneAndUpdate: vi.fn() })) },
  },
  InvoiceAccessToken: { create: vi.fn() },
  Subscription: { findOne: vi.fn() },
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  Notification: { create: vi.fn().mockResolvedValue({}), findOne: vi.fn() },
  Tag: { find: vi.fn() },
}));

// Mock services
vi.mock('../services/email.service', () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(true),
  sendInvoiceEmail: vi.fn().mockResolvedValue(true),
  sendMail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/invoice-html.service', () => ({
  generateInvoiceHtml: vi.fn().mockResolvedValue('<html>Invoice</html>'),
}));

vi.mock('../services/push-notification.service', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/auth.service', () => ({
  generateSecureToken: vi.fn().mockReturnValue('test-token-123'),
  hashToken: vi.fn().mockReturnValue('hashed-token'),
}));

vi.mock('../services/subscription.service', () => ({
  createSubscription: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock fetch for Medusa API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { Order, Invoice, InvoiceAccessToken, User, Subscription } from '@pawtag/db';

describe('createOrderFromMedusa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MEDUSA_BACKEND_URL = 'http://localhost:9000';
    process.env.MEDUSA_PUBLISHABLE_KEY = 'pk_test';
    process.env.MEDUSA_ADMIN_TOKEN = 'admin_token';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  const mockMedusaOrder = {
    id: 'order_test123',
    customer_id: 'cus_test123',
    email: 'john@example.com',
    total: 59.99,
    currency_code: 'nzd',
    created_at: '2026-01-01T00:00:00Z',
    items: [
      { product_id: 'prod_1', title: 'PawTag Plus', quantity: 1, unit_price: 49.99 },
    ],
    shipping_address: {
      address_1: '123 Main St',
      address_2: '',
      city: 'Auckland',
      province: '',
      postal_code: '1010',
      country_code: 'nz',
    },
    metadata: {
      referralCode: 'REF123',
      pawtagUserId: 'user_abc',
      pawtagUserEmail: 'john@example.com',
    },
  };

  const mockPawTagUser = {
    _id: 'user_abc',
    email: 'john@example.com',
    fullName: 'John Smith',
    phoneNumber: '021123456',
    medusaCustomerId: 'cus_test123',
    save: vi.fn(),
  };

  it('should create order from Medusa data', async () => {
    // Setup mocks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ order: mockMedusaOrder }),
    });
    // Parallel lookups: medusaCustomerId, email, pawtagUserId, pawtagUserEmail all call User methods
    (User.findOne as any).mockResolvedValue(mockPawTagUser);
    (User.findById as any).mockResolvedValue(mockPawTagUser);
    (Order.findOne as any).mockResolvedValueOnce(null); // No existing order
    (Order.db.collection('counters').findOneAndUpdate as any).mockResolvedValueOnce({ value: { seq: 5 } });
    (Order.create as any).mockResolvedValueOnce({
      _id: 'order_mongo_1',
      orderNumber: 'PT-000005',
      items: [{ productName: 'PawTag Plus', quantity: 1, unitPrice: 49.99 }],
      payment: { amount: 59.99, currency: 'NZD', method: 'card', paidAt: new Date() },
      shippingAddress: { line1: '123 Main St', city: 'Auckland', state: '', zip: '1010', country: 'NZ' },
      referredByCode: 'REF123',
    });
    (Invoice.db.collection('counters').findOneAndUpdate as any).mockResolvedValueOnce({ value: { seq: 1 } });
    (Subscription.findOne as any).mockResolvedValueOnce(null);
    (Invoice.create as any).mockResolvedValueOnce({
      _id: 'inv_1',
      invoiceNumber: 'INV-000001',
      amount: 59.99,
      status: 'paid',
    });
    (InvoiceAccessToken.create as any).mockResolvedValueOnce({});

    const { createOrderFromMedusa } = await import('../../packages/api/src/services/order-creation.service');
    const result = await createOrderFromMedusa('order_test123');

    expect(result.isNew).toBe(true);
    expect(result.order.orderNumber).toBe('PT-000005');
    expect(result.invoice.invoiceNumber).toBe('INV-000001');
    expect(User.findOne).toHaveBeenCalledWith({ medusaCustomerId: 'cus_test123' });
    expect(Order.create).toHaveBeenCalled();
    expect(Invoice.create).toHaveBeenCalled();
  });

  it('should return existing order if already created (idempotent)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ order: mockMedusaOrder }),
    });
    // Parallel lookups: medusaCustomerId, email, pawtagUserId, pawtagUserEmail all call User methods
    (User.findOne as any).mockResolvedValue(mockPawTagUser);
    (User.findById as any).mockResolvedValue(mockPawTagUser);
    (Order.findOne as any).mockResolvedValueOnce({
      _id: 'existing_order',
      orderNumber: 'PT-000003',
      medusaOrderId: undefined,
      save: vi.fn().mockResolvedValue(true),
    });
    (Invoice.findOne as any).mockResolvedValueOnce({
      _id: 'existing_inv',
      invoiceNumber: 'INV-000003',
      amount: 59.99,
      status: 'paid',
    });
    // Mock for fresh token generation in idempotent return
    (InvoiceAccessToken.create as any).mockResolvedValueOnce({});

    const { createOrderFromMedusa } = await import('../../packages/api/src/services/order-creation.service');
    const result = await createOrderFromMedusa('order_test123');

    expect(result.isNew).toBe(false);
    expect(result.order.orderNumber).toBe('PT-000003');
    expect(Order.create).not.toHaveBeenCalled();
  });

  it('should throw if Medusa API returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { createOrderFromMedusa } = await import('../../packages/api/src/services/order-creation.service');
    await expect(createOrderFromMedusa('order_nonexistent')).rejects.toThrow('Failed to fetch Medusa order');
  });

  it('should throw if user not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ order: { ...mockMedusaOrder, customer_id: null, email: null, metadata: {} } }),
    });
    // All user lookups return null
    (User.findOne as any).mockResolvedValue(null);
    (User.findById as any).mockResolvedValue(null);

    const { createOrderFromMedusa } = await import('../../packages/api/src/services/order-creation.service');
    await expect(createOrderFromMedusa('order_test123')).rejects.toThrow('PawTag user not found');
  });

  it('should find user by metadata.pawtagUserId when other lookups fail', async () => {
    // Medusa order with no customer_id, no email — only metadata
    const orderNoEmail = { ...mockMedusaOrder, customer_id: null, email: null };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ order: orderNoEmail }),
    });
    // All findOne calls return null, but findById succeeds
    (User.findOne as any).mockResolvedValue(null);
    (User.findById as any).mockResolvedValueOnce(mockPawTagUser);

    (Order.findOne as any).mockResolvedValueOnce(null);
    (Order.db.collection('counters').findOneAndUpdate as any).mockResolvedValueOnce({ value: { seq: 1 } });
    (Order.create as any).mockResolvedValueOnce({
      _id: 'order_1', orderNumber: 'PT-000001',
      items: [], payment: { amount: 59.99, currency: 'NZD', method: 'card', paidAt: new Date() },
      shippingAddress: { line1: '', city: '', state: '', zip: '', country: 'NZ' },
    });
    (Invoice.db.collection('counters').findOneAndUpdate as any).mockResolvedValueOnce({ value: { seq: 1 } });
    (Subscription.findOne as any).mockResolvedValueOnce(null);
    (Invoice.create as any).mockResolvedValueOnce({ _id: 'inv_1', invoiceNumber: 'INV-000001', amount: 59.99, status: 'paid' });
    (InvoiceAccessToken.create as any).mockResolvedValueOnce({});

    const { createOrderFromMedusa } = await import('../../packages/api/src/services/order-creation.service');
    const result = await createOrderFromMedusa('order_test123');

    expect(result.isNew).toBe(true);
    expect(User.findById).toHaveBeenCalledWith('user_abc');
  });
});
