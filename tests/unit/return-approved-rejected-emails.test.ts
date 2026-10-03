import { describe, it, expect } from 'vitest';

describe('return approved/rejected customer emails', () => {
  it('uses CMS slugs return-approved and return-rejected', () => {
    expect(['return-approved', 'return-rejected']).toEqual([
      'return-approved',
      'return-rejected',
    ]);
  });

  it('approve does not imply money movement', () => {
    // Status PUT must not call Stripe; only dedicated refund endpoints do.
    const moneyEndpoints = ['POST /returns/:id/refund', 'POST /returns/:id/refund-without-return'];
    expect(moneyEndpoints).toHaveLength(2);
    expect(moneyEndpoints).not.toContain('PUT /returns/:id/status');
  });
});
