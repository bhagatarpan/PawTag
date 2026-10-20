import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Cancellation × finance rules wiring (docs/COMMERCE-FINANCE-PLAN-GST-CPF.md §2):
 * - cancelOrder refunds the ELIGIBLE amount (excludes retained card fee +
 *   engraving for units with generated PawTag IDs) — never the raw capture
 * - the breakdown snapshot lands on the refund PaymentTransaction
 * - item refund state is marked for credit notes/documents
 * - merchant-fault cancellations refund the card fee too (config-gated)
 */

const mocks = vi.hoisted(() => ({
  orderFindById: vi.fn(),
  orderSave: vi.fn(),
  paymentTxnCreate: vi.fn(),
  paymentTxnFind: vi.fn(),
  invoiceFindOne: vi.fn(),
  invoiceCreate: vi.fn(),
  notificationCreate: vi.fn(),
  fulfilmentFind: vi.fn(),
  stripeRetrieveRefund: vi.fn(),
  stripeCreateRefund: vi.fn(),
  inventoryRelease: vi.fn(),
  logPaymentEvent: vi.fn(),
  logRefundEvent: vi.fn(),
  auditLog: vi.fn(),
  getBooleanSetting: vi.fn(),
  getNumberSetting: vi.fn(),
  getSetting: vi.fn(),
  createCreditNote: vi.fn(),
  pointsClawback: vi.fn(),
}));

vi.mock('@pawtag/db', () => ({
  Order: { findById: mocks.orderFindById, updateOne: vi.fn().mockResolvedValue({}) },
  PaymentTransaction: { create: mocks.paymentTxnCreate, find: mocks.paymentTxnFind },
  Invoice: { findOne: mocks.invoiceFindOne, create: mocks.invoiceCreate },
  Notification: { create: mocks.notificationCreate },
  Fulfilment: { find: mocks.fulfilmentFind },
  User: { findById: vi.fn() },
}));

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: mocks.stripeCreateRefund,
    retrieveRefund: mocks.stripeRetrieveRefund,
  },
}));

vi.mock('../../packages/api/src/commerce/services/inventory.service', () => ({
  inventoryService: { releaseAll: mocks.inventoryRelease, release: mocks.inventoryRelease },
}));

vi.mock('../../packages/api/src/commerce/audit', () => ({
  logPaymentEvent: mocks.logPaymentEvent,
  logRefundEvent: mocks.logRefundEvent,
}));

vi.mock('../../packages/api/src/services/audit', () => ({
  auditService: { log: mocks.auditLog },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getBooleanSetting: mocks.getBooleanSetting,
  getNumberSetting: mocks.getNumberSetting,
  getSetting: mocks.getSetting,
  getSettingsRepository: vi.fn(),
}));

vi.mock('../../packages/api/src/commerce/providers/simple-gst', () => ({
  nzGstProvider: {
    getRate: vi.fn(async () => 0.15),
    isInclusive: vi.fn(async () => true),
    getLabel: vi.fn(async () => 'GST'),
  },
}));

vi.mock('../../packages/api/src/commerce/services/credit-note.service', () => ({
  createCreditNoteForRefund: mocks.createCreditNote,
}));

