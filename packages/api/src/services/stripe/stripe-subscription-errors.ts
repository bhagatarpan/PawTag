/**
 * Shared classification for Stripe subscription provider failures.
 * Used by membership tier-change and gold plan billing — do not
 * re-implement per service.
 */
import logger from '../../lib/logger';

export type StripeSubscriptionFailureKind =
  | 'subscription_missing'
  | 'subscription_not_active'
  | 'subscription_invalid'
  | 'payment_method_required'
  | 'stripe_update_failed';

export interface ClassifiedStripeSubscriptionFailure {
  kind: StripeSubscriptionFailureKind;
  stripeCode?: string;
  stripeType?: string;
  message: string;
}

const PAYMENT_METHOD_CODES = new Set([
  'invoice.payment_method_required',
  'payment_method_required',
  'invoice_upcoming_requires_payment_method',
  'invoice.payment_intent_authentication_failure',
  'card_error',
  'expired_card',
  'incorrect_cvc',
]);

const MISSING_CODES = new Set(['resource_missing']);

export function classifyStripeSubscriptionFailure(err: unknown): ClassifiedStripeSubscriptionFailure {
  const e = err as { code?: string; type?: string; message?: string; status?: number };
  const stripeCode = e?.code || e?.type;
  const stripeType = e?.type;
  const message = e?.message || '';

  if (
    MISSING_CODES.has(stripeCode || '') ||
    /no such subscription/i.test(message) ||
    /resource_missing/i.test(message)
  ) {
    return {
      kind: 'subscription_missing',
      stripeCode,
      stripeType,
      message: 'Stripe subscription missing',
    };
  }

  if (
    /already ended/i.test(message) ||
    /canceled subscription/i.test(message) ||
    stripeCode === 'resource_missing' && /canceled/i.test(message)
  ) {
    return {
      kind: 'subscription_not_active',
      stripeCode,
      stripeType,
      message: 'Stripe subscription already ended',
    };
  }

  if (
    PAYMENT_METHOD_CODES.has(stripeCode || '') ||
    /payment method/i.test(message) ||
    /card was declined/i.test(message)
  ) {
    return {
      kind: 'payment_method_required',
      stripeCode,
      stripeType,
      message: 'Stripe requires a valid payment method',
    };
  }

  return {
    kind: 'stripe_update_failed',
    stripeCode,
    stripeType,
    message: message || 'Stripe subscription update failed',
  };
}

export function logStripeSubscriptionFailure(
  err: unknown,
  context: Record<string, unknown>,
  operation: string,
): ClassifiedStripeSubscriptionFailure {
  const classified = classifyStripeSubscriptionFailure(err);
  logger.error(
    {
      err: {
        type: classified.stripeType,
        code: classified.stripeCode,
        message: classified.message,
      },
      ...context,
      operation,
    },
    '[Stripe] Subscription operation failed',
  );
  return classified;
}

/** Demo/non-Stripe subscription IDs must never be sent to the Stripe API. */
export function isInvalidStripeSubscriptionId(id: string | undefined | null): boolean {
  if (!id) return true;
  if (id === 'demo') return true;
  if (id.startsWith('pi_demo_') || id.startsWith('sub_demo')) return true;
  return !id.startsWith('sub_');
}

export function stripeSubscriptionEnded(status: string | undefined | null): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}

export function firstSubscriptionItemId(subscription: {
  items?: { data?: Array<{ id?: string }> };
}): string | null {
  return subscription.items?.data?.[0]?.id || null;
}
