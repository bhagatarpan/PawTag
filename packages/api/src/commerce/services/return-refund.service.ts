/**
 * @module Return Refund Service
 * @description Authoritative Stripe refund path for customer returns.
 *
 * Admin Orders refund and customer cancel remain separate working paths.
 * This service is the money path for Return documents — never flip
 * Return status to refunded without calling Stripe successfully.
 */

import { Order, PaymentTransaction, Return, User, type IReturnDocument } from '@pawtag/db';
import { stripePaymentProvider } from '../providers/stripe';
import { getBooleanSetting, getNumberSetting } from '../config';
import { formatRefundDestination, getTrackingUrl } from '@pawtag/shared';
import logger from '../../lib/logger';

export interface ProcessReturnRefundParams {
  returnId: string;
  /** CSR-adjusted amount; defaults to return.refundAmount when omitted */
  amount?: number;
  reason: string;
  actor: {
    id: string;
    name?: string;
    email?: string;
    type: 'admin' | 'customer';
  };
  /** Allow refund without warehouse receipt (requires reason + actor) */
  refundWithoutReturn?: boolean;
  exceptionReason?: string;
}

export interface ProcessReturnRefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  refundStatus?: 'pending' | 'succeeded' | 'failed';
  arn?: string;
  expectedArrival?: Date;
  error?: string;
  order?: any;
  returnDocument?: IReturnDocument;
  remainingRefundable?: number;
  alreadyRefunded?: number;
  capturedAmount?: number;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Pure remaining-balance math in integer cents.
 */
export function computeRemainingRefundCents(
  capturedCents: number,
  alreadyRefundedCents: number,
): number {
  return Math.max(0, capturedCents - alreadyRefundedCents);
}

export function isFullRefundAmount(
  capturedCents: number,
  alreadyRefundedCents: number,
  requestedCents: number,
): boolean {
  return alreadyRefundedCents + requestedCents >= capturedCents;
}

function pushReturnActivity(
  ret: IReturnDocument,
  entry: {
    type: string;
    message: string;
    actor?: string;
    actorType?: 'customer' | 'admin' | 'system';
    metadata?: Record<string, unknown>;
  },
) {
  if (!ret.activity) ret.activity = [];
  ret.activity.push({
    type: entry.type,
    message: entry.message,
    timestamp: new Date(),
    actor: entry.actor,
    actorType: entry.actorType,
    metadata: entry.metadata,
  });
}

/**
 * Update Order item + Return item refunded quantities after a successful refund.
 * Display/enforcement state only — money truth remains PaymentTransaction.
 */
export async function applyItemRefundState(
  order: any,
  ret: IReturnDocument,
  requestedAmount: number,
): Promise<void> {
  const returnLineTotal = (ret.items || []).reduce((sum, item) => {
    const unit = Number(item.unitPrice ?? 0);
    const custom = Number(item.customizationTotal ?? 0);
    const qty = Number(item.quantity ?? 0);
    return sum + (unit + custom) * qty;
  }, 0);

  const refundRatio = returnLineTotal > 0 ? Math.min(1, requestedAmount / returnLineTotal) : 1;

  for (const returnItem of ret.items || []) {
    const qty = Number(returnItem.quantity || 0);
    const refundedQty = Math.round(qty * refundRatio);
    returnItem.refundedQuantity = Math.min(qty, (Number(returnItem.refundedQuantity) || 0) + refundedQty);

    const orderItem = (order.items || []).find((oi: any) => {
      const itemId = String((oi as any)._id || oi.productId);
      const returnItemId = String(returnItem.orderItemId);
      return itemId === returnItemId || String(oi.productId) === returnItemId;
    });

    if (orderItem) {
      const prevRefunded = Number(orderItem.refundedQuantity || 0);
      const nextRefunded = Math.min(
        Number(orderItem.quantity || 0),
        prevRefunded + refundedQty,
      );
      orderItem.refundedQuantity = nextRefunded;
      if (nextRefunded <= 0) orderItem.refundStatus = 'none';
      else if (nextRefunded >= Number(orderItem.quantity || 0)) orderItem.refundStatus = 'refunded';
      else orderItem.refundStatus = 'partial';
    }
  }

  await ret.save();
  await order.save();
}

