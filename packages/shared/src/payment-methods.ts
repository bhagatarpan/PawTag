// ============================================================
// Saved payment methods (multiple cards on Stripe Customer)
// ============================================================

export interface SavedPaymentMethod {
  id: string;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  isDefault: boolean;
}

export interface SavedPaymentMethodListResponse {
  success: boolean;
  data: SavedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  hasStripeCustomer: boolean;
}

export interface SetDefaultPaymentMethodBody {
  paymentMethodId: string;
}

export interface DetachPaymentMethodBody {
  paymentMethodId: string;
}

export interface SetupIntentResponseData {
  clientSecret: string;
  stripeCustomerId: string;
}

export interface ConfirmSavePaymentMethodResult {
  /** False when nothing is on the Stripe Customer (UI must not claim saved). */
  saved: boolean;
  defaultPaymentMethodId: string | null;
  data: SavedPaymentMethod[];
  reason?: string;
}

export interface ConfirmSavePaymentMethodBody {
  /** Optional explicit PM to promote to default. If omitted, first PM becomes default when none exists. */
  paymentMethodId?: string;
}

export const SAVED_PAYMENT_METHOD_ERROR_CODES = {
  NO_STRIPE_CUSTOMER: 'payment_method.no_stripe_customer',
  NOT_FOUND: 'payment_method.not_found',
  NOT_ATTACHED: 'payment_method.not_attached',
  IS_DEFAULT_LAST: 'payment_method.is_default_last_for_membership',
  MEMBERSHIP_REQUIRES_CARD: 'payment_method.membership_requires_card',
  STRIPE_ERROR: 'payment_method.stripe_error',
} as const;

export type SavedPaymentMethodErrorCode =
  (typeof SAVED_PAYMENT_METHOD_ERROR_CODES)[keyof typeof SAVED_PAYMENT_METHOD_ERROR_CODES];

export function formatSavedPaymentMethodLabel(pm: {
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
}): string {
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card';
  const last4 = pm.last4 ? `••••${pm.last4}` : '';
  const exp = pm.expMonth && pm.expYear ? ` (${pm.expMonth}/${pm.expYear})` : '';
  return `${brand} ${last4}${exp}`.trim();
}
