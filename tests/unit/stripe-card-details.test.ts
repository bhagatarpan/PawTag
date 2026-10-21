import { describe, it, expect } from 'vitest';
import { extractCardDetailsFromStripeIntent } from '../../packages/api/src/commerce/providers/stripe';

describe('extractCardDetailsFromStripeIntent', () => {
  it('extracts card from expanded charges data', () => {
    const result = extractCardDetailsFromStripeIntent({
      charges: {
        data: [
          {
            payment_method_details: {
              card: { brand: 'visa', last4: '4242' },
            },
          },
        ],
      },
    });
    expect(result).toEqual({ cardBrand: 'visa', cardLast4: '4242' });
  });

  it('extracts an American Express card and its issuing country', () => {
    const result = extractCardDetailsFromStripeIntent({
      charges: {
        data: [
          {
            payment_method_details: {
              card: { brand: 'amex', last4: '1005', country: 'NZ' },
            },
          },
        ],
      },
    });
    expect(result).toEqual({ cardBrand: 'amex', cardLast4: '1005', cardCountry: 'nz' });
  });

  it('normalises the issuing country to lowercase for the CPF snapshot', () => {
    const result = extractCardDetailsFromStripeIntent({
      latest_charge: {
        payment_method_details: {
          card: { brand: 'mastercard', last4: '5555', country: 'AU' },
        },
      },
    });
    expect(result).toEqual({ cardBrand: 'mastercard', cardLast4: '5555', cardCountry: 'au' });
  });

  it('falls back to latest_charge object when charges array is empty', () => {
    const result = extractCardDetailsFromStripeIntent({
      charges: { data: [] },
      latest_charge: {
        payment_method_details: {
          card: { brand: 'mastercard', last4: '5555' },
        },
      },
    });
    expect(result).toEqual({ cardBrand: 'mastercard', cardLast4: '5555' });
  });

  it('returns empty object when no card details available', () => {
    const result = extractCardDetailsFromStripeIntent({
      charges: { data: [{ payment_method_details: {} }] },
    });
    expect(result.cardBrand).toBeUndefined();
    expect(result.cardLast4).toBeUndefined();
  });

  it('ignores incomplete card payloads missing last4', () => {
    const result = extractCardDetailsFromStripeIntent({
      charges: {
        data: [
          {
            payment_method_details: {
              card: { brand: 'visa' },
            },
          },
        ],
      },
    });
    expect(result.cardBrand).toBeUndefined();
    expect(result.cardLast4).toBeUndefined();
  });
});
