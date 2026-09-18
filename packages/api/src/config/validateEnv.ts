import logger from '../lib/logger';

const REQUIRED_IN_PRODUCTION = ['DB_URL', 'JWT_SECRET'] as const;

const RECOMMENDED = ['BOOTSTRAP_ADMIN_PASSWORD', 'STRIPE_SECRET_KEY', 'ADMIN_ALERT_EMAIL'] as const;

/**
 * Validate that production payment configuration is safe.
 *
 * A production process must never silently treat a fake/demo payment as
 * a successful real payment. This function validates critical payment
 * configuration at startup.
 *
 * @returns Array of fatal errors (empty if config is safe)
 */
function validateProductionPaymentConfig(): string[] {
  const errors: string[] = [];

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  // 1. Require STRIPE_SECRET_KEY in production
  if (!stripeKey) {
    errors.push(
      'STRIPE_SECRET_KEY is required in production. ' +
      'Set it to your live Stripe secret key before starting the server.'
    );
  }

  // 2. Reject demo/test keys in production
  if (stripeKey === 'sk_test_demo_key') {
    errors.push(
      'STRIPE_SECRET_KEY is set to the demo key "sk_test_demo_key" which is not safe for production. ' +
      'Set it to your live Stripe secret key (starts with sk_live_).'
    );
  }

  // 3. Reject test-mode keys in production (sk_test_ prefix)
  if (stripeKey && stripeKey.startsWith('sk_test_') && stripeKey !== 'sk_test_demo_key') {
    errors.push(
      `STRIPE_SECRET_KEY appears to be a Stripe test-mode key (${stripeKey.substring(0, 12)}...). ` +
      'Test-mode keys must not be used in production. Set it to your live Stripe secret key (starts with sk_live_).'
    );
  }

  // 4. Require STRIPE_WEBHOOK_SECRET in production
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    errors.push(
      'STRIPE_WEBHOOK_SECRET is required in production. ' +
      'Set it to your Stripe webhook signing secret before starting the server.'
    );
  }

  // 5. Reject placeholder webhook secrets
  if (webhookSecret && (webhookSecret === 'whsec_test' || webhookSecret === 'whsec_demo')) {
    errors.push(
      'STRIPE_WEBHOOK_SECRET appears to be a placeholder value. ' +
      'Set it to your actual Stripe webhook signing secret.'
    );
  }

  // 6. Validate ALLOWED_ORIGINS is not empty in production
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) {
    errors.push(
      'ALLOWED_ORIGINS is not set in production. ' +
      'Set it to a comma-separated list of allowed frontend origins.'
    );
  }

  // 7. Validate FRONTEND_URL is set in production
  if (!process.env.FRONTEND_URL) {
    errors.push(
      'FRONTEND_URL is not set in production. ' +
      'Set it to the customer-facing URL (e.g., https://app.pawtag.co.nz).'
    );
  }

  return errors;
}

export function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const missingRequired: string[] = [];
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) {
      missingRequired.push(key);
    }
  }

  if (nodeEnv === 'production' && missingRequired.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missingRequired.join(', ')}.\n` +
      `Set them before starting the server. See docs/environments.md for details.`
    );
  }

  if (nodeEnv !== 'production') {
    for (const key of missingRequired) {
      logger.warn({ variable: key, environment: nodeEnv }, `Config: ${key} is not set — using defaults`);
    }
  }

  // Production payment configuration validation
  if (nodeEnv === 'production') {
    const paymentErrors = validateProductionPaymentConfig();
    if (paymentErrors.length > 0) {
      const message = [
        'FATAL: Production payment configuration is invalid.',
        'PawTag must not start with unsafe payment configuration.',
        '',
        ...paymentErrors.map((e, i) => `  ${i + 1}. ${e}`),
        '',
        'Fix these issues before starting the server.',
      ].join('\n');
      throw new Error(message);
    }
    logger.info('Production payment configuration validated');
  }

  const missingRecommended: string[] = [];
  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      missingRecommended.push(key);
    }
  }

  if (missingRecommended.length > 0) {
    logger.warn({ variables: missingRecommended }, 'Config: Optional but recommended variables not set');
  }
}
