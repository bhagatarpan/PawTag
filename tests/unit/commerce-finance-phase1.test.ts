import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 1 — CPF computation + refund eligibility (the single source of
 * truth for line-item refundability, GST portions, and the master
 * refundable cap).
 *
 * Plan: docs/COMMERCE-FINANCE-PLAN-GST-CPF.md §6/§7.
 * Money rules: cents-safe via shared helpers (skills/monetary-precision).
 */

const mocks = vi.hoisted(() => ({
  fulfilmentFind: vi.fn(),
  paymentTxnFind: vi.fn(),
  paymentTxnCreate: vi.fn(),
  orderFindById: vi.fn(),
  getSetting: vi.fn(),
  getNumberSetting: vi.fn(),
  getBooleanSetting: vi.fn(),
  gstGetRate: vi.fn(),
  gstIsInclusive: vi.fn(),
  createRefund: vi.fn(),
  logRefundEvent: vi.fn(),
}));

vi.mock('@pawtag/db', () => ({
  Fulfilment: { find: mocks.fulfilmentFind },
  PaymentTransaction: { find: mocks.paymentTxnFind, create: mocks.paymentTxnCreate },
  Order: { findById: mocks.orderFindById },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getSetting: mocks.getSetting,
  getNumberSetting: mocks.getNumberSetting,
  getBooleanSetting: mocks.getBooleanSetting,
}));

vi.mock('../../packages/api/src/commerce/providers/simple-gst', () => ({
  nzGstProvider: {
    getRate: mocks.gstGetRate,
    isInclusive: mocks.gstIsInclusive,
    getLabel: vi.fn(async () => 'GST'),
  },
}));

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: { createRefund: mocks.createRefund },
}));

