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
      const loggerModule = await import('../../packages/api/src/lib/logger');
      const loggerSpy = vi.spyOn(loggerModule.default, 'debug').mockImplementation(() => {});

      const { sendSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendSMS('+64211234567', 'Hello from PawTag');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_sms_/);
      // Should log via structured logger
      expect(loggerSpy).toHaveBeenCalled();
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

      const loggerModule = await import('../../packages/api/src/lib/logger');
      const loggerSpy = vi.spyOn(loggerModule.default, 'debug').mockImplementation(() => {});

      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendPhoneOtpSMS('+64219876543', '428160');

      expect(result.success).toBe(true);
      expect(CmsSmsTemplate.findOne).toHaveBeenCalledWith({
        slug: 'phone-otp',
        status: 'active',
        deletedAt: null,
      });
      // Should log via structured logger
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('falls back to default message when CMS template is null', async () => {
      const { CmsSmsTemplate } = await import('@pawtag/db');
      vi.mocked(CmsSmsTemplate.findOne).mockResolvedValue(null);

      const loggerModule = await import('../../packages/api/src/lib/logger');
      const loggerSpy = vi.spyOn(loggerModule.default, 'debug').mockImplementation(() => {});

      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendPhoneOtpSMS('+64215556666', '999000');

      expect(result.success).toBe(true);
      // Should log via structured logger
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('falls back to default message when CMS template query throws', async () => {
      const { CmsSmsTemplate } = await import('@pawtag/db');
      vi.mocked(CmsSmsTemplate.findOne).mockRejectedValue(new Error('DB connection failed'));

      const loggerModule = await import('../../packages/api/src/lib/logger');
      const loggerSpy = vi.spyOn(loggerModule.default, 'error').mockImplementation(() => {});

      const { sendPhoneOtpSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendPhoneOtpSMS('+64210001111', '555123');

      expect(result.success).toBe(true);
      // Should log error via structured logger
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('DemoSMSProvider', () => {
    it('logs via structured logger and returns success with demo messageId', async () => {
      const loggerModule = await import('../../packages/api/src/lib/logger');
      const loggerSpy = vi.spyOn(loggerModule.default, 'debug').mockImplementation(() => {});

      const { sendSMS } = await import('../../packages/api/src/services/sms.service');

      const result = await sendSMS('+64210000000', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_sms_/);
      // Should log via structured logger
      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
