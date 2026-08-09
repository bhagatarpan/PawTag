import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  AuditEvent: {
    find: vi.fn(),
    aggregate: vi.fn(),
    countDocuments: vi.fn(async () => 0),
  },
  createAuditEventId: () => 'evt-redaction-test',
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deepRedact, isSensitiveField, redactValue, computeHash } from '../../packages/api/src/services/audit';

describe('audit redaction & hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts any field matching the sensitive patterns', () => {
    expect(isSensitiveField('password')).toBe(true);
    expect(isSensitiveField('passwordHash')).toBe(true);
    expect(isSensitiveField('accessToken')).toBe(true);
    expect(isSensitiveField('refresh_token')).toBe(true);
    expect(isSensitiveField('otp')).toBe(true);
    expect(isSensitiveField('mfaSecret')).toBe(true);
    expect(isSensitiveField('api_key')).toBe(true);
    expect(isSensitiveField('email')).toBe(false);
    expect(isSensitiveField('phoneNumber')).toBe(false);
    expect(isSensitiveField('name')).toBe(false);
  });

  it('redacts values at top level and nested paths', () => {
    const before = {
      fullName: 'John Doe',
      email: 'john@example.com',
      passwordHash: 'bogus-hash',
      preferences: {
        marketing: true,
        sessionToken: 'secret-session',
      },
      addresses: [{ line1: '1 Test St' }],
    };
    const red = deepRedact(before);
    expect(red.fullName).toBe('John Doe');
    expect(red.email).toBe('john@example.com');
    expect(red.passwordHash).toBe('[REDACTED]');
    expect(red.preferences.marketing).toBe(true);
    expect(red.preferences.sessionToken).toBe('[REDACTED]');
    expect(red.addresses[0].line1).toBe('1 Test St');
  });

  it('redactValue replaces sensitive scalar values', () => {
    expect(redactValue('supersecret', 'otp')).toBe('[REDACTED]');
    expect(redactValue('plain', 'displayName')).toBe('plain');
  });

  it('computeHash is deterministic and key-order independent', () => {
    const a = computeHash({ b: 2, a: 1 });
    const b = computeHash({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});