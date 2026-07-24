import { vi, afterEach } from 'vitest';

// Global test cleanup
afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress console.error in tests unless DEBUG is set
if (!process.env.DEBUG) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
}

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DB_URL = 'mongodb://localhost:27017/test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.OTP_EXPIRY_MINUTES = '10';
process.env.EMAIL_TOKEN_EXPIRY_HOURS = '24';
process.env.MAX_OTP_ATTEMPTS = '5';
process.env.MAX_RESEND_COUNT = '3';
process.env.RESEND_COOLDOWN_SECONDS = '60';
process.env.SMS_PROVIDER = 'demo';
process.env.RATE_LIMIT_MAX = '10000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
