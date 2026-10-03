import { describe, it, expect } from 'vitest';
import { Return } from '../../packages/db/src/models/Return';

describe('Return model — return/refund domain', () => {
  it('supports refund linkage and exception fields', () => {
    const schema = Return.schema;
    expect(schema.path('refundId')).toBeTruthy();
    expect(schema.path('refundStatus')).toBeTruthy();
    expect(schema.path('refundWithoutReturn')).toBeTruthy();
    expect(schema.path('returnTrackingNumber')).toBeTruthy();
    expect(schema.path('requestedByPhone')).toBeTruthy();
  });

  it('includes refund_failed in status enum', () => {
    const statusPath = Return.schema.path('status') as any;
    const enumValues = statusPath.enumValues || statusPath.options?.enum;
    expect(enumValues).toContain('refund_failed');
    expect(enumValues).toContain('received');
  });
});