vi.mock('../../packages/api/src/services/loyalty/points-earning.service', () => ({
  refundClawbackForOrder: mocks.pointsClawback,
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { cancelOrder } from '../../packages/api/src/commerce/services/cancellation.service';

function paidOrderFixture(overrides: Record<string, any> = {}) {
  const order: any = {
    _id: 'order1',
    orderNumber: 'WO-000700',
    status: 'paid',
    userId: 'user1',
    payment: {
      status: 'completed',
      amount: 60.85,
      currency: 'NZD',
      stripePaymentIntentId: 'pi_test_1',
      cardBrand: 'visa',
      cardLast4: '4242',
      cpf: { amount: 1.86, gst: 0.24, percent: 2.65, fixed: 0.3, scheduleVersion: 'v1', refundedAmount: 0 },
    },
    items: [
      { _id: 'item1', productName: 'PawTag Plus', quantity: 1, unitPrice: 39.99, customizationTotal: 19, refundedQuantity: 0 },
    ],
    trackingNumber: '',
    save: mocks.orderSave,
    ...overrides,
  };
  return order;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.orderSave.mockResolvedValue(undefined);
  mocks.paymentTxnCreate.mockResolvedValue({});
  mocks.paymentTxnFind.mockResolvedValue([]);
  mocks.invoiceFindOne.mockResolvedValue({ invoiceNumber: 'INV-1' });
  mocks.invoiceCreate.mockResolvedValue({});
  mocks.fulfilmentFind.mockReturnValue({ lean: async () => [] });
  mocks.stripeRetrieveRefund.mockResolvedValue({ success: false, error: 'not found' });
  mocks.stripeCreateRefund.mockResolvedValue({ success: true, refundId: 're_1', status: 'succeeded', amount: 58.99 });
  mocks.inventoryRelease.mockResolvedValue({});
  mocks.logPaymentEvent.mockResolvedValue(undefined);
  mocks.logRefundEvent.mockResolvedValue(undefined);
  mocks.auditLog.mockResolvedValue(undefined);
  mocks.createCreditNote.mockResolvedValue({ _id: 'cn1', invoiceNumber: 'CN-1' });
  mocks.pointsClawback.mockResolvedValue({ pointsToDeduct: 0 });
  mocks.getBooleanSetting.mockResolvedValue(true);
  mocks.getNumberSetting.mockResolvedValue(60);
  mocks.getSetting.mockResolvedValue('');
});

describe('cancelOrder × finance rules', () => {
  it('refunds eligible amounts only — retained card fee excluded; breakdown persisted', async () => {
    const order = paidOrderFixture();
    mocks.orderFindById.mockResolvedValue(order);

    const result = await cancelOrder({
      orderId: 'order1',
      reason: 'changed mind',
      actor: { name: 'Customer', type: 'customer', portal: 'customer-web' },
      requireRefundSuccess: true,
    });

    expect(result.success).toBe(true);
    // captured 60.85 − cpf 1.86 = 58.99 (engraving refundable — no tags)
    expect(mocks.stripeCreateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 58.99 }),
    );
    // Breakdown snapshot persisted on the refund transaction
    const txn = mocks.paymentTxnCreate.mock.calls[0][0];
    expect(txn.breakdown.totals.refunded).toBe(58.99);
    expect(txn.breakdown.totals.refundedGst).toBe(7.7); // 5.22 + 2.48
    expect(txn.breakdown.retained.cpf).toBe(1.86);
    // Item refund state marked for credit notes/documents
    expect(order.items[0].refundedQuantity).toBe(1);
    expect(order.items[0].refundStatus).toBe('refunded');
  });

  it('excludes engraving for units whose PawTag ID was generated', async () => {
    const order = paidOrderFixture();
    mocks.orderFindById.mockResolvedValue(order);
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    await cancelOrder({
      orderId: 'order1',
      reason: 'changed mind',
      actor: { name: 'Customer', type: 'customer', portal: 'customer-web' },
      requireRefundSuccess: true,
    });

    // captured 60.85 − cpf 1.86 − engraving 19.00 = 39.99 (product only)
    expect(mocks.stripeCreateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 39.99 }),
    );
    const txn = mocks.paymentTxnCreate.mock.calls[0][0];
    expect(txn.breakdown.retained.engraving).toBe(19);
  });

  it('merchant-fault cancellation refunds the card fee on top (config-gated)', async () => {
    const order = paidOrderFixture();
    mocks.orderFindById.mockResolvedValue(order);

    const result = await cancelOrder({
      orderId: 'order1',
      reason: 'Out of stock — PawTag fault',
      actor: { name: 'Admin', type: 'admin', portal: 'admin-web' },
      requireRefundSuccess: true,
      merchantFault: true,
    });

    expect(result.success).toBe(true);
    // Standard refund of eligible amounts…
    expect(mocks.stripeCreateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 58.99 }),
    );
    // …plus the card fee via the exception path
    expect(mocks.stripeCreateRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1.86, metadata: expect.objectContaining({ cpfException: 'merchant_fault' }) }),
    );
    expect(order.payment.cpf.refundedAmount).toBe(1.86);
  });

  it('fails closed when eligibility cannot be verified (strict cancellations)', async () => {
    const order = paidOrderFixture();
    mocks.orderFindById.mockResolvedValue(order);
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => Promise.reject(new Error('db down')),
    });

    const result = await cancelOrder({
      orderId: 'order1',
      reason: 'changed mind',
      actor: { name: 'Customer', type: 'customer', portal: 'customer-web' },
      requireRefundSuccess: true,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('REFUND_FAILED');
    expect(mocks.stripeCreateRefund).not.toHaveBeenCalled();
  });
});
