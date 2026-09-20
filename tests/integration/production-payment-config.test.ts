import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// We need to test the validateEnv function, but it's called at module load time.
// Instead, we test the validateProductionPaymentConfig logic directly by
// manipulating process.env and importing the module.

describe('Integration: Production Payment Configuration Guardrails', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to a safe baseline
    process.env.NODE_ENV = 'test';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('validateEnv accepts valid production config', () => {
    it('does not throw when all required production vars are set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test_key_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';
      process.env.PAYMENT_MODE = 'stripe_live';
      process.env.RESEND_API_KEY = 're_test_key_123';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('validateEnv rejects dangerous production config', () => {
    it('throws when STRIPE_SECRET_KEY is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';
      // STRIPE_SECRET_KEY is NOT set

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/STRIPE_SECRET_KEY is required/);
    });

    it('throws when STRIPE_SECRET_KEY is the demo key in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_test_demo_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/demo key/);
    });

    it('throws when STRIPE_SECRET_KEY is a test-mode key in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_test_abc123def456';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/test\/demo key/);
    });

    it('throws when STRIPE_WEBHOOK_SECRET is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test_key_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';
      // STRIPE_WEBHOOK_SECRET is NOT set

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/STRIPE_WEBHOOK_SECRET is required/);
    });

    it('throws when STRIPE_WEBHOOK_SECRET is a placeholder in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test_key_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/placeholder/);
    });

    it('throws when ALLOWED_ORIGINS is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test_key_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.FRONTEND_URL = 'https://app.pawtag.co.nz';
      // ALLOWED_ORIGINS is NOT set

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/ALLOWED_ORIGINS/);
    });

    it('throws when FRONTEND_URL is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/pawtag';
      process.env.JWT_SECRET = 'a-very-long-random-secret-key-for-testing';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test_key_12345';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_12345';
      process.env.ALLOWED_ORIGINS = 'https://app.pawtag.co.nz';
      // FRONTEND_URL is NOT set

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).toThrow(/FRONTEND_URL/);
    });
  });

  describe('validateEnv allows test/development mode with any config', () => {
    it('does not throw in development mode with no Stripe config', async () => {
      process.env.NODE_ENV = 'development';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).not.toThrow();
    });

    it('does not throw in test mode with no Stripe config', async () => {
      process.env.NODE_ENV = 'test';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).not.toThrow();
    });

    it('does not throw in development mode with demo Stripe key', async () => {
      process.env.NODE_ENV = 'development';
      process.env.STRIPE_SECRET_KEY = 'sk_test_demo_key';

      const { validateEnv } = await import('../../packages/api/src/config/validateEnv');
      expect(() => validateEnv()).not.toThrow();
    });
  });
});