vi.mock('../../packages/api/src/commerce/audit', () => ({
  logRefundEvent: mocks.logRefundEvent,
  logPaymentEvent: vi.fn(),
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  computeCpf,
  isCpfCardNetwork,
  applyCapturedCardDetails,
  verifyCapturedBrandForCpf,
  refundOrderCpf,
  cpfRetained,
} from '../../packages/api/src/commerce/services/cpf.service';
import { orderCpf, orderPayableTotal } from '@pawtag/shared';
import {
  gstPortion,
  getTaggedUnits,
  lineRefundability,
  maxRefundableCents,
  buildBreakdown,
  buildFullSelection,
  assertWithinRefundableCap,
  allocateAmountToBreakdown,
} from '../../packages/api/src/commerce/services/refund-eligibility.service';
import { InvalidRefundSelectionError, RefundExceedsCapError } from '../../packages/api/src/commerce/errors';

function orderFixture(overrides: Record<string, any> = {}) {
  return {
    _id: 'order1',
    orderNumber: 'WO-000600',
    payment: {
      amount: 60.85,
      currency: 'NZD',
      status: 'completed',
      stripePaymentIntentId: 'pi_test_1',
      cpf: { amount: 1.86, gst: 0.24, percent: 2.65, fixed: 0.3, scheduleVersion: 'v1', refundedAmount: 0 },
    },
    items: [
      {
        _id: 'item1',
        productName: 'PawTag Plus',
        quantity: 1,
        unitPrice: 39.99,
        customizationTotal: 19,
        refundedQuantity: 0,
        customisationTexts: ['jumbo'],
      },
    ],
    save: vi.fn(async () => undefined),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBooleanSetting.mockImplementation(async (key: string) =>
    key === 'commerce.cpf.enabled' ? true : key === 'commerce.cpf.refundOnMerchantFault' ? true : false,
  );
  mocks.getNumberSetting.mockImplementation(async (key: string) =>
    key === 'commerce.cpf.percent' ? 2.65 : key === 'commerce.cpf.fixed' ? 0.3 : 0,
  );
  mocks.getSetting.mockImplementation(async (key: string) =>
    key === 'commerce.cpf.appliesTo' ? 'visa,mastercard' : key === 'commerce.cpf.scheduleVersion' ? 'v1' : '',
  );
  mocks.gstGetRate.mockResolvedValue(0.15);
  mocks.gstIsInclusive.mockResolvedValue(true);
  mocks.fulfilmentFind.mockReturnValue({ lean: async () => [] });
  mocks.paymentTxnFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  mocks.paymentTxnCreate.mockResolvedValue({});
  mocks.logRefundEvent.mockResolvedValue(undefined);
});

// ─── CPF computation ────────────────────────────────────────────────
describe('cpf.service.computeCpf', () => {
  it('computes percent + fixed, GST-inclusive, per the founder example (D7/D8)', async () => {
    // 58.99 × 2.65% = 1.5632 → 1.56; + 0.30 = 1.86; GST = 1.86 × 15/115 = 0.24
    const cpf = await computeCpf(58.99);
    expect(cpf).toEqual({ amount: 1.86, gst: 0.24, percent: 2.65, fixed: 0.3, scheduleVersion: 'v1' });
  });

  it('returns null when the switch is off (D3 — flick of switch)', async () => {
    mocks.getBooleanSetting.mockResolvedValue(false);
    expect(await computeCpf(58.99)).toBeNull();
  });

  it('returns null for zero/negative payables', async () => {
    expect(await computeCpf(0)).toBeNull();
    expect(await computeCpf(-5)).toBeNull();
  });
});

describe('cpf.service network rules', () => {
  it('normalises brands for the appliesTo list (MC/Master Card → mastercard)', async () => {
    expect(await isCpfCardNetwork('visa')).toBe(true);
    expect(await isCpfCardNetwork('Mastercard')).toBe(true);
    expect(await isCpfCardNetwork('master')).toBe(true);
    expect(await isCpfCardNetwork('MC')).toBe(true);
    expect(await isCpfCardNetwork('amex')).toBe(false);
    expect(await isCpfCardNetwork(null)).toBe(false);
  });

  it('shared orderCpf/orderPayableTotal helpers are the single totals source', () => {
    const order = orderFixture();
    expect(orderCpf(order)).toEqual({ amount: 1.86, gst: 0.24 });
    expect(orderPayableTotal(order)).toBe(60.85);
    // Historical orders without the snapshot — nothing applies
    const legacy: any = orderFixture();
    delete legacy.payment.cpf;
    expect(orderCpf(legacy)).toBeNull();
    expect(orderPayableTotal(legacy)).toBe(60.85);
    expect(orderCpf(null)).toBeNull();
    expect(orderPayableTotal(null)).toBeNull();
  });

  it('stores captured brand/country on the snapshot', () => {
    const order = orderFixture();
    applyCapturedCardDetails(order, 'visa', 'NZ');
    expect(order.payment.cpf.cardNetwork).toBe('visa');
    expect(order.payment.cpf.cardCountry).toBe('NZ');
  });

  it('flags an unsupported captured brand for the exception refund', async () => {
    expect(await verifyCapturedBrandForCpf(orderFixture(), 'amex')).toBe(true);
    expect(await verifyCapturedBrandForCpf(orderFixture(), 'visa')).toBe(false);
  });

  it('does not double-refund an already-handled CPF', async () => {
    const order = orderFixture();
    order.payment.cpf.refundedAmount = 1.86;
    expect(await verifyCapturedBrandForCpf(order, 'amex')).toBe(false);
  });
});

describe('cpf.service.refundOrderCpf (exception paths)', () => {
  it('refunds the retained CPF once and records it durably', async () => {
    mocks.createRefund.mockResolvedValue({ success: true, refundId: 're_cpf_1', status: 'succeeded' });
    const order = orderFixture();

    const outcome = await refundOrderCpf(order, 'unsupported_brand', 'amex not covered');

    expect(outcome.refunded).toBe(true);
    expect(mocks.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: 'pi_test_1', amount: 1.86 }),
    );
    expect(order.payment.cpf.refundedAmount).toBe(1.86);
    expect(order.save).toHaveBeenCalled();
    expect(mocks.paymentTxnCreate).toHaveBeenCalledWith(expect.objectContaining({ type: 'refund', amount: 1.86 }));

    // Idempotent: second run is a clean no-op
    const again = await refundOrderCpf(order, 'unsupported_brand', 'amex not covered');
    expect(again.refunded).toBe(false);
    expect(again.reason).toBe('already_refunded');
    expect(mocks.createRefund).toHaveBeenCalledTimes(1);
  });

  it('does not mutate state when Stripe fails', async () => {
    mocks.createRefund.mockResolvedValue({ success: false, error: 'card_declined' });
    const order = orderFixture();

    const outcome = await refundOrderCpf(order, 'merchant_fault', 'cannot fulfil');

    expect(outcome.refunded).toBe(false);
    expect(order.payment.cpf.refundedAmount || 0).toBe(0);
    expect(order.save).not.toHaveBeenCalled();
  });

  it('skips synthetic payment intents (nothing at Stripe)', async () => {
    const order = orderFixture();
    order.payment.stripePaymentIntentId = 'pi_zero_123';
    const outcome = await refundOrderCpf(order, 'merchant_fault', 'cannot fulfil');
    expect(outcome.reason).toBe('missing_payment');
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it('cpfRetained counts amount minus exception refunds', () => {
    const order = orderFixture();
    order.payment.cpf.refundedAmount = 0.5;
    expect(cpfRetained(order)).toBe(1.36);
  });
});

// ─── Refund eligibility ─────────────────────────────────────────────
describe('refund-eligibility gstPortion', () => {
  it('extracts the inclusive GST portion via the tax provider rate', async () => {
    // 19.00 × 15/115 = 2.4782… → 2.48
    expect(await gstPortion(19)).toBe(2.48);
  });

  it('applies the rate to net amounts in tax-exclusive stores', async () => {
    mocks.gstIsInclusive.mockResolvedValue(false);
    expect(await gstPortion(19)).toBe(2.85); // 19 × 0.15
  });
});

describe('refund-eligibility tagging + refundability', () => {
  it('sums tagged units across fulfilment assignments', async () => {
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [
        { tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] },
        { tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] },
      ],
    });
    expect(await getTaggedUnits('order1', 'item1')).toBe(2);
  });

  it('derives per-item refundability (tagged engraving retained, hard cap D14)', async () => {
    const order = orderFixture();
    order.items[0].quantity = 2;
    order.items[0].refundedQuantity = 1;
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    const [item] = await lineRefundability(order);
    expect(item.taggedUnits).toBe(1);
    expect(item.productRefundableQty).toBe(1);
    expect(item.engravingRefundableUnits).toBe(1); // 1 untagged ∧ 1 unrefunded
    expect(item.engravingRetained).toBe(19);
  });

  it('REGRESSION: plain items (no engraving charge) never report engraving-refundable units', async () => {
    // A non-engraved item has no engraving money to return. Reporting
    // phantom engraving units here made buildFullSelection emit an
    // engraving line that buildBreakdown rejected, failing EVERY
    // cancellation of a plain order closed ("Could not verify the
    // refundable amount" — surfaced live in the customer portal).
    const order = orderFixture();
    order.items[0].customizationTotal = 0;
    order.items[0].customisationTexts = [];
    mocks.fulfilmentFind.mockReturnValue({ lean: async () => [] });

    const [item] = await lineRefundability(order);
    expect(item.productRefundableQty).toBe(1);
    expect(item.engravingRefundableUnits).toBe(0);
    expect(item.engravingRetained).toBe(0);
  });
});

