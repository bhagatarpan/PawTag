/**
 * @module CPF Service
 * @description Card Processing Fee (CPF) — compute, snapshot, verify, and
 * exception-refund the customer-facing card fee.
 *
 * Plan: docs/COMMERCE-FINANCE-PLAN-GST-CPF.md (founder decisions D1-D17).
 *
 * Rules:
 * - The fee is a GST-INCLUSIVE schedule amount: percent of the order
 *   payable (before the fee) + fixed per transaction (D7). The GST portion
 *   is extracted for records/documents, never added on top.
 * - Everything is config-driven (`commerce.cpf.*`) — switching providers
 *   or rates is a settings change, never a code change (D3). The switch
 *   ships OFF (D8).
 * - The computation is snapshotted onto the order at PaymentIntent
 *   creation; later config changes never rewrite history.
 * - CPF is charged only on configured networks (default visa,mastercard,amex).
 *   If the captured card is NOT on the list, the fee is automatically
 *   refunded (audited, idempotent) — a fee can never silently over-charge.
 * - Merchant-fault refunds include the CPF when
 *   `commerce.cpf.refundOnMerchantFault=true` (D10).
 *
 * Money math: shared helpers only (cents-safe), per skills/monetary-precision.
 */

import { PaymentTransaction, Order } from '@pawtag/db';
import {
  addMoney,
  fromCents,
  roundToCents,
  toCents,
  type CpfComputation,
  type CpfSnapshot,
} from '@pawtag/shared';
import { getBooleanSetting, getNumberSetting, getSetting } from '../config';
import { nzGstProvider } from '../providers/simple-gst';
import { stripePaymentProvider } from '../providers/stripe';
import { logRefundEvent } from '../audit';
import logger from '../../lib/logger';

/** Normalise brand strings for comparison: 'Master Card'/'MC' → 'mastercard' */
function normalizeNetwork(value: string): string {
  const v = value.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (v === 'master' || v === 'mc') return 'mastercard';
  if (v === 'amex' || v === 'americanexpress') return 'amex';
  return v;
}

/** Parse the appliesTo setting into normalised network names. */
async function getAppliesToNetworks(): Promise<string[]> {
  const raw = await getSetting('commerce.cpf.appliesTo');
  return raw
    .split(',')
    .map((n) => normalizeNetwork(n))
    .filter(Boolean);
}

/** True when the fee applies to this card network. */
export async function isCpfCardNetwork(brand: string | null | undefined): Promise<boolean> {
  if (!brand) return false;
  const networks = await getAppliesToNetworks();
  return networks.includes(normalizeNetwork(brand));
}

/**
 * Extract the GST portion of a GST-inclusive amount (or apply the rate to
 * a net amount when the store runs tax-exclusive). Rate always comes from
 * the tax provider — never hardcoded.
 */
async function gstPortionOf(amount: number): Promise<number> {
  if (!(amount > 0)) return 0;
  const rate = await nzGstProvider.getRate();
  if (!(rate > 0)) return 0;
  const inclusive = await nzGstProvider.isInclusive();
  return roundToCents(inclusive ? (amount * rate) / (1 + rate) : amount * rate);
}

/**
 * Compute the CPF for an order payable amount (before the fee).
 * Returns null when the fee is disabled, the amount is zero, or the
 * computed fee rounds to zero.
 */
export async function computeCpf(payableAmount: number): Promise<CpfComputation | null> {
  if (!(payableAmount > 0)) return null;

  const enabled = await getBooleanSetting('commerce.cpf.enabled');
  if (!enabled) return null;

  const percent = await getNumberSetting('commerce.cpf.percent');
  const fixed = await getNumberSetting('commerce.cpf.fixed');
  const scheduleVersion = (await getSetting('commerce.cpf.scheduleVersion')) || 'v1';

  const percentPart = roundToCents((payableAmount * percent) / 100);
  const amount = roundToCents(addMoney(percentPart, fixed));
  if (!(amount > 0)) return null;

  return {
    amount,
    gst: await gstPortionOf(amount),
    percent,
    fixed,
    scheduleVersion,
  };
}

/** Build the durable snapshot stored on the order. */
export function toCpfSnapshot(computation: CpfComputation): CpfSnapshot {
  return {
    amount: computation.amount,
    gst: computation.gst,
    percent: computation.percent,
    fixed: computation.fixed,
    scheduleVersion: computation.scheduleVersion,
    refundedAmount: 0,
  };
}

/** CPF snapshot for an order, or null when none applies. */
export function cpfForOrder(order: any): CpfSnapshot | null {
  const cpf = order?.payment?.cpf as CpfSnapshot | undefined;
  if (!cpf || !(cpf.amount > 0)) return null;
  return cpf;
}

/** CPF amount still retained for an order (amount minus any exception refunds). */
export function cpfRetained(order: any): number {
  const cpf = cpfForOrder(order);
  if (!cpf) return 0;
  return Math.max(0, toCents(cpf.amount) - toCents(cpf.refundedAmount || 0)) / 100;
}

/**
 * Record captured card details on the order's CPF snapshot and decide
 * whether the fee must be refunded because the network is not covered
 * by the configured appliesTo list.
 *
 * Returns true when an unsupported-brand CPF refund is required; the
 * caller (webhook/capture path) must then run processCpfExceptionRefund.
 */
