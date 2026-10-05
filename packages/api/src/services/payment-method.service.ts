/**
 * Saved payment methods on Stripe Customer (multiple cards + one default).
 *
 * Source of truth: Stripe Customer PaymentMethods.
 * Never store raw PAN/CVC. Display only brand/last4/expiry.
 */
import { User, UserMembership } from '@pawtag/db';
import {
  SAVED_PAYMENT_METHOD_ERROR_CODES,
  type SavedPaymentMethod,
  type SavedPaymentMethodErrorCode,
} from '@pawtag/shared';
import { isFakeMode } from '../commerce/payment-mode';
import { getStripeClient } from '../lib/stripe-client';
import { systemAuditContext } from '../lib/app-meta';
import { auditService } from './audit';
import logger from '../lib/logger';

export class PaymentMethodError extends Error {
  readonly membershipCode: SavedPaymentMethodErrorCode;
  readonly httpStatus: number;

  constructor(
    membershipCode: SavedPaymentMethodErrorCode,
    message: string,
    userMessage: string,
    httpStatus = 400,
  ) {
    super(message);
    this.name = 'PaymentMethodError';
    this.membershipCode = membershipCode;
    this.httpStatus = httpStatus;
    this.message = userMessage;
  }
}

async function auditPaymentMethodEvent(
  action: string,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await auditService.log(systemAuditContext('SERVICE', { actorId: userId, actorUsername: userId }), {
      action,
      eventType: `payment_method.${action}`,
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'PaymentMethod',
      resourceId: String(metadata.paymentMethodId || ''),
      subjectUserId: userId,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata,
    });
  } catch (err) {
    logger.error({ err, userId, action }, '[PaymentMethod] audit failed');
  }
}

export async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('stripeCustomerId').lean();
  return user?.stripeCustomerId || null;
}

async function resolveDefaultPaymentMethodId(
  stripeCustomerId: string,
  paymentMethods: any[],
): Promise<string | null> {
  const stripe = getStripeClient();
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    const invoiceDefault = (customer as any)?.invoice_settings?.default_payment_method;
    if (typeof invoiceDefault === 'string' && invoiceDefault) return invoiceDefault;
    if (invoiceDefault && typeof invoiceDefault === 'object' && (invoiceDefault as any).id) {
      return (invoiceDefault as any).id;
    }
  } catch (err) {
    logger.warn({ err, stripeCustomerId }, '[PaymentMethod] failed to read invoice_settings default');
  }

  if (paymentMethods.length === 1) return String(paymentMethods[0].id);
  return null;
}

export async function listSavedPaymentMethods(userId: string): Promise<{
  data: SavedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  hasStripeCustomer: boolean;
}> {
  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    return { data: [], defaultPaymentMethodId: null, hasStripeCustomer: Boolean(stripeCustomerId) };
  }

  const stripe = getStripeClient();
  const listed = await stripe.customers.listPaymentMethods(stripeCustomerId, { type: 'card' });
  const defaultId = await resolveDefaultPaymentMethodId(stripeCustomerId, listed.data || []);

  const data: SavedPaymentMethod[] = (listed.data || []).map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand || null,
    last4: pm.card?.last4 || null,
    expMonth: pm.card?.exp_month || null,
    expYear: pm.card?.exp_year || null,
    isDefault: defaultId ? pm.id === defaultId : listed.data.length === 1,
  }));

  return { data, defaultPaymentMethodId: defaultId, hasStripeCustomer: true };
}

/**
 * First valid PM id when a default exists but Stripe default is missing.
 */
export async function getDefaultPaymentMethodIdForUser(userId: string): Promise<string | null> {
  const { defaultPaymentMethodId, data } = await listSavedPaymentMethods(userId);
  if (defaultPaymentMethodId) return defaultPaymentMethodId;
  const def = data.find((p) => p.isDefault) || data[0];
  return def?.id || null;
}

export async function createSetupIntentForUser(userId: string): Promise<{
  clientSecret: string;
  stripeCustomerId: string;
}> {
  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId) {
    const user = await User.findById(userId).select('email fullName').lean();
    if (!user) {
      throw new PaymentMethodError(
        SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
        'User not found',
        'Account not found',
        404,
      );
    }
    if (isFakeMode()) {
      throw new PaymentMethodError(
        SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
        'Stripe not configured in fake mode',
        'Payment methods are not available in demo mode.',
        400,
      );
    }
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName || undefined,
      metadata: { userId: userId.toString(), source: 'pawtag-payment-methods' },
    });
    await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
    return createSetupIntentForUser(userId);
  }

  if (isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'Stripe not configured in fake mode',
      'Payment methods are not available in demo mode.',
      400,
    );
  }

  const stripe = getStripeClient();
  const intent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: 'off_session',
    payment_method_types: ['card'],
    metadata: { userId: userId.toString(), purpose: 'save_payment_method' },
  });

  if (!intent.client_secret) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      'SetupIntent missing client secret',
      'Unable to start adding a payment method. Please try again.',
      502,
    );
  }

  await auditPaymentMethodEvent('setup_intent_created', userId, {
    setupIntentId: intent.id,
    stripeCustomerId,
  });

  return { clientSecret: intent.client_secret, stripeCustomerId };
}

