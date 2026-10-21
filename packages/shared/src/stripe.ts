// ============================================================
// PawTag Stripe shared constants
// Single place for Stripe SDK pin + key prefixes. No scattered literals.
// ============================================================

/**
 * Stripe API version pinned for PawTag.
 * Override only via STRIPE_API_VERSION when a coordinated upgrade is required.
 */
export const STRIPE_DEFAULT_API_VERSION = '2026-08-26.dahlia';

export const STRIPE_KEY_PREFIXES = {
  secretTest: 'sk_test_',
  secretRestrictedTest: 'rk_test_',
  secretLive: 'sk_live_',
  secretRestrictedLive: 'rk_live_',
  publishableTest: 'pk_test_',
  publishableLive: 'pk_live_',
  demoSecret: 'sk_test_demo_key',
  webhook: 'whsec_',
} as const;

/** Demo sentinel keys must never be used outside local fake mode. */
export const STRIPE_DEMO_SECRET_KEY = STRIPE_KEY_PREFIXES.demoSecret;

export function isStripeTestSecretKey(key: string | undefined | null): boolean {
  if (!key) return false;
  return (
    key.startsWith(STRIPE_KEY_PREFIXES.secretTest) ||
    key.startsWith(STRIPE_KEY_PREFIXES.secretRestrictedTest)
  );
}

export function isStripeLiveSecretKey(key: string | undefined | null): boolean {
  if (!key) return false;
  return (
    key.startsWith(STRIPE_KEY_PREFIXES.secretLive) ||
    key.startsWith(STRIPE_KEY_PREFIXES.secretRestrictedLive)
  );
}

export function isStripeDemoSecretKey(key: string | undefined | null): boolean {
  return key === STRIPE_DEMO_SECRET_KEY;
}

export function isStripeDemoSubscriptionId(id: string | undefined | null): boolean {
  if (!id) return true;
  if (id === 'demo') return true;
  return id.startsWith('sub_demo') || id.startsWith('pi_demo_');
}

/** NZD is PawTag's default commerce currency for Stripe prices. */
export const STRIPE_DEFAULT_CURRENCY = 'nzd';

/**
 * Payment method types PawTag accepts on PaymentIntents and SetupIntents.
 *
 * Card-only by founder decision: Visa, Mastercard and American Express are
 * all accepted under Stripe's standard 'card' type (no per-brand config), and
 * Klarna/BNPL was deliberately removed from checkout. Restricting the types
 * server-side (not just in the Payment Element) means the method set is
 * server-authoritative — the client cannot surface or pay a method the server
 * did not offer.
 *
 * To re-enable a wallet or BNPL method later (e.g. 'apple_pay'), add it here
 * — one constant, no scattered literals.
 */
export const PAWTAG_PAYMENT_METHOD_TYPES = ['card'] as const;
