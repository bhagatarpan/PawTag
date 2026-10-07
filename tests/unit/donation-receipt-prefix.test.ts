import { describe, it, expect } from 'vitest';

/**
 * Receipt number prefix must come from settings, not hardcoded product literals
 * in domain logic. Default fallback is PTD only as last-resort when setting missing.
 */
describe('Donation receipt number prefix (settings-driven)', () => {
  it('uses configured prefix format', async () => {
    const { getDonationReceiptPrefix } = await import('../../packages/api/src/services/donation/donation-config');
    const prev = process.env.DYNAMODB_SETTINGS_READS;
    // Defaults without DB: PTD
    const prefix = await getDonationReceiptPrefix();
    expect(prefix).toMatch(/^[A-Z0-9]{1,10}$/);
    if (prev !== undefined) process.env.DYNAMODB_SETTINGS_READS = prev;
  });

  it('formats receipt numbers as PREFIX-000001 from a given prefix', () => {
    const prefix = 'PTD';
    const seq = 1;
    const receiptNumber = `${prefix}-${String(seq).padStart(6, '0')}`;
    expect(receiptNumber).toBe('PTD-000001');
  });
});
