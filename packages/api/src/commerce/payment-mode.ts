/**
 * @module PaymentMode
 * @description Single source of truth for payment environment mode.
 *
 * Replaces the scattered `sk_test_demo_key` sentinel checks with
 * one explicit, resolvable enum.
 *
 * Resolution order:
 *   1. PAYMENT_MODE env var (explicit override)
 *   2. Derive from STRIPE_SECRET_KEY prefix if PAYMENT_MODE is not set
 *   3. Fall back to 'fake' if no Stripe key is present
 *
 * Rules enforced elsewhere (validateEnv, startup assertions):
 *   - NODE_ENV=production requires PAYMENT_MODE=stripe_live
 *   - fake is blocked from production
 */

export type PaymentMode = 'fake' | 'stripe_test' | 'stripe_live';

const VALID_MODES: readonly PaymentMode[] = ['fake', 'stripe_test', 'stripe_live'] as const;

/**
 * Resolve the current payment mode from environment.
 *
 * This function is pure — it reads only process.env and returns
 * a deterministic result. No DB access, no side effects.
 */
export function resolvePaymentMode(): PaymentMode {
  const explicit = process.env.PAYMENT_MODE?.trim().toLowerCase();

  if (explicit) {
    if (isValidPaymentMode(explicit)) {
      return explicit;
    }
    // Invalid explicit value — log and fall through to derivation
    console.error(
      `[PaymentMode] Invalid PAYMENT_MODE="${process.env.PAYMENT_MODE}". ` +
      `Valid values: ${VALID_MODES.join(', ')}. Falling back to key-based detection.`
    );
  }

  // Derive from Stripe key
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_demo_key') {
    return 'fake';
  }
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) {
    return 'stripe_test';
  }
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    return 'stripe_live';
  }

  // Unknown key prefix — treat as fake for safety
  return 'fake';
}

/**
 * Check if a string is a valid PaymentMode value.
 */
export function isValidPaymentMode(value: string): value is PaymentMode {
  return (VALID_MODES as readonly string[]).includes(value);
}

/**
 * Check if we are in fake (local dev) mode.
 * In fake mode, no real Stripe API calls are made.
 */
export function isFakeMode(): boolean {
  return resolvePaymentMode() === 'fake';
}

/**
 * Check if we are in Stripe test mode.
 * In test mode, real Stripe Test API calls are made.
 */
export function isStripeTestMode(): boolean {
  return resolvePaymentMode() === 'stripe_test';
}

/**
 * Check if we are in Stripe live mode.
 * In live mode, real Stripe Live API calls are made.
 */
export function isStripeLiveMode(): boolean {
  return resolvePaymentMode() === 'stripe_live';
}

/**
 * Check if we are in any Stripe mode (test or live).
 * When true, Stripe.js should be mounted on the frontend.
 */
export function isStripeEnabled(): boolean {
  const mode = resolvePaymentMode();
  return mode === 'stripe_test' || mode === 'stripe_live';
}

/**
 * Check if a payment intent ID is a fake/demo ID.
 * Used to guard operations that should not touch real Stripe.
 */
export function isFakePaymentIntentId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.startsWith('pi_demo_') || id.startsWith('re_demo_');
}

/**
 * Get a human-readable label for the current payment mode.
 * Useful for logging, health endpoints, and admin dashboards.
 */
export function getPaymentModeLabel(mode?: PaymentMode): string {
  const m = mode ?? resolvePaymentMode();
  switch (m) {
    case 'fake': return 'Fake (local development only)';
    case 'stripe_test': return 'Stripe Test (real test API)';
    case 'stripe_live': return 'Stripe Live (production)';
    default: return 'Unknown';
  }
}
