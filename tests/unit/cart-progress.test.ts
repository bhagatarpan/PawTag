import { describe, it, expect } from 'vitest';
import { freeShippingProgress } from '../../apps/web/src/lib/cart-progress';

/**
 * Display-only progress toward the member free-shipping threshold.
 * No threshold (guests/non-members) → null: the UI must never invent a
 * threshold the server does not apply.
 */
describe('freeShippingProgress', () => {
  it('returns null when there is no effective threshold', () => {
    expect(freeShippingProgress(45, null)).toBeNull();
    expect(freeShippingProgress(45, undefined)).toBeNull();
    expect(freeShippingProgress(45, 0)).toBeNull();
    expect(freeShippingProgress(45, -10)).toBeNull();
    expect(freeShippingProgress(45, Number.NaN)).toBeNull();
  });

  it('computes the remaining amount and progress below the threshold', () => {
    const p = freeShippingProgress(88, 100)!;

    expect(p.remaining).toBe(12);
    expect(p.percent).toBe(88);
    expect(p.unlocked).toBe(false);
    expect(p.threshold).toBe(100);
  });

  it('marks unlocked at or above the threshold and caps the bar at 100%', () => {
    const at = freeShippingProgress(100, 100)!;
    expect(at.unlocked).toBe(true);
    expect(at.remaining).toBe(0);
    expect(at.percent).toBe(100);

    const over = freeShippingProgress(150.5, 100)!;
    expect(over.unlocked).toBe(true);
    expect(over.remaining).toBe(0);
    expect(over.percent).toBe(100);
  });

  it('never produces negative remaining or < 0 percent for empty carts', () => {
    const p = freeShippingProgress(0, 100)!;
    expect(p.remaining).toBe(100);
    expect(p.percent).toBe(0);
  });

  it('avoids float dust in the remaining amount (cent rounding)', () => {
    // 100 - 87.90 → must be exactly 12.10, not 12.099999999999994
    const p = freeShippingProgress(87.9, 100)!;
    expect(p.remaining.toFixed(2)).toBe('12.10');
  });

  it('handles threshold values with cents', () => {
    const p = freeShippingProgress(99.99, 99.99)!;
    expect(p.unlocked).toBe(true);
    expect(p.remaining).toBe(0);
  });
});
