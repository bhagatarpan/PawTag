/**
 * Central Stripe client factory.
 *
 * ALL Stripe SDK construction must go through this module.
 * Do not call `new Stripe(...)` or read STRIPE_SECRET_KEY in feature code.
 *
 * Configuration:
 * - Secret key: STRIPE_SECRET_KEY (env; validated by payment-mode + validateEnv)
 * - API version: STRIPE_API_VERSION or @pawtag/shared STRIPE_DEFAULT_API_VERSION
 * - Mode: commerce/payment-mode (fake | stripe_test | stripe_live)
 *
 * Test injection:
 * - setStripeClientForTests(client) / resetStripeClientCache()
 */
import Stripe from 'stripe';
import { STRIPE_DEFAULT_API_VERSION } from '@pawtag/shared';
import { isFakeMode } from '../commerce/payment-mode';

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (_stripe) return _stripe;

  if (isFakeMode()) {
    throw new Error('Stripe client is not available when PAYMENT_MODE=fake');
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const apiVersion = process.env.STRIPE_API_VERSION?.trim() || STRIPE_DEFAULT_API_VERSION;

  _stripe = new Stripe(key, {
    apiVersion: apiVersion as Stripe.LatestApiVersion,
  });

  return _stripe;
}

/** Test helper — clear cached Stripe client after env/mocks change. */
export function resetStripeClientCache(): void {
  _stripe = null;
}

/** Test helper — inject a Stripe client without real API calls. */
export function setStripeClientForTests(client: Stripe | null): void {
  _stripe = client;
}

/** True when a Stripe client instance is already cached (diagnostics only). */
export function hasCachedStripeClient(): boolean {
  return _stripe !== null;
}