export function applyCapturedCardDetails(order: any, brand: string | null | undefined, country: string | null | undefined): boolean {
  const cpf = cpfForOrder(order);
  if (!cpf) return false;
  if (brand) cpf.cardNetwork = brand;
  if (country) cpf.cardCountry = country;
  return true; // caller must verify the network; see verifyCapturedBrandForCpf
}

/** Network check used after capture — async because appliesTo is config. */
export async function verifyCapturedBrandForCpf(order: any, brand: string | null | undefined): Promise<boolean> {
  const cpf = cpfForOrder(order);
  if (!cpf) return false;
  if ((cpf.refundedAmount || 0) > 0) return false; // already handled
  if ((order?.payment?.status) !== 'completed') return false;
  return !(await isCpfCardNetwork(brand));
}

interface CpfRefundOutcome {
  refunded: boolean;
  reason: 'not_applicable' | 'already_refunded' | 'missing_payment' | 'provider_failed' | 'ok';
  error?: string;
}

/**
 * Refund the retained CPF for an order — used by BOTH exception paths
 * (unsupported captured brand, merchant fault). Idempotent: a CPF that was
 * already refunded (or a CPF-less order) is a clean no-op.
 */
export async function refundOrderCpf(
  order: any,
  reasonCode: 'unsupported_brand' | 'merchant_fault',
  description: string,
): Promise<CpfRefundOutcome> {
  const cpf = cpfForOrder(order);
  if (!cpf) return { refunded: false, reason: 'not_applicable' };

  const remainingCents = toCents(cpf.amount) - toCents(cpf.refundedAmount || 0);
  if (remainingCents <= 0) return { refunded: false, reason: 'already_refunded' };

  const paymentIntentId = order?.payment?.stripePaymentIntentId;
  if (!paymentIntentId || String(paymentIntentId).startsWith('pi_zero_') || String(paymentIntentId).startsWith('pi_demo_')) {
    // Synthetic intents have nothing at Stripe — record the CPF as
    // retained-by-nothing only when money was never taken.
    return { refunded: false, reason: 'missing_payment' };
  }

  const refundAmount = fromCents(remainingCents);
  const result = await stripePaymentProvider.createRefund({
    paymentIntentId,
    amount: refundAmount,
    // Business text stays in metadata; the provider reason uses its enum
    // boundary mapping (skills/commerce-safety: adapter rule).
    reason: 'requested_by_customer',
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      cpfException: reasonCode,
      description,
    },
  });

  if (!result.success || !result.refundId) {
    logger.error(
      { orderId: String(order._id), orderNumber: order.orderNumber, reasonCode, providerError: result.error },
      'CPF exception refund failed at Stripe — repair required',
    );
    return { refunded: false, reason: 'provider_failed', error: result.error };
  }

  // Durable record: snapshot on the order + a refund PaymentTransaction
  cpf.refundedAmount = addMoney(cpf.refundedAmount || 0, refundAmount);
  await order.save();

  await PaymentTransaction.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: 'refund',
    status: result.status === 'succeeded' ? 'succeeded' : 'pending',
    amount: refundAmount,
    currency: order.payment?.currency || 'NZD',
    provider: 'stripe',
    providerTransactionId: result.refundId,
    initiatedBy: 'system',
    notes: `CPF exception refund (${reasonCode}): ${description}`,
    cardBrand: cpf.cardNetwork,
  }).catch((err) => {
    logger.error({ err, orderId: String(order._id) }, 'CPF exception refund PaymentTransaction write failed — repair required');
  });

  await logRefundEvent(result.status === 'succeeded' ? 'succeeded' : 'created', {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    refundId: result.refundId,
    amount: refundAmount,
    currency: order.payment?.currency || 'NZD',
  }).catch(() => {});

  logger.warn(
    {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      reasonCode,
      refundId: result.refundId,
      amount: refundAmount,
      cardNetwork: cpf.cardNetwork,
    },
    'CPF refunded via exception path',
  );

  return { refunded: true, reason: 'ok' };
}

/** Post-capture hook: refund the CPF when the captured brand is not covered. */
export async function processCpfExceptionRefund(order: any, brand: string | null | undefined): Promise<CpfRefundOutcome> {
  const required = await verifyCapturedBrandForCpf(order, brand);
  if (!required) return { refunded: false, reason: 'not_applicable' };
  return refundOrderCpf(order, 'unsupported_brand', `Card network "${brand}" is not covered by the configured card processing fee`);
}

/** Merchant-fault path: refund the CPF when PawTag cannot fulfil (D10). */
export async function refundCpfForMerchantFault(order: any): Promise<CpfRefundOutcome> {
  const enabled = await getBooleanSetting('commerce.cpf.refundOnMerchantFault');
  if (!enabled) return { refunded: false, reason: 'not_applicable' };
  return refundOrderCpf(order, 'merchant_fault', 'PawTag could not fulfil the order — card processing fee refunded');
}

/** Load an order by id with payment state for CPF operations. */
export async function loadOrderForCpf(orderId: string): Promise<any | null> {
  return Order.findById(orderId);
}
