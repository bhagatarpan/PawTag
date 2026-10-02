/**
 * @module Cancellation Service
 * @description Central service for order cancellation business rules.
 *
 * Consolidates cancellation logic from:
 * - customer-returns.ts (customer cancellation)
 * - admin.ts (admin cancellation)
 * - stripe-webhooks.ts (payment failure)
 *
 * Business rules:
 * - Only orders in cancellable states can be cancelled
 * - Paid orders get refunded via Stripe
 * - Inventory is released
 * - Activity is logged
 * - Customer is notified
 *
 * The caller decides:
 * - Authorization (ownership vs RBAC)
 * - Whether to fail or continue if refund fails
 * - Audit event details
 *
 * Financial safety:
 * - PaymentTransaction.initiatedBy must use the lowercase enum
 *   (`customer` | `admin` | `system` | `webhook`).
 * - After a Stripe refund succeeds, local cancellation bookkeeping must not
 *   leave the order marked paid. Bookkeeping failures are repaired, not used
 *   to abandon a refund that already happened at Stripe.
 */

import { Order, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../providers/stripe';
import { inventoryService } from './inventory.service';
import { logPaymentEvent } from '../audit';
import { auditService } from '../../services/audit';
import {
  formatActivityMessage,
  formatCancelledBy,
  formatCancelledByDescription,
} from '../../lib/actor';
import { formatRefundDestination } from '@pawtag/shared';
import logger from '../../lib/logger';
import type { RefundResult } from '../interfaces/payment-provider';

/** Valid order statuses that can be cancelled */
const CANCELLABLE_STATUSES = ['pending', 'pending_payment', 'paid', 'packing'] as const;

/** Normalized actor types used for durable bookkeeping enums */
type NormalizedActorType = 'customer' | 'admin' | 'system';

export type CancellationErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_CANCELLABLE'
  | 'REFUND_FAILED'
  | 'UNKNOWN';

/** Result of a cancellation attempt */
export interface CancellationResult {
  success: boolean;
  order: any;
  refundCreated: boolean;
  refundId?: string;
  error?: string;
  errorCode?: CancellationErrorCode;
  /**
   * True when Stripe refund succeeded but local payment-transaction write failed.
   * Order is still cancelled; ops should backfill PaymentTransaction.
   */
  bookkeepingFailed?: boolean;
}

/** Actor information for cancellation */
export interface CancellationActor {
  /** Display name of the actor */
  name: string;
  /**
   * Actor type. Lowercase preferred (`customer`/`admin`/`system`).
   * Display values like `Customer` are also accepted and normalized.
   */
  type: string;
  /** Portal: 'customer-web', 'customer-mobile', 'admin-web', 'system' */
  portal: string;
}

/**
 * Check if an order status transition is valid.
 */
export function isValidCancellationStatus(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

/** Normalize actor type for enums/comparisons. */
export function normalizeActorType(type: string): NormalizedActorType {
  const value = (type || '').toLowerCase();
  if (value === 'customer' || value === 'admin' || value === 'system') {
    return value;
  }
  if (value.includes('customer')) return 'customer';
  if (value.includes('admin')) return 'admin';
  return 'system';
}

function displayActorType(normalized: NormalizedActorType): string {
  if (normalized === 'customer') return 'Customer';
  if (normalized === 'admin') return 'Admin';
  return 'System';
}

function activityActor(normalized: NormalizedActorType): 'customer' | 'admin' | 'system' {
  return normalized;
}

function auditActorType(normalized: NormalizedActorType): 'USER' | 'ADMIN' | 'SYSTEM' {
  if (normalized === 'customer') return 'USER';
  if (normalized === 'admin') return 'ADMIN';
  return 'SYSTEM';
}

function isAlreadyRefundedProviderError(message?: string): boolean {
  if (!message) return false;
  return /already refunded|has been refunded|refund.*already|charge.*refund/i.test(message);
}

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as any).code === 11000);
}

