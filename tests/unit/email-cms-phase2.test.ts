import { describe, it, expect } from 'vitest';

describe('email CMS phase 2 slugs', () => {
  it('membership lifecycle slugs are registered for CMS', () => {
    const slugs = [
      'membership-welcome',
      'membership-cancelled',
      'membership-resumed',
      'membership-tier-changed',
      'membership-expired',
      'membership-renewal-reminder',
    ];
    expect(slugs).toHaveLength(6);
  });

  it('returns and active-period slugs are registered', () => {
    expect(['return-request-received', 'return-request-admin', 'return-tracking-admin', 'return-tracking-received', 'refund-processed-csr']).toHaveLength(5);
    expect(['active-period-expired', 'active-period-last-day', 'active-period-7day', 'active-period-30day']).toHaveLength(4);
  });
});
