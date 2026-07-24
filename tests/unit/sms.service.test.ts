import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock @pawtag/db CmsSmsTemplate ────────────────────────────────
vi.mock('@pawtag/db', () => ({
  CmsSmsTemplate: {
    findOne: vi.fn(),
  },
}));

const originalEnv = { ...process.env };

describe('sms.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv, SMS_PROVIDER: 'demo' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendSMS', () => {
    it('delegates to the configured provider and returns success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendSMS('+64211234567', 'Hello from PawTag');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_sms_/);
      const logOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(logOutput).toContain('DEMO SMS');
      expect(logOutput).toContain('+64211234567');
      expect(logOutput).toContain('Hello from PawTag');
    });
  });

  describe('sendPhoneOtpSMS', () => {
    it('uses CMS template when available', async () => {
      const { CmsSmsTemplate } = await import('@pawtag/db');
      vi.mocked(CmsSmsTemplate.findOne).mockResolvedValue({
        message: 'Your code is {{otp}}. Do not share.',
        slug: 'phone-otp',
        status: 'active',
      } as any);

      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await sendPhoneOtpSMS('+64219876543', '428160');

      expect(result.success).toBe(true);
      expect(CmsSmsTemplate.findOne).toHaveBeenCalledWith({
        slug: 'phone-otp',
        status: 'active',
        deletedAt: null,
      });
      // The rendered message should have the OTP replaced
      const logOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(logOutput).toContain('428160');
    });

    it('falls back to default message when CMS template is null', async () => {
      const { CmsSmsTemplate } = await import('@pawtag/db');
      vi.mocked(CmsSmsTemplate.findOne).mockResolvedValue(null);

      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await sendPhoneOtpSMS('+64215556666', '999000');

      expect(result.success).toBe(true);
      const logOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(logOutput).toContain('999000');
      expect(logOutput).toContain('PawTag verification code');
      expect(logOutput).toContain('expires in 10 minutes');
    });

    it('falls back to default message when CMS template query throws', async () => {
      const { CmsSmsTemplate } = await import('@pawtag/db');
      vi.mocked(CmsSmsTemplate.findOne).mockRejectedValue(new Error('DB connection failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendPhoneOtpSMS('+64210001111', '555123');

      expect(result.success).toBe(true);
      const logOutput = consoleErrorSpy.mock.calls.flat().join('\n');
      expect(logOutput).toContain('CMS SMS template');
      expect(logOutput).toContain('fetch failed');
    });
  });

  describe('DemoSMSProvider', () => {
    it('logs to console and returns success with demo messageId', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendSMS('+64210000000', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_sms_/);
      const logOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(logOutput).toContain('📱 [DEMO SMS]');
      expect(logOutput).toContain('Test message');
    });
  });
});