async function findExistingStripeRefund(paymentIntentId: string): Promise<RefundResult | null> {
  if (paymentIntentId.startsWith('pi_demo_')) return null;

  // Prefer a refund already stored on the order (handled by caller via order.refundId)
  try {
    const lister = (stripePaymentProvider as any).listRefundsByPaymentIntent;
    if (typeof lister !== 'function') return null;
    const refunds: RefundResult[] = await lister.call(stripePaymentProvider, paymentIntentId);
    const usable = refunds.find(
      (r) => r.success && r.refundId && (r.status === 'succeeded' || r.status === 'pending'),
    );
    return usable || null;
  } catch (err) {
    logger.error({ err, paymentIntentId }, 'Failed to look up existing Stripe refund during cancellation');
    return null;
  }
}

async function recordRefundPaymentTransaction(params: {
  order: any;
  refundResult: RefundResult;
  initiatedBy: NormalizedActorType;
  reason: string;
  notes?: string;
  reconciledFromExisting?: boolean;
}): Promise<void> {
  const { order, refundResult, initiatedBy, reason, notes, reconciledFromExisting } = params;
  const cardBrand = order.payment?.cardBrand;
  const cardLast4 = order.payment?.cardLast4;

  await PaymentTransaction.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: 'refund',
    status: refundResult.status === 'succeeded' ? 'succeeded' : 'pending',
    amount: refundResult.amount ?? order.payment?.amount ?? 0,
    currency: order.payment?.currency || 'NZD',
    provider: 'stripe',
    providerTransactionId: refundResult.refundId,
    providerStatus: refundResult.status,
    arn: refundResult.arn,
    expectedArrival: refundResult.expectedArrival,
    initiatedBy,
    attemptCount: 0,
    cardBrand,
    cardLast4,
    refundDestination: formatRefundDestination(cardBrand, cardLast4),
    notes: reconciledFromExisting
      ? `${reason} — reconciled from existing Stripe refund${notes ? ` — ${notes}` : ''}`
      : notes
        ? `${reason} — ${notes}`
        : reason,
  });
}

/**
 * Cancel an order with optional refund.
 *
 * @param params - Cancellation parameters
 * @returns Cancellation result
 */
