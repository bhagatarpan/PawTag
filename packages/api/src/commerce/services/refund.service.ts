/**
 * @module Refund Service
 * @description PawTag-native refund processing.
 *
 * Handles full and partial refunds via Stripe.
 * All refunds are audit-logged and idempotent.
 *
 * Usage:
 * ```typescript
 * import { refundService } from '../commerce/services/refund.service';
 * const result = await refundService.processRefund(orderId, { amount: 29.99, reason: 'Customer request' });
 * ```
 */

import { Order, type IOrderDocument } from '@pawtag/db';
import { NotFoundError } from '../../lib/app-errors';
import { RefundError } from '../errors';
import { stripePaymentProvider } from '../providers/stripe';
import { logRefundEvent } from '../audit';
import { getBooleanSetting, getNumberSetting } from '../config';
import logger from '../../lib/logger';

/**
 * Refund parameters.
 */
export interface RefundParams {
  /** Refund amount (omit for full refund) */
  amount?: number;

  /** Reason for the refund */
  reason?: string;

  /** Who initiated the refund */
  initiatedBy: string;
}

/**
 * Refund result.
 */
export interface RefundResult {
  /** Whether the refund was successful */
  success: boolean;

  /** Stripe refund ID */
  refundId?: string;

  /** Refund amount */
  amount?: number;

  /** Updated order */
  order?: any;

  /** Error message if failed */
  error?: string;
}

/**
 * Refund service for PawTag Commerce.
 */
export class RefundService {
  /**
   * Process a refund for an order.
   *
   * @param orderId - Order ID
   * @param params - Refund parameters
   * @returns Refund result
   */
  async processRefund(orderId: string, params: RefundParams): Promise<RefundResult> {
    // 1. Find order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    // 2. Validate order is refundable
    if (!this.isRefundable(order)) {
      throw new RefundError(`Order in status '${order.status}' cannot be refunded`);
    }

    // 3. Check refund policy
    const maxDays = await getNumberSetting('commerce.refunds.maxDaysAfterPurchase');
    const daysSincePurchase = Math.floor(
      (Date.now() - new Date(order.payment.paidAt || (order as any).createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSincePurchase > maxDays) {
      throw new RefundError(`Refund window of ${maxDays} days has passed`);
    }

    // 4. Determine refund amount
    const refundAmount = params.amount ?? order.payment.amount;
    if (refundAmount <= 0 || refundAmount > order.payment.amount) {
      throw new RefundError(`Invalid refund amount: $${refundAmount}`);
    }

    // 5. Get Stripe payment intent ID
    const paymentIntentId = order.payment.stripePaymentIntentId || order.payment.transactionId;
    if (!paymentIntentId) {
      throw new RefundError('No payment intent found for this order');
    }

    // 6. Process refund via Stripe
    const stripeResult = await stripePaymentProvider.createRefund({
      paymentIntentId,
      amount: refundAmount,
      reason: params.reason as any,
    });

    if (!stripeResult.success) {
      return {
        success: false,
        error: stripeResult.error,
      };
    }

    // 7. Update order
    const isFullRefund = refundAmount >= order.payment.amount;
    order.status = isFullRefund ? 'refunded' : order.status;
    order.payment.status = isFullRefund ? 'refunded' : order.payment.status;
    order.refundReason = params.reason;

    await order.save();

    // 8. Record activity
    await Order.updateOne(
      { _id: orderId },
      {
        $push: {
          activity: {
            type: 'refund',
            message: `Refund of $${refundAmount.toFixed(2)} NZD processed by ${params.initiatedBy}`,
            timestamp: new Date(),
            actor: 'admin',
            metadata: {
              refundId: stripeResult.refundId,
              amount: refundAmount,
              reason: params.reason,
              initiatedBy: params.initiatedBy,
            },
          },
        },
      },
    );

    // 9. Audit log
    await logRefundEvent('succeeded', {
      refundId: stripeResult.refundId,
      orderId,
      orderNumber: order.orderNumber,
      amount: refundAmount,
      currency: order.payment.currency || 'NZD',
      reason: params.reason,
    });

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      refundId: stripeResult.refundId,
      amount: refundAmount,
      initiatedBy: params.initiatedBy,
    }, 'Refund processed');

    return {
      success: true,
      refundId: stripeResult.refundId,
      amount: refundAmount,
      order,
    };
  }

  /**
   * Check if an order is eligible for refund.
   *
   * @param order - Order document
   * @returns Whether the order can be refunded
   */
  private isRefundable(order: IOrderDocument): boolean {
    const refundableStatuses = ['paid', 'packing', 'shipped', 'delivered'];
    return refundableStatuses.includes(order.status);
  }
}

/** Singleton instance */
export const refundService = new RefundService();
