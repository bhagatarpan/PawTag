import { describe, it, expect } from 'vitest';
import { sendCheckoutOtpSchema, verifyCheckoutOtpSchema } from '../../packages/api/src/middleware/schemas';

describe('Checkout OTP Schemas', () => {
  describe('sendCheckoutOtpSchema', () => {
    it('accepts valid email channel', () => {
      const result = sendCheckoutOtpSchema.safeParse({ channel: 'email' });
      expect(result.success).toBe(true);
    });

    it('accepts valid sms channel', () => {
      const result = sendCheckoutOtpSchema.safeParse({ channel: 'sms' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid channel', () => {
      const result = sendCheckoutOtpSchema.safeParse({ channel: 'phone' });
      expect(result.success).toBe(false);
    });

    it('rejects missing channel', () => {
      const result = sendCheckoutOtpSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('verifyCheckoutOtpSchema', () => {
    it('accepts valid email OTP', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'email', otp: '123456' });
      expect(result.success).toBe(true);
    });

    it('accepts valid sms OTP', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'sms', otp: '654321' });
      expect(result.success).toBe(true);
    });

    it('rejects OTP with wrong length', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'email', otp: '12345' });
      expect(result.success).toBe(false);
    });

    it('rejects OTP with non-numeric chars', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'email', otp: 'abcdef' });
      expect(result.success).toBe(false);
    });

    it('rejects missing OTP', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'email' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid channel', () => {
      const result = verifyCheckoutOtpSchema.safeParse({ channel: 'phone', otp: '123456' });
      expect(result.success).toBe(false);
    });
  });
});
