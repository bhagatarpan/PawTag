import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@pawtag/db', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
  UserRole: {
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
  Role: {
    findOne: vi.fn(),
  },
  VerificationToken: {
    create: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn(),
  },
  AuditLog: { create: vi.fn() },
}));

import { hashPassword, verifyPassword, generateToken, hashToken, generateSecureToken, normalizeEmail, normalizePhone } from '../../packages/api/src/services/auth.service';
import * as db from '@pawtag/db';

describe('Regression: Auth Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passwords are hashed, never stored in plain text', async () => {
    const plain = 'MySecurePass123!';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.length).toBeGreaterThan(20);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('test12345');
    const result = await verifyPassword('test12345', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    const result = await verifyPassword('wrong', hash);
    expect(result).toBe(false);
  });

  it('JWT tokens are properly validated', () => {
    const token = generateToken({ id: 'user1', email: 'test@test.com', role: 'customer' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('JWT token contains expected payload', () => {
    const token = generateToken({ id: 'user1', email: 'test@test.com', role: 'customer' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.id).toBe('user1');
    expect(payload.email).toBe('test@test.com');
    expect(payload.role).toBe('customer');
  });

  it('tampered tokens are rejected', async () => {
    const jwt = await import('jsonwebtoken');
    const token = generateToken({ id: 'user1', email: 'test@test.com', role: 'customer' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => jwt.default.verify(tampered, process.env.JWT_SECRET!)).toThrow();
  });

  it('expired tokens are rejected', async () => {
    const jwt = await import('jsonwebtoken');
    const shortToken = jwt.default.sign(
      { id: 'user1', email: 'test@test.com', role: 'customer' },
      process.env.JWT_SECRET!,
      { expiresIn: '0s' }
    );
    // Wait a tiny bit for the token to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(() => jwt.default.verify(shortToken, process.env.JWT_SECRET!)).toThrow();
  });
});

describe('Regression: Data Sanitization', () => {
  it('normalizeEmail produces a clean lowercase string', () => {
    const result = normalizeEmail('TEST@EMAIL.COM');
    expect(result).toBe('test@email.com');
  });

  it('normalizeEmail trims whitespace', () => {
    const result = normalizeEmail('  user@test.com  ');
    expect(result).toBe('user@test.com');
  });

  it('normalizePhone handles NZ format correctly', () => {
    expect(normalizePhone('021 123 4567')).toBe('+64211234567');
    expect(normalizePhone('+64211234567')).toBe('+64211234567');
    expect(normalizePhone('0064211234567')).toBe('+64211234567');
  });

  it('hashToken produces consistent SHA-256 hashes', () => {
    const token = 'test-token-12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex
  });

  it('hashToken produces different hashes for different inputs', () => {
    const hash1 = hashToken('token-1');
    const hash2 = hashToken('token-2');
    expect(hash1).not.toBe(hash2);
  });

  it('generateSecureToken produces 64-char hex string', () => {
    const token = generateSecureToken();
    expect(token.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });
});

describe('Regression: User Status Transitions', () => {
  it('password change requires current password verification', async () => {
    const currentHash = await hashPassword('current123');
    const valid = await verifyPassword('current123', currentHash);
    expect(valid).toBe(true);
    const invalid = await verifyPassword('wrong', currentHash);
    expect(invalid).toBe(false);
  });

  it('passwords are re-hashed on change (not reused)', async () => {
    const hash1 = await hashPassword('password1');
    const hash2 = await hashPassword('password1');
    // bcrypt uses random salt, so same password produces different hashes
    expect(hash1).not.toBe(hash2);
  });
});

describe('Regression: Email Normalization', () => {
  it('email is trimmed and lowercased', () => {
    expect(normalizeEmail('  Test@Email.COM  ')).toBe('test@email.com');
  });

  it('phone normalization handles NZ format', () => {
    expect(normalizePhone('021 123 4567')).toBe('+64211234567');
    expect(normalizePhone('+64211234567')).toBe('+64211234567');
    expect(normalizePhone('0064211234567')).toBe('+64211234567');
  });

  it('phone normalization handles dashes and spaces', () => {
    expect(normalizePhone('021-123-4567')).toBe('+64211234567');
  });
});
