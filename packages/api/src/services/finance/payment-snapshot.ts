/**
 * Best-effort payment card extraction from a Stripe PaymentIntent.
 *
 * Used at financial-document creation time to snapshot card brand/last4
 * onto the document so it is self-contained. NEVER throws — a Stripe
 * failure, fake/demo mode, or missing intent simply yields no card data;
 * document issuance must not depend on this lookup.
 */
import logger from '../../lib/logger';
import { isFakeMode, isFakePaymentIntentId } from '../../commerce/payment-mode';

export interface CardSnapshot {
  cardBrand?: string;
  cardLast4?: string;
}

export async function cardSnapshotFromPaymentIntent(paymentIntentId?: string | null): Promise<CardSnapshot> {
  if (!paymentIntentId) return {};
  if (isFakeMode() || isFakePaymentIntentId(paymentIntentId)) return {};
  try {
    const { stripePaymentProvider, extractCardDetailsFromStripeIntent } = await import(
      '../../commerce/providers/stripe'
    );
    const intent = await stripePaymentProvider.retrievePaymentIntent(paymentIntentId);
    return extractCardDetailsFromStripeIntent(intent as any);
  } catch (err) {
    logger.warn({ err, paymentIntentId }, 'Card snapshot skipped (best-effort)');
    return {};
  }
}
