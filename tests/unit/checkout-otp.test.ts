import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOtp, hashToken } from '../../packages/api/src/services/auth.service';

describe('Checkout OTP', () => {
  describe('generateOtp', () => {
    it('generates a 6-digit string', () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('generates different OTPs on successive calls', () => {
      const otps = new Set(Array.from({ length: 100 }, () => generateOtp()));
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  describe('hashToken', () => {
    it('returns a 64-character hex string', () => {
      const hash = hashToken('123456');
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('is deterministic', () => {
      const h1 = hashToken('123456');
      const h2 = hashToken('123456');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', () => {
      const h1 = hashToken('111111');
      const h2 = hashToken('222222');
      expect(h1).not.toBe(h2);
    });
  });
});
