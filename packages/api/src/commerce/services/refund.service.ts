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

import { Order, PaymentTransaction, Invoice, type IOrderDocument } from '@pawtag/db';
import mongoose from 'mongoose';
import { NotFoundError } from '../../lib/app-errors';
import { RefundError } from '../errors';
import { stripePaymentProvider } from '../providers/stripe';
import { logRefundEvent } from '../audit';
import { getNumberSetting } from '../config';
import { formatRefundDestination } from '@pawtag/shared';
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

    // 4. Idempotency check - return existing refund if one already exists
    const existingRefund = await PaymentTransaction.findOne({
      orderId: order._id,
      type: 'refund',
      status: { $in: ['pending', 'succeeded'] },
    }).sort({ createdAt: -1 });

    if (existingRefund) {
      logger.info({
        orderId,
        orderNumber: order.orderNumber,
        existingRefundId: existingRefund.providerTransactionId,
        status: existingRefund.status,
      }, 'Returning existing refund (idempotency)');
      return {
        success: true,
        refundId: existingRefund.providerTransactionId,
        amount: existingRefund.amount,
        order,
      };
    }

    // 5. Calculate cumulative refund amount and validate
    const capturedAmount = order.payment.amount;
    const totalRefunded = await this.calculateTotalRefunded(order._id);
    const refundAmount = params.amount ?? capturedAmount;

    if (refundAmount <= 0) {
      throw new RefundError(`Invalid refund amount: $${refundAmount}`);
    }

    if (totalRefunded + refundAmount > capturedAmount) {
      const remainingRefundable = capturedAmount - totalRefunded;
      throw new RefundError(
        `Refund amount of $${refundAmount.toFixed(2)} would exceed captured amount of $${capturedAmount.toFixed(2)}. ` +
        `Already refunded: $${totalRefunded.toFixed(2)}. Remaining refundable: $${remainingRefundable.toFixed(2)}`,
      );
    }

    // 6. Get Stripe payment intent ID
    const paymentIntentId = order.payment.stripePaymentIntentId || order.payment.transactionId;
    if (!paymentIntentId) {
      throw new RefundError('No payment intent found for this order');
    }

    // 7. Process refund via Stripe — adapter maps free-text reason to Stripe enum
    const stripeResult = await stripePaymentProvider.createRefund({
      paymentIntentId,
      amount: refundAmount,
      reason: params.reason,
      metadata: {
        orderId: String(orderId),
        orderNumber: order.orderNumber,
        pawtagReason: (params.reason || '').slice(0, 490),
      },
    });

    if (!stripeResult.success) {
      return {
        success: false,
        error: stripeResult.error,
      };
    }

    // 8. Update order — persist refund fields for UI display
    const isFullRefund = refundAmount >= capturedAmount;
    if (isFullRefund) {
      order.status = 'refunded';
      order.payment.status = 'refunded';
    }
    order.refundReason = params.reason;
    order.refundId = stripeResult.refundId;
    order.refundStatus = (stripeResult.status as any) || 'succeeded';
    if (stripeResult.arn) order.refundArn = stripeResult.arn;
    if (stripeResult.expectedArrival) {
      order.refundExpectedArrival = new Date(stripeResult.expectedArrival);
    }
    order.refundLastSyncedAt = new Date();

    await order.save();

    // 9. Record activity
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

    // 10. Audit log
    await logRefundEvent('succeeded', {
      refundId: stripeResult.refundId,
      orderId,
      orderNumber: order.orderNumber,
      amount: refundAmount,
      currency: order.payment.currency || 'NZD',
      reason: params.reason,
    });

    // 11. Record payment transaction for audit trail
    await PaymentTransaction.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: 'refund',
      status: 'succeeded',
      amount: refundAmount,
      currency: order.payment.currency || 'NZD',
      provider: 'stripe',
      providerTransactionId: stripeResult.refundId,
      initiatedBy: 'admin',
      arn: stripeResult.arn,
      expectedArrival: stripeResult.expectedArrival,
      cardBrand: order.payment.cardBrand,
      cardLast4: order.payment.cardLast4,
      refundDestination: formatRefundDestination(order.payment.cardBrand, order.payment.cardLast4),
      notes: params.reason,
    });

    // 12. Generate credit note (refund invoice)
    let creditNote: any = null;
    try {
      const { generateCreditNoteNumber } = await import('../../lib/invoice-number');
      const creditNoteNumber = await generateCreditNoteNumber();

      // Find original invoice for this order
      const originalInvoice = await Invoice.findOne({ orderId: order._id, type: 'invoice' }).sort({ createdAt: -1 }).lean();

      creditNote = await Invoice.create({
        type: 'credit_note',
        relatedInvoiceId: originalInvoice?._id || null,
        orderId: order._id,
        userId: order.userId,
        invoiceNumber: creditNoteNumber,
        amount: refundAmount,
        currency: order.payment.currency || 'NZD',
        status: 'paid',
        paymentMethod: order.payment.method,
        paidAt: new Date(),
      });

      logger.info({ creditNoteId: creditNote._id, creditNoteNumber, orderId: order._id, amount: refundAmount }, 'Credit note generated');
    } catch (err: any) {
      logger.error({ err, orderId: order._id }, 'Failed to generate credit note');
      // Non-critical — don't fail the refund
    }

    // 13. Deduct Guardian Points for refunded purchase
    try {
      const { deductPoints } = await import('../../services/loyalty/points-earning.service');
      const pointsEarnedForOrder = Math.floor(refundAmount); // 1 point per $1
      if (pointsEarnedForOrder > 0) {
        const deductionResult = await deductPoints(
          String(order.userId),
          pointsEarnedForOrder,
          'refund',
          order._id.toString(),
          `Refund for order ${order.orderNumber} (${stripeResult.refundId})`,
        );
        logger.info({
          orderId,
          userId: order.userId,
          pointsDeducted: deductionResult.pointsDeducted,
          newBalance: deductionResult.newBalance,
        }, 'Guardian Points deducted for refund');
      }
    } catch (err: any) {
      logger.error({ err, orderId: order._id }, 'Failed to deduct Guardian Points');
      // Non-critical — don't fail the refund
    }

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

  /**
   * Calculate the total amount already refunded for an order.
   *
   * @param orderId - Order ID
   * @returns Total refunded amount in cents/currency units
   */
  private async calculateTotalRefunded(orderId: mongoose.Types.ObjectId): Promise<number> {
    const result = await PaymentTransaction.aggregate([
      {
        $match: {
          orderId,
          type: 'refund',
          status: 'succeeded',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }
}

/** Singleton instance */
export const refundService = new RefundService();