export class ReturnRefundService {
  /**
   * Process a Stripe refund for an approved/received return.
   *
   * Rules:
   * - reason required
   * - order must still be refundable (paid/packing/shipped/delivered)
   * - warehouse receipt required unless refundWithoutReturn exception
   * - amount validated against remaining refundable balance
   * - Stripe first; fail closed (do not mark refunded on Stripe failure)
   * - idempotent if this return already has a succeeded/pending refundId
   */
  async processRefund(params: ProcessReturnRefundParams): Promise<ProcessReturnRefundResult> {
    const reason = (params.reason || '').trim();
    if (!reason) {
      return { success: false, error: 'Refund reason is required' };
    }

    const ret = await Return.findById(params.returnId);
    if (!ret) {
      return { success: false, error: 'Return not found' };
    }

    if (ret.status === 'rejected' || ret.status === 'refunded') {
      return {
        success: false,
        error:
          ret.status === 'refunded'
            ? 'This return has already been refunded'
            : 'Cannot refund a rejected return',
      };
    }

    // Idempotency: existing Stripe refund on this return
    if (ret.refundId && (ret.refundStatus === 'succeeded' || ret.refundStatus === 'pending')) {
      logger.info(
        { returnId: ret._id, refundId: ret.refundId, refundStatus: ret.refundStatus },
        'Return refund already processed — returning existing result',
      );
      return {
        success: true,
        refundId: ret.refundId,
        amount: ret.refundAmount,
        refundStatus: ret.refundStatus as 'pending' | 'succeeded',
        arn: ret.refundArn,
        expectedArrival: ret.refundExpectedArrival,
        returnDocument: ret,
      };
    }

    // Warehouse receipt gate (unless explicit exception)
    const hasReceipt = ret.status === 'received' || Boolean(ret.receivedAt);
    if (!hasReceipt && !params.refundWithoutReturn) {
      return {
        success: false,
        error:
          'Warehouse receipt is required before refund. Mark the return received, or approve refund without return with a reason.',
      };
    }

    if (!hasReceipt && params.refundWithoutReturn) {
      if (!params.exceptionReason?.trim()) {
        return { success: false, error: 'Exception reason is required for refund without return' };
      }
      if (params.actor.type !== 'admin') {
        return { success: false, error: 'Only admin can approve refund without return' };
      }
    }

    if (params.refundWithoutReturn) {
      ret.refundWithoutReturn = true;
      ret.refundExceptionReason = params.exceptionReason?.trim();
    }

    const order = await Order.findById(ret.orderId);
    if (!order) {
      return { success: false, error: 'Order not found for return' };
    }

    // Refundable statuses — align with existing refund eligibility
    const refundableStatuses = ['paid', 'packing', 'shipped', 'delivered'];
    if (!refundableStatuses.includes(order.status)) {
      return {
        success: false,
        error: `Order in status '${order.status}' cannot be refunded`,
      };
    }

    const refundsEnabled = await getBooleanSetting('commerce.refunds.enabled');
    if (!refundsEnabled) {
      return { success: false, error: 'Refunds are currently disabled in commerce settings' };
    }

    const maxDays = await getNumberSetting('commerce.refunds.maxDaysAfterPurchase');
    const paidAt = order.payment?.paidAt || (order as any).createdAt;
    const daysSincePurchase = Math.floor(
      (Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSincePurchase > maxDays) {
      return {
        success: false,
        error: `Refund window of ${maxDays} days has passed`,
      };
    }

    const capturedAmount = Number(order.payment?.amount || 0);
    if (capturedAmount <= 0) {
      return { success: false, error: 'Order has no captured payment amount' };
    }

    // Server default: return.refundAmount or recompute from items
    let defaultAmount = Number(ret.refundAmount || 0);
    if (defaultAmount <= 0) {
      defaultAmount = (ret.items || []).reduce((sum, item) => {
        const unit = Number(item.unitPrice ?? 0);
        const custom = Number(item.customizationTotal ?? 0);
        const qty = Number(item.quantity ?? 0);
        return sum + (unit + custom) * qty;
      }, 0);
    }

    const requestedAmount = params.amount ?? defaultAmount;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return { success: false, error: 'Invalid refund amount' };
    }

    const requestedCents = toCents(requestedAmount);
    const capturedCents = toCents(capturedAmount);

    // Partial refund setting
    const partialEnabled = await getBooleanSetting('commerce.refunds.partialEnabled');
    if (!partialEnabled && requestedCents < capturedCents) {
      return {
        success: false,
        error: 'Partial refunds are disabled in commerce settings',
      };
    }

    // Remaining refundable balance (cents for safety) — re-read before Stripe
    const refundedTx = await PaymentTransaction.find({
      orderId: order._id,
      type: 'refund',
      status: { $in: ['succeeded', 'pending'] },
    }).select('amount');
    const alreadyRefundedCents = refundedTx.reduce(
      (sum, t) => sum + toCents(Number(t.amount || 0)),
      0,
    );
    const remainingCents = computeRemainingRefundCents(capturedCents, alreadyRefundedCents);

    if (requestedCents > remainingCents) {
      return {
        success: false,
        error:
          `Refund amount $${requestedAmount.toFixed(2)} exceeds remaining refundable ` +
          `$${fromCents(remainingCents).toFixed(2)}. Already refunded $${fromCents(alreadyRefundedCents).toFixed(2)}.`,
        remainingRefundable: fromCents(remainingCents),
        alreadyRefunded: fromCents(alreadyRefundedCents),
        capturedAmount,
      };
    }

    const paymentIntentId = order.payment?.stripePaymentIntentId || order.payment?.transactionId;
    if (!paymentIntentId) {
      return { success: false, error: 'No payment intent found for this order' };
    }

    // Mark processing on return before Stripe call for observability
    ret.reason = ret.reason || reason;
    if (ret.refundExceptionReason === undefined && params.refundWithoutReturn) {
      ret.refundExceptionReason = params.exceptionReason?.trim();
    }
    ret.refundAmount = requestedAmount;
    ret.refundStatus = 'pending';
    pushReturnActivity(ret, {
      type: 'refund_processing',
      message: `Stripe refund submitted for $${requestedAmount.toFixed(2)}`,
      actor: params.actor.email || params.actor.id,
      actorType: params.actor.type,
      metadata: {
        amount: requestedAmount,
        reason,
        refundWithoutReturn: Boolean(params.refundWithoutReturn),
      },
    });
    await ret.save();

    const stripeResult = await stripePaymentProvider.createRefund({
      paymentIntentId,
      amount: requestedAmount,
      reason: reason as any,
    });

    if (!stripeResult.success || !stripeResult.refundId) {
      ret.refundStatus = 'failed';
      ret.refundFailureReason = stripeResult.error || 'Stripe refund failed';
      ret.status = 'refund_failed';
      pushReturnActivity(ret, {
        type: 'refund_failed',
        message: `Stripe refund failed: ${ret.refundFailureReason}`,
        actor: params.actor.email || params.actor.id,
        actorType: params.actor.type,
      });
      await ret.save();

      await Order.updateOne(
        { _id: order._id },
        {
          $push: {
            activity: {
              type: 'refund_failed',
              message: `Return refund failed: ${ret.refundFailureReason}`,
              timestamp: new Date(),
              actor: 'admin',
              metadata: { returnId: String(ret._id), amount: requestedAmount, reason },
            },
          },
        },
      );

      logger.error(
        {
          returnId: ret._id,
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: requestedAmount,
          error: ret.refundFailureReason,
        },
        'Return refund failed at Stripe',
      );

      return {
        success: false,
        error: ret.refundFailureReason,
        refundStatus: 'failed',
        returnDocument: ret,
        remainingRefundable: fromCents(remainingCents),
        alreadyRefunded: fromCents(alreadyRefundedCents),
        capturedAmount,
      };
    }

    // Success path — persist provider truth
    const isFullRefund = isFullRefundAmount(capturedCents, alreadyRefundedCents, requestedCents);

    ret.refundId = stripeResult.refundId;
    ret.refundStatus = stripeResult.status === 'pending' ? 'pending' : 'succeeded';
    ret.refundArn = stripeResult.arn;
    ret.refundExpectedArrival = stripeResult.expectedArrival
      ? new Date(stripeResult.expectedArrival)
      : undefined;
    ret.refundProcessedAt = new Date();
    ret.refundFailureReason = undefined;
    if (!hasReceipt && params.refundWithoutReturn) {
      ret.refundWithoutReturn = true;
      ret.refundExceptionReason = params.exceptionReason?.trim();
    } else {
      ret.refundWithoutReturn = false;
    }
    if (ret.refundStatus === 'succeeded') {
      ret.status = 'refunded';
    } else if (ret.refundStatus === 'pending' && ret.status !== 'received') {
      ret.status = 'received';
    }

    pushReturnActivity(ret, {
      type: 'refund_succeeded',
      message: `Stripe refund accepted for $${requestedAmount.toFixed(2)} (${stripeResult.refundId})`,
      actor: params.actor.email || params.actor.id,
      actorType: params.actor.type,
      metadata: {
        refundId: stripeResult.refundId,
        amount: requestedAmount,
        arn: stripeResult.arn,
        refundWithoutReturn: Boolean(ret.refundWithoutReturn),
      },
    });
    await ret.save();

    // Order updates — only full refund flips order status to refunded
    const destination = formatRefundDestination(
      order.payment?.cardBrand,
      order.payment?.cardLast4,
    );

    if (isFullRefund) {
      order.status = 'refunded';
      order.payment.status = 'refunded';
    } else {
      // Partial refund: keep delivered/shipped/paid — do not claim full refund
      order.payment.status = order.payment.status;
    }
    order.refundReason = reason;
    if (stripeResult.refundId) order.refundId = stripeResult.refundId;
    order.refundStatus = ret.refundStatus === 'succeeded' ? 'succeeded' : 'pending';
    if (stripeResult.arn) order.refundArn = stripeResult.arn;
    if (ret.refundExpectedArrival) order.refundExpectedArrival = ret.refundExpectedArrival;
    order.refundLastSyncedAt = new Date();

    await PaymentTransaction.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: 'refund',
      status: ret.refundStatus === 'succeeded' ? 'succeeded' : 'pending',
      amount: requestedAmount,
      currency: order.payment?.currency || 'NZD',
      provider: 'stripe',
      providerTransactionId: stripeResult.refundId,
      initiatedBy: params.actor.type === 'customer' ? 'customer' : 'admin',
      arn: stripeResult.arn,
      expectedArrival: ret.refundExpectedArrival,
      cardBrand: order.payment?.cardBrand,
      cardLast4: order.payment?.cardLast4,
      refundDestination: destination,
    });

    // Item-level state (display/enforcement)
    if (ret.refundStatus === 'succeeded' || ret.refundStatus === 'pending') {
      try {
        await applyItemRefundState(order, ret, requestedAmount);
      } catch (itemErr) {
        logger.error({ err: itemErr, returnId: ret._id }, 'Failed to update item refund state');
      }
    } else {
      await order.save();
    }

    await Order.updateOne(
      { _id: order._id },
      {
        $push: {
          activity: {
            type: 'refund_processed',
            message: `Refund of $${requestedAmount.toFixed(2)} processed via return workflow`,
            timestamp: new Date(),
            actor: params.actor.type,
            metadata: {
              returnId: String(ret._id),
              refundId: stripeResult.refundId,
              amount: requestedAmount,
              reason,
              refundWithoutReturn: Boolean(ret.refundWithoutReturn),
              destination,
              isFullRefund,
            },
          },
        },
      },
    );

    logger.info(
      {
        returnId: ret._id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundId: stripeResult.refundId,
        amount: requestedAmount,
        currency: order.payment?.currency || 'NZD',
        actor: params.actor.id,
        actorType: params.actor.type,
        refundWithoutReturn: Boolean(ret.refundWithoutReturn),
        isFullRefund,
      },
      'Return refund processed successfully',
    );

    // Best-effort customer notification (webhook emails still fire for settlement)
    try {
      const user = await User.findById(order.userId).select('email fullName').lean();
      if (user?.email) {
        const { sendMail } = await import('../../services/email.service');
        const html = `
          <p>Hi ${user.fullName || 'there'},</p>
          <p>We processed a refund of <strong>$${requestedAmount.toFixed(2)} ${order.payment?.currency || 'NZD'}</strong> for order <strong>${order.orderNumber}</strong>.</p>
          <p>Destination: ${destination}</p>
          ${stripeResult.refundId ? `<p>Refund ID: ${stripeResult.refundId}</p>` : ''}
          ${stripeResult.arn ? `<p>ARN: ${stripeResult.arn}</p>` : ''}
          <p>Refunds typically appear on your statement within 5–10 business days.</p>
        `;
        await sendMail(user.email, `Refund processed — ${order.orderNumber}`, html).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, returnId: ret._id }, 'Failed to send return refund email');
    }

    return {
      success: true,
      refundId: stripeResult.refundId,
      amount: requestedAmount,
      refundStatus: ret.refundStatus as 'pending' | 'succeeded',
      arn: stripeResult.arn,
      expectedArrival: ret.refundExpectedArrival,
      order,
      returnDocument: ret,
      remainingRefundable: fromCents(remainingCents - requestedCents),
      alreadyRefunded: fromCents(alreadyRefundedCents + requestedCents),
      capturedAmount,
    };
  }

  /**
   * Read remaining refundable balance for admin UI.
   */
  async getBalance(orderId: string): Promise<{
    capturedAmount: number;
    alreadyRefunded: number;
    remainingRefundable: number;
  }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    const capturedAmount = Number(order.payment?.amount || 0);
    const refundedTx = await PaymentTransaction.find({
      orderId: order._id,
      type: 'refund',
      status: { $in: ['succeeded', 'pending'] },
    }).select('amount');
    const alreadyRefundedCents = refundedTx.reduce(
      (sum, t) => sum + toCents(Number(t.amount || 0)),
      0,
    );
    const capturedCents = toCents(capturedAmount);
    return {
      capturedAmount,
      alreadyRefunded: fromCents(alreadyRefundedCents),
      remainingRefundable: fromCents(computeRemainingRefundCents(capturedCents, alreadyRefundedCents)),
    };
  }
}

export const returnRefundService = new ReturnRefundService();

// Re-export for consumers that need tracking URL on returns
export { getTrackingUrl };
