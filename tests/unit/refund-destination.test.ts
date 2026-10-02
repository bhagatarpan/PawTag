import { describe, it, expect } from 'vitest';
import {
  formatCardBrand,
  formatCardDisplay,
  formatRefundDestination,
  formatRefundDestinationShort,
  formatRefundDestinationSentence,
} from '../../packages/shared/src/format';

describe('refund destination formatters', () => {
  it('formats card brand and last4 display', () => {
    expect(formatCardBrand('visa')).toBe('Visa');
    expect(formatCardDisplay('visa', '1234')).toBe('Visa ••••1234');
    expect(formatCardDisplay('mastercard', null)).toBe('Mastercard');
    expect(formatCardDisplay(null, '1234')).toBe('••••1234');
    expect(formatCardDisplay(null, null)).toBeNull();
  });

  it('formats full refund destination labels', () => {
    expect(formatRefundDestination('visa', '1234')).toBe('Visa ••••1234 (original payment method)');
    expect(formatRefundDestination(undefined, undefined)).toBe('Original payment method');
    expect(formatRefundDestinationShort('visa', '1234')).toBe('Refund to Visa ••••1234');
    expect(formatRefundDestinationShort(null, null)).toBeNull();
  });

  it('formats customer-facing destination sentence', () => {
    const withCard = formatRefundDestinationSentence('visa', '1234');
    expect(withCard).toContain('Visa ••••1234');
    expect(withCard).toContain('original payment method');
    expect(withCard).toContain('replaced or expired');

    const withoutCard = formatRefundDestinationSentence();
    expect(withoutCard).toContain('original payment method');
    expect(withoutCard).toContain('replaced or expired');
  });
});
