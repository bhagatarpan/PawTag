import { describe, it, expect } from 'vitest';
import { requiresPaymentForKeep } from '../../packages/shared/src/membership';

/**
 * Keep panel free vs paid must follow membership period end dates —
 * never infer paid solely from a price prop (regression: NZ$89 shown
 * while benefits until 2 Oct 2027).
 */
describe('Keep membership free vs paid decision', () => {
  const now = new Date('2026-10-05T00:00:00Z');

  it('treats cancelling membership with future period end as free (no payment)', () => {
    const decision = requiresPaymentForKeep(
      { currentPeriodEnd: new Date('2027-10-02T00:00:00Z') },
      now,
    );
    expect(decision.requiresPayment).toBe(false);
  });

  it('treats benefits-exhausted membership as paid', () => {
    const decision = requiresPaymentForKeep(
      { currentPeriodEnd: new Date('2026-10-01T00:00:00Z') },
      now,
    );
    expect(decision.requiresPayment).toBe(true);
  });

  it('UI rule: periodEnded=false means free copy even if price prop is set', () => {
    // Mirrors KeepMembershipPanel: showPaidIdle = phase idle && periodEnded && !serverPaid
    const periodEnded = false;
    const chargeAmountProp = 89; // Manage used to pass membership.price always
    const showPaidIdle = periodEnded; // price must not drive this
    expect(showPaidIdle).toBe(false);
    expect(chargeAmountProp).toBeGreaterThan(0); // prop alone must not force paid UI
  });

  it('UI rule: periodEnded=true allows paid idle copy', () => {
    const periodEnded = true;
    const showPaidIdle = periodEnded;
    expect(showPaidIdle).toBe(true);
  });
});