export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<SavedPaymentMethod[]> {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Invalid payment method id',
      'Payment method not found.',
    );
  }

  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'No Stripe customer',
      'No payment methods on file.',
      400,
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (err: any) {
    logger.error({ err, userId, paymentMethodId }, '[PaymentMethod] set default failed');
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      err?.message || 'Stripe set default failed',
      'Unable to set default payment method. Please try again.',
      502,
    );
  }

  // Best-effort: also set on active membership subscription default
  try {
    const membership = await UserMembership.findOne({ userId, status: 'active' }).lean();
    if (membership?.stripeSubscriptionId) {
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
  } catch (err) {
    logger.warn({ err, userId }, '[PaymentMethod] failed to set subscription default (non-fatal)');
  }

  await auditPaymentMethodEvent('default_changed', userId, { paymentMethodId, stripeCustomerId });

  const { data } = await listSavedPaymentMethods(userId);
  return data;
}

export async function detachPaymentMethod(userId: string, paymentMethodId: string): Promise<SavedPaymentMethod[]> {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Invalid payment method id',
      'Payment method not found.',
    );
  }

  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'No Stripe customer',
      'No payment methods on file.',
      400,
    );
  }

  const list = await listSavedPaymentMethods(userId);
  const target = list.data.find((p) => p.id === paymentMethodId);
  if (!target) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Payment method not found for customer',
      'Payment method not found.',
      404,
    );
  }

  const remaining = list.data.filter((p) => p.id !== paymentMethodId);
  const membership = await UserMembership.findOne({ userId, status: 'active' }).lean();
  const membershipRequiresCard = Boolean(membership?.autoRenew);

  if (target.isDefault && membershipRequiresCard && remaining.length === 0) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.MEMBERSHIP_REQUIRES_CARD,
      'Cannot remove last payment method while membership requires billing',
      'Your membership needs a payment method for renewals. Add another card before removing this one.',
      409,
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch (err: any) {
    logger.error({ err, userId, paymentMethodId }, '[PaymentMethod] detach failed');
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      err?.message || 'Stripe detach failed',
      'Unable to remove payment method. Please try again.',
      502,
    );
  }

  // If removed default and others remain, promote first remaining (deterministic)
  if (target.isDefault && remaining.length > 0) {
    try {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: remaining[0].id },
      });
      await auditPaymentMethodEvent('default_changed', userId, {
        paymentMethodId: remaining[0].id,
        reason: 'default_removed',
        stripeCustomerId,
      });
    } catch (err) {
      logger.warn({ err, userId }, '[PaymentMethod] failed to promote new default after detach');
    }
  }

  await auditPaymentMethodEvent('removed', userId, { paymentMethodId, stripeCustomerId });

  const { data } = await listSavedPaymentMethods(userId);
  return data;
}

/**
 * Post-purchase confirm-save: promote first PM to default only when PMs exist.
 * Never reports success when nothing is on file.
 */
export async function confirmSavePaymentMethod(
  userId: string,
  paymentMethodId?: string,
): Promise<{
  saved: boolean;
  defaultPaymentMethodId: string | null;
  data: SavedPaymentMethod[];
  reason?: string;
}> {
  const list = await listSavedPaymentMethods(userId);
  if (list.data.length === 0) {
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      saved: false,
      reason: 'no_payment_methods_on_stripe_customer',
    });
    return {
      saved: false,
      defaultPaymentMethodId: null,
      data: [],
      reason: 'no_payment_methods',
    };
  }

  const targetId = paymentMethodId || list.defaultPaymentMethodId || list.data[0]?.id;
  if (!targetId) {
    return { saved: false, defaultPaymentMethodId: null, data: list.data, reason: 'no_target' };
  }

  if (list.defaultPaymentMethodId && list.defaultPaymentMethodId === targetId) {
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      paymentMethodId: targetId,
      alreadyDefault: true,
      saved: true,
    });
    return {
      saved: true,
      defaultPaymentMethodId: list.defaultPaymentMethodId,
      data: list.data,
    };
  }

  if (!list.defaultPaymentMethodId) {
    const data = await setDefaultPaymentMethod(userId, targetId);
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      paymentMethodId: targetId,
      becameDefault: true,
      saved: true,
    });
    return { saved: true, defaultPaymentMethodId: targetId, data };
  }

  // Default already exists — card is already on file; do not silently replace default
  await auditPaymentMethodEvent('saved_after_purchase', userId, {
    paymentMethodId: targetId,
    becameDefault: false,
    existingDefault: list.defaultPaymentMethodId,
    saved: true,
  });
  return {
    saved: true,
    defaultPaymentMethodId: list.defaultPaymentMethodId,
    data: list.data,
  };
}
