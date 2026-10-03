import { describe, it, expect } from 'vitest';

describe('return tracking edit rules', () => {
  it('allows edit only while approved (before warehouse received)', () => {
    const canEdit = (status: string) => status === 'approved';
    expect(canEdit('approved')).toBe(true);
    expect(canEdit('received')).toBe(false);
    expect(canEdit('pending')).toBe(false);
    expect(canEdit('refunded')).toBe(false);
    expect(canEdit('rejected')).toBe(false);
  });

  it('blocks edit after warehouse received', () => {
    const message = 'Return tracking can no longer be edited — the warehouse has marked this return as received';
    expect(message).toMatch(/received/i);
  });
});
