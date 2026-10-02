import { describe, it, expect } from 'vitest';
import { formatCardDisplay, formatCardBrand } from '../../packages/shared/src/format';

describe('CSR payment card display helpers', () => {
  it('formats card brand and last4 for admin payments table', () => {
    expect(formatCardDisplay('visa', '1234')).toBe('Visa ••••1234');
    expect(formatCardDisplay('mastercard', '9999')).toBe('Mastercard ••••9999');
    expect(formatCardBrand('amex')).toBe('Amex');
  });

  it('falls back safely when card data is missing', () => {
    expect(formatCardDisplay(undefined, undefined)).toBeNull();
    expect(formatCardDisplay(null, '1234')).toBe('••••1234');
  });
});
