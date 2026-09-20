/**
 * @module Environment Validation
 * @description Authoritative environment configuration validation for PawTag.
 *
 * Validates all environment variables at startup and categorizes them as:
 * - Required in production (must be set or server refuses to start)
 * - Required when feature enabled (must be set if feature is active)
 * - Optional (safe defaults exist)
 *
 * This module is the single source of truth for environment validation.
 * Do not scatter `process.env.X || unsafeDefault` elsewhere.
 */

import logger from '../lib/logger';
import { isValidPaymentMode } from '../commerce/payment-mode';

// ─── Variable Categories ───────────────────────────────────────────────────

/**
 * Always required in production.
 * Server will not start without these.
 */
const ALWAYS_REQUIRED = [
  'DB_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'FRONTEND_URL',
] as const;

/**
 * Required when feature is enabled.
 * Server warns in dev, fails in production if missing.
 */
const FEATURE_REQUIRED = {
  payments: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const,
  email: ['RESEND_API_KEY'] as const,
  sms: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const,
  storage: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'] as const,
  push: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const,
  monitoring: ['SENTRY_DSN'] as const,
} as const;

/**
 * Optional variables with safe defaults.
 * These are documented but never cause startup failure.
 */
const OPTIONAL = [
  'PORT',
  'LOG_LEVEL',
  'JWT_ACCESS_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN_DAYS',
  'ADMIN_URL',
  'FINDER_URL',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'OTP_EXPIRY_MINUTES',
  'EMAIL_TOKEN_EXPIRY_HOURS',
  'MAX_OTP_ATTEMPTS',
  'MAX_RESEND_COUNT',
  'RESEND_COOLDOWN_SECONDS',
  'RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_MAX',
  'LOGIN_RATE_LIMIT_MAX',
  'REGISTER_RATE_LIMIT_MAX',
  'FORGOT_PASSWORD_RATE_LIMIT_MAX',
  'SUPPORT_RATE_LIMIT_MAX',
  'RESEND_API_KEY',
  'STORAGE_DRIVER',
  'LOCAL_UPLOADS_DIR',
  'SHIPPING_PROVIDER_API_KEY',
  'SMS_PROVIDER',
  'ADMIN_ALERT_EMAIL',
  'SERVICE_NAME',
  'SERVICE_VERSION',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_SAMPLE_RATE',
  'OTEL_CONSOLE_EXPORTER',
  'SENTRY_SAMPLE_RATE',
  'SENTRY_TRACES_SAMPLE_RATE',
  'PAWTAG_WORKER_ROLE',
] as const;

// ─── Validation Functions ───────────────────────────────────────────────────

/**
 * Check if Stripe key is a test/demo key (unsafe for production).
 */
function isUnsafeStripeKey(key: string | undefined): boolean {
  if (!key) return false;
  return key === 'sk_test_demo_key' || key.startsWith('sk_test_');
}

/**
 * Check if webhook secret is a placeholder.
 */
function isPlaceholderWebhookSecret(secret: string | undefined): boolean {
  if (!secret) return false;
  return secret === 'whsec_test' || secret === 'whsec_demo';
}

/**
 * Validate always-required variables.
 */
function validateAlwaysRequired(nodeEnv: string): string[] {
  const errors: string[] = [];

  for (const key of ALWAYS_REQUIRED) {
    if (!process.env[key]) {
      if (nodeEnv === 'production') {
        errors.push(`${key} is required in production. Set it before starting the server.`);
      } else {
        logger.warn({ variable: key, environment: nodeEnv }, `Config: ${key} is not set`);
      }
    }
  }

  return errors;
}

/**
 * Validate feature-required variables.
 */
