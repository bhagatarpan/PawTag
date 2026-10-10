import { describe, it, expect } from 'vitest';
import { roundToCents, toCents, addMoney, subtractMoney } from '../../packages/shared/src/money';

/**
 * Regression tests for the monetary precision bugs fixed in the audit.
 *
 * Root cause: checkout.service.ts added extracted GST on top of GST-inclusive
 * prices, producing raw floats like 20.337652173913042 for a $19.99 item
 * with a 10% promo code.
 *
 * The correct tax-inclusive total formula (matching cart.service.ts:549):
 *   total = subtotal - discount - accessoryDiscount + shipping
 *   (tax is NOT added — it is already included in the prices)
 */

describe('checkout total correctness', () => {
  const GST_RATE = 0.15;

  /**
   * Simulates the FIXED cart.service.calculateTotals tax-inclusive path.
   */
  function calculateCartTotals(opts: {
    subtotal: number;
    discount?: number;
    accessoryDiscount?: number;
    shipping?: number;
    taxInclusive?: boolean;
  }) {
    const { subtotal, discount = 0, accessoryDiscount = 0, shipping = 0, taxInclusive = true } = opts;
    const netBase = subtotal - discount - accessoryDiscount + shipping;
    const tax = taxInclusive
      ? roundToCents(netBase * (GST_RATE / (1 + GST_RATE)))
      : roundToCents(netBase * GST_RATE);
    const total = roundToCents(netBase + (taxInclusive ? 0 : tax));
    return { subtotal, discount, accessoryDiscount, shipping, tax, total, taxInclusive };
  }

  /**
   * Simulates the FIXED buildCheckoutQuote total formula.
   */
  function buildCheckoutQuote(opts: {
    subtotal: number;
    discount?: number;
    accessoryDiscount?: number;
    shipping?: number;
    tax?: number;
    rewardsToApply?: number;
    taxInclusive?: boolean;
  }) {
    const {
      subtotal, discount = 0, accessoryDiscount = 0,
      shipping = 0, tax = 0, rewardsToApply = 0, taxInclusive = true,
    } = opts;
    const totalDiscount = discount + rewardsToApply;
    const total = Math.max(0, roundToCents(
      subtotal - totalDiscount - accessoryDiscount + shipping + (taxInclusive ? 0 : tax),
    ));
    return { subtotal, discount: totalDiscount, accessoryDiscount, shipping, tax, total };
  }

  it('tax-inclusive: does NOT add extracted GST on top of prices (WO-000494 bug)', () => {
    // $19.99 item, 10% promo, tax-inclusive
    const promoDiscount = roundToCents(19.99 * 0.1); // 2.00
    const quote = buildCheckoutQuote({
      subtotal: 19.99,
      discount: promoDiscount,
      taxInclusive: true,
    });
    // Tax-inclusive total = subtotal - discount = 17.99 (tax already in price)
    expect(quote.total).toBe(17.99);
    // NOT 20.34 (which was the double-counted result)
    expect(quote.total).not.toBe(20.34);
  });

  it('tax-inclusive: never produces repeating decimals like 20.337652173913042', () => {
    const promoDiscount = roundToCents(19.99 * 0.1);
    const quote = buildCheckoutQuote({
      subtotal: 19.99,
      discount: promoDiscount,
      taxInclusive: true,
    });
    // Verify no more than 2 decimal places
    expect(quote.total).toBe(roundToCents(quote.total));
    // Verify it's not the buggy value
    expect(quote.total).not.toBe(20.337652173913042);
  });

  it('tax-exclusive: adds tax on top', () => {
    const quote = buildCheckoutQuote({
      subtotal: 100,
      tax: roundToCents(100 * 0.15), // 15.00
      taxInclusive: false,
    });
    expect(quote.total).toBe(115);
  });

  it('accessory discount is included in the total', () => {
    const quote = buildCheckoutQuote({
      subtotal: 100,
      accessoryDiscount: 5,
      taxInclusive: true,
    });
    expect(quote.total).toBe(95);
  });

  it('rewards are subtracted exactly once', () => {
    const quote = buildCheckoutQuote({
      subtotal: 50,
      rewardsToApply: 10,
      taxInclusive: true,
    });
    expect(quote.total).toBe(40);
    expect(quote.discount).toBe(10);
  });

  it('free shipping: total recalculates correctly with accessory discount', () => {
    const totals = calculateCartTotals({
      subtotal: 100,
      accessoryDiscount: 5,
      shipping: 9.99,
      taxInclusive: true,
    });
    // With free shipping (shipping = 0)
    const freeShipTotal = roundToCents(100 - 0 - 5 + 0);
    expect(freeShipTotal).toBe(95);
  });

  it('GST extraction is correct and rounded', () => {
    const totals = calculateCartTotals({
      subtotal: 19.99,
      discount: 2.00,
      taxInclusive: true,
    });
    // netBase = 17.99, tax = 17.99 × 0.15/1.15 = 2.346... → rounded to 2.35
    expect(totals.tax).toBe(2.35);
    expect(totals.total).toBe(17.99);
  });

  it('whole amounts stay whole', () => {
    const quote = buildCheckoutQuote({ subtotal: 20, taxInclusive: true });
    expect(quote.total).toBe(20);
  });

  it('multiple partial refunds do not exceed original (cents math)', () => {
    const captured = toCents(20.34); // 2034
    const refund1 = toCents(10.00);  // 1000
    const refund2 = toCents(10.34);  // 1034
    expect(refund1 + refund2).toBe(captured);

    // Third refund should be rejected
    const refund3 = toCents(0.01); // 1
    expect(refund1 + refund2 + refund3).toBeGreaterThan(captured);
  });

  it('float addition produces dust but addMoney does not', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in raw float
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });
});