describe('refund-eligibility master cap', () => {
  it('cap = captured − retained CPF − retained engraving − prior refunds', async () => {
    const order = orderFixture(); // captured 60.85, cpf 1.86, engraving 19 (tagged)
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    // 6085 − 186 (cpf) − 1900 (engraving) − 0 = 3999 → $39.99 (exactly the product line)
    expect(await maxRefundableCents(order, 0)).toBe(3999);
  });

  it('assertWithinRefundableCap throws a truthful 400-style error', async () => {
    const order = orderFixture();
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });
    await expect(assertWithinRefundableCap(order, 5000, 0)).rejects.toBeInstanceOf(RefundExceedsCapError);
    await expect(assertWithinRefundableCap(order, 3999, 0)).resolves.toBe(3999);
  });
});

describe('refund-eligibility buildBreakdown', () => {
  it('builds product + engraving lines with per-line GST (untagged order)', async () => {
    const order = orderFixture(); // product 39.99 + engraving 19

    const { breakdown, refundAmount } = await buildBreakdown(order, {
      lines: [{ orderItemId: 'item1', productQuantity: 1, engravingQuantity: 1 }],
    });

    expect(refundAmount).toBe(58.99);
    expect(breakdown.lines).toHaveLength(2);
    const product = breakdown.lines.find((l) => l.kind === 'product')!;
    const engraving = breakdown.lines.find((l) => l.kind === 'engraving')!;
    expect(product.refundedAmount).toBe(39.99);
    expect(product.gstPortion).toBe(5.22); // 39.99 × 15/115
    expect(engraving.refundedAmount).toBe(19);
    expect(engraving.gstPortion).toBe(2.48);
    expect(breakdown.totals.refunded).toBe(58.99);
    expect(breakdown.totals.refundedGst).toBe(7.7);
    // CPF retained is recorded on the snapshot
    expect(breakdown.retained.cpf).toBe(1.86);
    expect(breakdown.retained.cpfGst).toBe(0.24);
  });

  it('REJECTS engraving selection for a tagged unit (hard cap, D14)', async () => {
    const order = orderFixture();
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    await expect(
      buildBreakdown(order, { lines: [{ orderItemId: 'item1', engravingQuantity: 1 }] }),
    ).rejects.toThrow(/PawTag ID has already been generated/i);
  });

  it('allows the product line for a tagged order and records engraving retention', async () => {
    const order = orderFixture();
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    const { breakdown, refundAmount } = await buildBreakdown(order, {
      lines: [{ orderItemId: 'item1', productQuantity: 1 }],
    });

    expect(refundAmount).toBe(39.99);
    expect(breakdown.lines).toHaveLength(1);
    expect(breakdown.retained.engraving).toBe(19);
    expect(breakdown.retained.engravingGst).toBe(2.48);
  });

  it('rejects unknown order items and over-quantities', async () => {
    const order = orderFixture();
    await expect(
      buildBreakdown(order, { lines: [{ orderItemId: 'nope', productQuantity: 1 }] }),
    ).rejects.toThrow(InvalidRefundSelectionError);
    await expect(
      buildBreakdown(order, { lines: [{ orderItemId: 'item1', productQuantity: 5 }] }),
    ).rejects.toThrow(/Only 1 unit/i);
  });

  it('buildFullSelection auto-excludes ineligible engraving', async () => {
    const order = orderFixture();
    order.items[0].quantity = 2;
    mocks.fulfilmentFind.mockReturnValue({
      lean: async () => [{ tagAssignments: [{ orderItemId: 'item1', quantity: 1 }] }],
    });

    const selection = await buildFullSelection(order);
    expect(selection.lines).toEqual([{ orderItemId: 'item1', productQuantity: 2, engravingQuantity: 1 }]);
  });

  it('REGRESSION: cancellation sequence succeeds for a plain (non-engraved) order', async () => {
    // Mirrors exactly what cancelOrder runs: buildFullSelection →
    // buildBreakdown. Before the fix this threw "has no engraving charge
    // to refund", which cancellation.service treated as an eligibility
    // failure and failed closed (HTTP 502, order not cancelled).
    const order = orderFixture(); // product 39.99 + CPF 1.86, no engraving
    order.items[0].customizationTotal = 0;
    order.items[0].customisationTexts = [];
    order.payment.amount = 41.85;
    mocks.fulfilmentFind.mockReturnValue({ lean: async () => [] });

    const selection = await buildFullSelection(order);
    expect(selection.lines).toEqual([{ orderItemId: 'item1', productQuantity: 1, engravingQuantity: 0 }]);

    const { breakdown, refundAmount } = await buildBreakdown(order, selection);
    expect(refundAmount).toBe(39.99);
    expect(breakdown.lines).toHaveLength(1);
    expect(breakdown.lines[0].kind).toBe('product');
  });
});

describe('refund-eligibility amount-only allocation (legacy path, D16)', () => {
  it('allocates a plain amount proportionally across eligible lines', async () => {
    const order = orderFixture(); // product 39.99 + engraving 19, eligible total 58.99

    const breakdown = await allocateAmountToBreakdown(order, 29.5);

    expect(breakdown.totals.refunded).toBe(29.5);
    const sumLines = breakdown.lines.reduce((s, l) => s + l.refundedAmount, 0);
    expect(sumLines).toBe(29.5); // cents-exact
    // GST sums to the portions of each allocated line (no drift)
    expect(breakdown.totals.refundedGst).toBe(
      Number((breakdown.lines.reduce((s, l) => s + l.gstPortion, 0).toFixed(2))),
    );
  });

  it('caps allocation at the eligible total', async () => {
    const order = orderFixture();
    const breakdown = await allocateAmountToBreakdown(order, 500);
    expect(breakdown.totals.refunded).toBe(58.99);
  });
});