function validateFeatureRequired(nodeEnv: string): string[] {
  const errors: string[] = [];

  // Payments - always required in production
  if (nodeEnv === 'production') {
    // Validate PAYMENT_MODE is explicitly set and valid
    const paymentMode = process.env.PAYMENT_MODE?.trim().toLowerCase();
    if (!paymentMode) {
      errors.push(
        'PAYMENT_MODE is required in production. Set it to "stripe_live". ' +
        'Valid values: fake, stripe_test, stripe_live.'
      );
    } else if (!isValidPaymentMode(paymentMode)) {
      errors.push(
        `PAYMENT_MODE="${process.env.PAYMENT_MODE}" is invalid. ` +
        'Valid values: fake, stripe_test, stripe_live.'
      );
    } else if (paymentMode !== 'stripe_live') {
      errors.push(
        `PAYMENT_MODE="${paymentMode}" is not allowed in production. ` +
        'Production requires PAYMENT_MODE=stripe_live.'
      );
    }

    for (const key of FEATURE_REQUIRED.payments) {
      if (!process.env[key]) {
        errors.push(`${key} is required in production when payments are enabled.`);
      }
    }

    // Validate Stripe key is not test/demo
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (isUnsafeStripeKey(stripeKey)) {
      errors.push(
        'STRIPE_SECRET_KEY is set to a test/demo key. ' +
        'Production must use a live Stripe key (starts with sk_live_).'
      );
    }

    // Validate webhook secret is not placeholder
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (isPlaceholderWebhookSecret(webhookSecret)) {
      errors.push(
        'STRIPE_WEBHOOK_SECRET is set to a placeholder value. ' +
        'Set it to your actual Stripe webhook signing secret.'
      );
    }
  }

  // Email - required in production (Resend provider)
  for (const key of FEATURE_REQUIRED.email) {
    if (!process.env[key]) {
      if (nodeEnv === 'production') {
        errors.push(`${key} is required in production. Email provider (Resend) must be configured.`);
      } else {
        logger.warn({ variable: key }, `Config: ${key} is not set — emails will be simulated in development`);
      }
    }
  }

  // SMS - warn if not set
  const smsProvider = process.env.SMS_PROVIDER;
  if (smsProvider === 'twilio') {
    for (const key of FEATURE_REQUIRED.sms) {
      if (!process.env[key]) {
        errors.push(`${key} is required when SMS_PROVIDER=twilio.`);
      }
    }
  }

  // Storage - warn if R2 selected but not configured
  const storageDriver = process.env.STORAGE_DRIVER;
  if (storageDriver === 'r2') {
    for (const key of FEATURE_REQUIRED.storage) {
      if (!process.env[key]) {
        errors.push(`${key} is required when STORAGE_DRIVER=r2.`);
      }
    }
  }

  // Push - warn if not set
  for (const key of FEATURE_REQUIRED.push) {
    if (!process.env[key]) {
      if (nodeEnv === 'production') {
        logger.warn({ variable: key }, `Config: ${key} is not set — push notifications may not work`);
      }
    }
  }

  return errors;
}

/**
 * Validate URL formats.
 */
function validateUrls(nodeEnv: string): string[] {
  const errors: string[] = [];

  const urls = [
    { key: 'FRONTEND_URL', required: true },
    { key: 'ADMIN_URL', required: false },
    { key: 'FINDER_URL', required: false },
  ];

  for (const { key, required } of urls) {
    const value = process.env[key];
    if (!value) {
      if (required && nodeEnv === 'production') {
        errors.push(`${key} is required in production.`);
      }
      continue;
    }

    // Basic URL validation
    try {
      new URL(value);
    } catch {
      errors.push(`${key} is not a valid URL: ${value}`);
    }
  }

  return errors;
}

// ─── Main Validation ────────────────────────────────────────────────────────

/**
 * Validate all environment variables.
 * Throws in production if critical variables are missing.
 * Warns in development for missing variables.
 */
export function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const errors: string[] = [];

  // 1. Validate always-required variables
  errors.push(...validateAlwaysRequired(nodeEnv));

  // 2. Validate feature-required variables
  errors.push(...validateFeatureRequired(nodeEnv));

  // 3. Validate URL formats
  errors.push(...validateUrls(nodeEnv));

  // 4. Throw if production has errors
  if (nodeEnv === 'production' && errors.length > 0) {
    const message = [
      'FATAL: Production environment configuration is invalid.',
      'PawTag must not start with missing or invalid configuration.',
      '',
      'Errors:',
      ...errors.map((e, i) => `  ${i + 1}. ${e}`),
      '',
      'Fix these issues before starting the server.',
      'See packages/api/.env.example for reference.',
    ].join('\n');
    throw new Error(message);
  }

  // 5. Log summary
  if (errors.length === 0) {
    logger.info('Environment configuration validated');
  } else {
    logger.warn({ errors }, 'Environment configuration has warnings');
  }
}

/**
 * Get a summary of all environment variables and their status.
 * Useful for debugging and health checks.
 */
export function getEnvSummary(): Record<string, { set: boolean; required: boolean; category: string }> {
  const summary: Record<string, { set: boolean; required: boolean; category: string }> = {};

  // Always required
  for (const key of ALWAYS_REQUIRED) {
    summary[key] = {
      set: !!process.env[key],
      required: true,
      category: 'always-required',
    };
  }

  // Feature required
  for (const [feature, keys] of Object.entries(FEATURE_REQUIRED)) {
    for (const key of keys) {
      summary[key] = {
        set: !!process.env[key],
        required: feature === 'payments', // Only payments is always required in prod
        category: `feature-required:${feature}`,
      };
    }
  }

  // Optional
  for (const key of OPTIONAL) {
    summary[key] = {
      set: !!process.env[key],
      required: false,
      category: 'optional',
    };
  }

  return summary;
}
