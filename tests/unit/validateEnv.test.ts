/**
 * @module Environment Validation Tests
 * @description Unit tests for the environment validation module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv, getEnvSummary } from '../../packages/api/src/config/validateEnv';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.DB_URL;
    delete process.env.JWT_SECRET;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should pass in development with minimal config', () => {
      process.env.NODE_ENV = 'development';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should throw in production if DB_URL is missing', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_real123';

      expect(() => validateEnv()).toThrow(/DB_URL/);
    });

    it('should throw in production if JWT_SECRET is missing', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_real123';

      expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('should throw in production if STRIPE_SECRET_KEY is missing', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';

      expect(() => validateEnv()).toThrow(/STRIPE_SECRET_KEY/);
    });

    it('should throw in production if STRIPE_SECRET_KEY is test key', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.STRIPE_SECRET_KEY = 'sk_test_demo_key';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

      expect(() => validateEnv()).toThrow(/test\/demo key/);
    });

    it('should throw in production if STRIPE_WEBHOOK_SECRET is placeholder', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

      expect(() => validateEnv()).toThrow(/placeholder/);
    });

    it('should pass in production with all required config', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_real123';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should throw if FRONTEND_URL is invalid', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      process.env.FRONTEND_URL = 'not-a-url';
      process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_real123';

      expect(() => validateEnv()).toThrow(/not a valid URL/);
    });
  });

  describe('getEnvSummary', () => {
    it('should return summary of all variables', () => {
      process.env.DB_URL = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'test-secret';

      const summary = getEnvSummary();

      expect(summary).toHaveProperty('DB_URL');
      expect(summary).toHaveProperty('JWT_SECRET');
      expect(summary).toHaveProperty('STRIPE_SECRET_KEY');
      expect(summary.DB_URL.set).toBe(true);
      expect(summary.DB_URL.required).toBe(true);
      expect(summary.DB_URL.category).toBe('always-required');
    });

    it('should mark unset variables correctly', () => {
      const summary = getEnvSummary();

      expect(summary.DB_URL.set).toBe(false);
    });
  });
});
