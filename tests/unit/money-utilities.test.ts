import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  roundToCents,
  toStripeAmount,
  fromStripeAmount,
  getCurrencyDecimals,
  addMoney,
  subtractMoney,
  multiplyMoney,
  clampMoneyNonNegative,
  allocateCents,
} from '../../packages/shared/src/money';

describe('money utilities', () => {
  describe('toCents / fromCents', () => {
    it('converts dollars to cents', () => {
      expect(toCents(19.99)).toBe(1999);
      expect(toCents(20.34)).toBe(2034);
      expect(toCents(0)).toBe(0);
      expect(toCents(0.01)).toBe(1);
    });

    it('rounds half-up to nearest cent', () => {
      expect(toCents(20.337652173913042)).toBe(2034);
      expect(toCents(1.01)).toBe(101);
      expect(toCents(1.004)).toBe(100);
      expect(toCents(0.29)).toBe(29);
    });

    it('converts cents back to dollars', () => {
      expect(fromCents(1999)).toBe(19.99);
      expect(fromCents(2034)).toBe(20.34);
      expect(fromCents(0)).toBe(0);
      expect(fromCents(1)).toBe(0.01);
    });
  });

  describe('roundToCents', () => {
    it('rounds to exactly 2 decimal places', () => {
      expect(roundToCents(20.337652173913042)).toBe(20.34);
      expect(roundToCents(19.99)).toBe(19.99);
      expect(roundToCents(20.0)).toBe(20.0);
      expect(roundToCents(0.001)).toBe(0);
      expect(roundToCents(0.005)).toBe(0.01);
    });

    it('handles whole amounts', () => {
      expect(roundToCents(20)).toBe(20);
      expect(roundToCents(0)).toBe(0);
      expect(roundToCents(100)).toBe(100);
    });

    it('handles very small amounts', () => {
      expect(roundToCents(0.001)).toBe(0);
      expect(roundToCents(0.009)).toBe(0.01);
    });
  });

  describe('getCurrencyDecimals', () => {
    it('returns 2 for most currencies', () => {
      expect(getCurrencyDecimals('NZD')).toBe(2);
      expect(getCurrencyDecimals('USD')).toBe(2);
      expect(getCurrencyDecimals('EUR')).toBe(2);
    });

    it('returns 0 for zero-decimal currencies', () => {
      expect(getCurrencyDecimals('JPY')).toBe(0);
      expect(getCurrencyDecimals('KRW')).toBe(0);
      expect(getCurrencyDecimals('CLP')).toBe(0);
    });
  });

  describe('toStripeAmount / fromStripeAmount', () => {
    it('converts NZD dollars to Stripe cents', () => {
      expect(toStripeAmount(20.34, 'NZD')).toBe(2034);
      expect(toStripeAmount(19.99, 'NZD')).toBe(1999);
      expect(toStripeAmount(0.01, 'NZD')).toBe(1);
    });

    it('converts JPY to Stripe minor units (no decimal)', () => {
      expect(toStripeAmount(500, 'JPY')).toBe(500);
      expect(toStripeAmount(500.6, 'JPY')).toBe(501);
    });

    it('round-trips NZD correctly', () => {
      expect(fromStripeAmount(toStripeAmount(20.34, 'NZD'), 'NZD')).toBe(20.34);
      expect(fromStripeAmount(toStripeAmount(19.99, 'NZD'), 'NZD')).toBe(19.99);
    });
  });

  describe('addMoney / subtractMoney / multiplyMoney', () => {
    it('adds without floating-point dust', () => {
      expect(addMoney(0.1, 0.2)).toBe(0.3);
      expect(addMoney(19.99, 0.01)).toBe(20.0);
      expect(addMoney(0.07, 0.01)).toBe(0.08);
      expect(addMoney(1.10, 2.20)).toBe(3.30);
    });

    it('subtracts without floating-point dust', () => {
      expect(subtractMoney(20.34, 0.01)).toBe(20.33);
      expect(subtractMoney(1.0, 0.3)).toBe(0.7);
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
    });

    it('multiplies and rounds to nearest cent', () => {
      expect(multiplyMoney(19.99, 0.1)).toBe(2.0);
      expect(multiplyMoney(10, 0.15)).toBe(1.5);
      expect(multiplyMoney(19.99, 1)).toBe(19.99);
    });
  });

  describe('clampMoneyNonNegative', () => {
    it('clamps negative to zero', () => {
      expect(clampMoneyNonNegative(-5)).toBe(0);
      expect(clampMoneyNonNegative(0)).toBe(0);
      expect(clampMoneyNonNegative(10.5)).toBe(10.5);
    });
  });

  describe('allocateCents', () => {
    it('splits evenly without losing cents', () => {
      const result = allocateCents(100, [1, 1, 1]);
      expect(result.reduce((s, v) => s + v, 0)).toBe(100);
      expect(result).toHaveLength(3);
    });

    it('allocates proportional to weights', () => {
      const result = allocateCents(1000, [1999, 500]);
      expect(result.reduce((s, v) => s + v, 0)).toBe(1000);
      expect(result[0]).toBeGreaterThan(result[1]);
    });

    it('handles single weight', () => {
      expect(allocateCents(2034, [1])).toEqual([2034]);
    });

    it('handles zero weights', () => {
      const result = allocateCents(100, [0, 0]);
      expect(result.reduce((s, v) => s + v, 0)).toBe(100);
    });
  });

  describe('regression: WO-000494 bug', () => {
    it('rounds 20.337652173913042 to 20.34', () => {
      expect(roundToCents(20.337652173913042)).toBe(20.34);
      expect(toCents(20.337652173913042)).toBe(2034);
    });

    it('reproduces the GST extraction then rounds correctly', () => {
      // 10% promo on $19.99 = 1.999 (unrounded)
      const subtotal = 19.99;
      const discount = Math.round(subtotal * 0.1 * 100) / 100; // 2.00 after fix
      const netPrice = subtotal - discount; // 17.99
      const taxInclusive = netPrice * (0.15 / 1.15); // extracted GST
      // Total for tax-inclusive = netPrice (tax is already in the price)
      const total = roundToCents(netPrice);
      expect(total).toBe(17.99);
      // Tax component is informational only
      expect(roundToCents(taxInclusive)).toBe(2.35);
    });
  });
});