export async function cancelOrder(params: {
  orderId: string;
  reason: string;
  notes?: string;
  actor: CancellationActor;
  /** If true, refund failure returns error. If false, continues without refund. */
  requireRefundSuccess?: boolean;
}): Promise<CancellationResult> {
  const { orderId, reason, notes, actor, requireRefundSuccess = false } = params;
  const normalizedActorType = normalizeActorType(actor.type);
  const displayType = displayActorType(normalizedActorType);
  const cancelledBy = formatCancelledBy(actor.name, displayType);
  const cancelledByDescription = formatCancelledByDescription(actor.portal, actor.name, displayType);

  // 1. Find order
  const order = await Order.findById(orderId);
  if (!order) {
    return {
      success: false,
      order: null,
      refundCreated: false,
      error: 'Order not found',
      errorCode: 'ORDER_NOT_FOUND',
    };
  }

  // 2. Validate status
  if (!isValidCancellationStatus(order.status)) {
    return {
      success: false,
      order,
      refundCreated: false,
      error: `Order in status '${order.status}' cannot be cancelled`,
      errorCode: 'ORDER_NOT_CANCELLABLE',
    };
  }

  const previousStatus = order.status;
  const cancelledAt = new Date();

  // 3. Process refund for paid orders
  let refundCreated = false;
  let refundId: string | undefined;
  let bookkeepingFailed = false;
  let reconciledFromExisting = false;

  if (order.payment?.status === 'completed' && order.payment?.stripePaymentIntentId) {
    const paymentIntentId = order.payment.stripePaymentIntentId;

    // Skip demo/test payment intents
    if (!paymentIntentId.startsWith('pi_demo_')) {
      try {
        let refundResult: RefundResult | null = null;

        // 3a. Reuse a refund already stored on the order
        if (order.refundId) {
          const existingOnOrder = await stripePaymentProvider.retrieveRefund(order.refundId);
          if (existingOnOrder.success && existingOnOrder.refundId) {
            refundResult = existingOnOrder;
            reconciledFromExisting = true;
          }
        }

        // 3b. Reuse a provider-side refund if Stripe already refunded this charge
        if (!refundResult) {
          refundResult = await findExistingStripeRefund(paymentIntentId);
          if (refundResult?.refundId) {
            reconciledFromExisting = true;
          }
        }

        // 3c. Create a new Stripe refund when none exists
        if (!refundResult) {
          refundResult = await stripePaymentProvider.createRefund({
            paymentIntentId,
            amount: order.payment.amount,
            reason: 'requested_by_customer',
            metadata: {
              orderId: String(order._id),
              orderNumber: order.orderNumber,
              cancelledBy,
              cancelledByType: displayType,
              cancelledByPortal: actor.portal,
              cancellationReason: reason,
              cancellationNotes: notes || '',
              initiatedBy: normalizedActorType,
              environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
            },
          });
        }

        // 3d. Handle refund failure / already-refunded race
        if (!refundResult.success) {
          if (isAlreadyRefundedProviderError(refundResult.error)) {
            const existing = await findExistingStripeRefund(paymentIntentId);
            if (existing?.refundId) {
              refundResult = existing;
              reconciledFromExisting = true;
            }
          }
        }

        if (!refundResult.success) {
          logger.error({
            orderId: String(order._id),
            paymentIntentId,
            error: refundResult.error,
          }, 'Stripe refund returned failure during cancellation');

          if (requireRefundSuccess) {
            return {
              success: false,
              order,
              refundCreated: false,
              error: refundResult.error || 'Failed to process refund. Please contact support.',
              errorCode: 'REFUND_FAILED',
            };
          }
          // Otherwise continue without refund — but do NOT record PaymentTransaction
          // with the PaymentIntent ID as if it were a refund ID
        } else if (refundResult.refundId) {
          order.refundId = refundResult.refundId;
          order.refundStatus = (refundResult.status as any) || 'pending';
          order.refundLastSyncedAt = new Date();
          if (refundResult.arn) {
            order.refundArn = refundResult.arn;
          }
          if (refundResult.expectedArrival) {
            order.refundExpectedArrival = refundResult.expectedArrival;
          }
          refundCreated = true;
          refundId = refundResult.refundId;

          // Record payment transaction only when refund actually succeeded.
          // initiatedBy MUST be the lowercase enum value.
          try {
            await recordRefundPaymentTransaction({
              order,
              refundResult,
              initiatedBy: normalizedActorType,
              reason,
              notes,
              reconciledFromExisting,
            });
          } catch (bookkeepingErr: any) {
            if (isDuplicateKeyError(bookkeepingErr)) {
              logger.warn({
                orderId: String(order._id),
                refundId: refundResult.refundId,
              }, 'PaymentTransaction already exists for refund — treating bookkeeping as complete');
            } else {
              // Stripe refund already succeeded. Do not fail the customer cancel
              // and leave the order paid. Complete cancellation and flag repair.
              bookkeepingFailed = true;
              logger.error({
                err: bookkeepingErr,
                orderId: String(order._id),
                refundId: refundResult.refundId,
                initiatedBy: normalizedActorType,
              }, 'PaymentTransaction write failed after successful Stripe refund — order will still be cancelled');
            }
          }

          await logPaymentEvent('refunded', {
            paymentIntentId,
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            amount: refundResult.amount ?? order.payment.amount,
          }).catch((err) => {
            logger.error({ err, orderId: String(order._id) }, 'Failed to log payment event after refund');
          });
        }
      } catch (err: any) {
        logger.error({
          err,
          orderId: String(order._id),
          actor: normalizedActorType,
        }, 'Failed to process refund during cancellation');

        if (requireRefundSuccess) {
          return {
            success: false,
            order,
            refundCreated: false,
            error: 'Failed to process refund. Please contact support.',
            errorCode: 'REFUND_FAILED',
          };
        }
        // Otherwise continue with cancellation without refund
      }
    }
  }

  // 4. Update order status
  order.status = 'cancelled';
  order.cancellationReason = reason;
  order.cancellationNotes = notes;
  order.cancelledBy = cancelledBy;
  order.cancelledByType = displayType;
  order.cancelledByPortal = actor.portal as any;
  order.cancelledByDescription = cancelledByDescription;
  order.cancelledAt = cancelledAt;

  if (refundCreated && order.payment) {
    order.payment.status = 'refunded';
  }

  if (bookkeepingFailed) {
    const repairError = {
      step: 'payment_transaction_after_refund',
      error: 'Stripe refund succeeded but PaymentTransaction write failed',
      timestamp: new Date(),
    };
    order.completionStatus = 'repair_required';
    order.completionErrors = [...(order.completionErrors || []), repairError];
  }

  await order.save();

  // 5. Release inventory
  try {
    await inventoryService.releaseForOrder(order._id.toString(), order.items.map((item) => ({
      productId: String(item.productId),
      quantity: item.quantity,
    })));
  } catch (err) {
    logger.error({ err, orderId: String(order._id) }, 'Failed to release inventory during cancellation');
    // Best-effort — order is still cancelled
  }

  // 6. Log activity
  const activityMessage = formatActivityMessage(cancelledBy, reason, cancelledAt);
  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        activity: {
          type: 'cancelled',
          message: activityMessage,
          timestamp: cancelledAt,
          actor: activityActor(normalizedActorType),
          metadata: {
            reason,
            notes,
            cancelledBy,
            cancelledByType: displayType,
            cancelledByPortal: actor.portal,
            cancelledAt: cancelledAt.toISOString(),
            refundCreated,
            refundId: order.refundId,
            reconciledFromExisting,
            bookkeepingFailed,
          },
        },
      },
    },
  );

  logger.info({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    previousStatus,
    reason,
    cancelledBy,
    cancelledByType: displayType,
    refundCreated,
    refundId,
    reconciledFromExisting,
    bookkeepingFailed,
  }, 'Order cancelled');

  // Durable audit event for financial traceability
  try {
    await auditService.log({
      actorType: auditActorType(normalizedActorType),
      actorId: actor.name,
      actorUsername: actor.name,
      sourceIp: 'unknown',
      userAgent: actor.portal,
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
    }, {
      action: 'order_cancelled',
      eventType: 'order.cancelled',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Order',
      resourceId: String(order._id),
      subjectUserId: String(order.userId),
      outcome: bookkeepingFailed ? 'PARTIAL' : 'SUCCESS',
      severity: 'HIGH',
      reason,
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        previousStatus,
        reason,
        notes: notes || '',
        cancelledBy,
        cancelledByType: displayType,
        cancelledByPortal: actor.portal,
        refundCreated,
        refundId: order.refundId || null,
        refundArn: order.refundArn || null,
        refundExpectedArrival: order.refundExpectedArrival || null,
        refundAmount: refundCreated ? order.payment?.amount || 0 : 0,
        refundDestination: refundCreated
          ? formatRefundDestination(order.payment?.cardBrand, order.payment?.cardLast4)
          : null,
        initiatedBy: normalizedActorType,
        reconciledFromExisting,
        bookkeepingFailed,
        subjectUserId: String(order.userId),
      },
    });
  } catch (err) {
    logger.error({ err, orderId: String(order._id) }, 'Failed to create audit event for order cancellation');
  }

  return {
    success: true,
    order,
    refundCreated,
    refundId,
    bookkeepingFailed,
  };
}
