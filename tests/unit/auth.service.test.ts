import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

vi.mock('../../packages/api/src/config', () => ({
  config: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    otpExpiryMinutes: 10,
    emailTokenExpiryHours: 24,
    maxOtpAttempts: 5,
    maxResendCount: 3,
    resendCooldownSeconds: 60,
  },
}));

import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateOtp,
  generateSecureToken,
  hashToken,
  getOtpExpiryMinutes,
  getEmailTokenExpiryHours,
  getMaxOtpAttempts,
  getMaxResendCount,
  getResendCooldownSeconds,
  normalizeEmail,
  normalizePhone,
} from '../../packages/api/src/services/auth.service';

describe('auth.service', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash, not the plain text', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).not.toBe('mypassword');
      expect(hash).toMatch(/^\$2[aby]?\$/);
    });

    it('produces different hashes for different passwords', async () => {
      const h1 = await hashPassword('password1');
      const h2 = await hashPassword('password2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const hash = await hashPassword('correct');
      const result = await verifyPassword('correct', hash);
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('correct');
      const result = await verifyPassword('wrong', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('returns a valid JWT string', () => {
      const token = generateToken({ id: 'u1', email: 'test@test.com', role: 'user' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwt.verify(token, 'test-secret') as jwt.JwtPayload;
      expect(decoded.id).toBe('u1');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('user');
    });
  });

  describe('generateOtp', () => {
    it('returns a 6-digit string', () => {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    });

    it('generates values within range 100000-999999', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateOtp();
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('generateSecureToken', () => {
    it('returns a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique values each call', () => {
      const t1 = generateSecureToken();
      const t2 = generateSecureToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashToken', () => {
    it('produces a consistent SHA-256 hash', () => {
      const h1 = hashToken('test-token');
      const h2 = hashToken('test-token');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      const h1 = hashToken('token-a');
      const h2 = hashToken('token-b');
      expect(h1).not.toBe(h2);
    });
  });

  describe('config accessors', () => {
    it('getOtpExpiryMinutes returns config value', () => {
      expect(getOtpExpiryMinutes()).toBe(10);
    });

    it('getEmailTokenExpiryHours returns config value', () => {
      expect(getEmailTokenExpiryHours()).toBe(24);
    });

    it('getMaxOtpAttempts returns config value', () => {
      expect(getMaxOtpAttempts()).toBe(5);
    });

    it('getMaxResendCount returns config value', () => {
      expect(getMaxResendCount()).toBe(3);
    });

    it('getResendCooldownSeconds returns config value', () => {
      expect(getResendCooldownSeconds()).toBe(60);
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });

    it('leaves already normalized email unchanged', () => {
      expect(normalizeEmail('user@host.com')).toBe('user@host.com');
    });
  });

  describe('normalizePhone', () => {
    it('converts NZ local 021 to +6421', () => {
      expect(normalizePhone('0211234567')).toBe('+64211234567');
    });

    it('keeps +6421 format unchanged', () => {
      expect(normalizePhone('+64211234567')).toBe('+64211234567');
    });

    it('converts 0064 to +64', () => {
      expect(normalizePhone('0064211234567')).toBe('+64211234567');
    });

    it('strips spaces, dashes, parens', () => {
      expect(normalizePhone('(021) 123-4567')).toBe('+64211234567');
    });

    it('prepends + if no leading 0 or +', () => {
      expect(normalizePhone('64211234567')).toBe('+64211234567');
    });
  });
});
