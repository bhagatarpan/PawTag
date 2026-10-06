import { Notification, Order, User, type IOrderDocument } from '@pawtag/db';
import { sendCmsEmailOrFallback } from './email.service';
import { sendPushToUser } from './push-notification.service';
import {
  renderRefundProcessingEmail,
  renderRefundSettledEmail,
  renderRefundFailedEmail,
  renderOrderStatusEmail,
  renderOrderCancelledAlertEmail,
  renderRefundFailedAlertEmail,
} from './email/templates';
import logger from '../lib/logger';

interface StatusChangeExtra {
  trackingNumber?: string;
  carrier?: string;
  reason?: string;
}

// Generate carrier-specific tracking URL
export function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (!trackingNumber || !carrier) return '';
  const carrierLower = carrier.toLowerCase();
  if (carrierLower.includes('nz post') || carrierLower.includes('nzpost')) {
    return `https://www.nzpost.co.nz/tools/tracking/result?trackid=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('courierpost') || carrierLower.includes('courier post')) {
    return `https://www.courierpost.co.nz/tracking/${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('aramex')) {
    return `https://www.aramex.co.nz/track/shipment?ShipmentNumber=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/nz-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  }
  return '';
}

const STATUS_NOTIFICATIONS: Record<string, { title: string; getMessage: (orderNumber: string, extra?: StatusChangeExtra) => string }> = {
  packing: {
    title: 'Order being packed',
    getMessage: (orderNumber) => `Your order ${orderNumber} is being prepared for shipping.`,
  },
  paid: {
    title: 'Order confirmed',
    getMessage: (orderNumber) => `Your order ${orderNumber} has been confirmed and is being processed.`,
  },
  shipped: {
    title: 'Order shipped',
    getMessage: (orderNumber, extra) => `Your order ${orderNumber} has shipped via ${extra?.carrier || 'courier'}. Tracking: ${extra?.trackingNumber || 'N/A'}`,
  },
  delivered: {
    title: 'Order delivered',
    getMessage: (orderNumber) => `Your order ${orderNumber} has been delivered.`,
  },
  cancelled: {
    title: 'Order cancelled',
    getMessage: (orderNumber, extra) => `Your order ${orderNumber} has been cancelled.${extra?.reason ? ` Reason: ${extra.reason}` : ''}`,
  },
  refunded: {
    title: 'Order refunded',
    getMessage: (orderNumber, extra) => `Your order ${orderNumber} has been refunded.${extra?.reason ? ` Reason: ${extra.reason}` : ''}`,
  },
};

const STATUS_EMAILS: Record<string, { subject: (orderNumber: string) => string; html: (orderNumber: string, extra?: StatusChangeExtra) => string }> = {
  packing: {
    subject: (orderNumber) => `Order ${orderNumber} is being packed`,
    html: (orderNumber) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'packing', viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
  paid: {
    subject: (orderNumber) => `Order ${orderNumber} confirmed`,
    html: (orderNumber) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'paid', viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
  shipped: {
    subject: (orderNumber) => `Order ${orderNumber} has shipped`,
    html: (orderNumber, extra) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'shipped', trackingNumber: extra?.trackingNumber, carrier: extra?.carrier, trackingUrl: getTrackingUrl(extra?.carrier || '', extra?.trackingNumber || ''), viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
  delivered: {
    subject: (orderNumber) => `Order ${orderNumber} delivered`,
    html: (orderNumber) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'delivered', viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
  cancelled: {
    subject: (orderNumber) => `Order ${orderNumber} cancelled`,
    html: (orderNumber, extra) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'cancelled', reason: extra?.reason, viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
  refunded: {
    subject: (orderNumber) => `Order ${orderNumber} refunded`,
    html: (orderNumber, extra) => renderOrderStatusEmail({ orderNumber, customerName: 'Customer', status: 'refunded', reason: extra?.reason, viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` }),
  },
};

/**
 * Centralized customer notification for order status changes.
 * Creates an in-app notification, records activity, sends push, and sends email — all in parallel.
 *
 * Also sends admin notifications for cancelled/refunded orders.
 *
 * @returns true if notification was created, false if status doesn't require notification
 */
export async function notifyCustomerOfStatusChange(
  order: IOrderDocument,
  newStatus: string,
  extra?: StatusChangeExtra,
): Promise<boolean> {
  const notifConfig = STATUS_NOTIFICATIONS[newStatus];
  if (!notifConfig) return false;

  const { User } = await import('@pawtag/db');
  const user = await User.findById(order.userId);
  const email = user?.email;
  const customerName = user?.fullName || 'Customer';

  const notifTitle = notifConfig.title;
  const notifMessage = notifConfig.getMessage(order.orderNumber, extra);

  // Create in-app notification (must complete — caller expects this)
  await Notification.create({
    userId: order.userId,
    audience: 'customer',
    type: 'order_update',
    title: notifTitle,
    message: notifMessage,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: newStatus,
      trackingNumber: extra?.trackingNumber,
      carrier: extra?.carrier,
    },
    priority: newStatus === 'cancelled' || newStatus === 'refunded' ? 'high' : 'normal',
    channel: 'alert',
  });

  // Fire-and-forget: record activity, push, email, admin notification — all in parallel
  const sideEffects: Array<Promise<unknown>> = [];

  // Record activity on the order timeline
  sideEffects.push(
    Order.findByIdAndUpdate(order._id, {
      $push: {
        activity: {
          type: newStatus,
          message: notifMessage,
          timestamp: new Date(),
          actor: 'system',
          metadata: {
            trackingNumber: extra?.trackingNumber,
            carrier: extra?.carrier,
            reason: extra?.reason,
          },
        },
      },
    }).then(() => {}).catch((err) => {
      logger.error({ err, orderNumber: order.orderNumber }, 'Failed to record order activity');
    }),
  );

  // Send push notification
  sideEffects.push(
    sendPushToUser(order.userId.toString(), notifTitle, notifMessage, {
      type: 'order_update',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: newStatus,
    }).catch(() => {}),
  );

  // Send email — CMS first (order-status template), hardcoded fallback
  const emailConfig = STATUS_EMAILS[newStatus];
  if (emailConfig && email) {
    const viewOrderUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders`;
    const statusVars: Record<string, string> = {
      orderNumber: order.orderNumber,
      customerName,
      status: newStatus,
      viewOrderUrl,
      trackingNumber: extra?.trackingNumber || '',
      carrier: extra?.carrier || '',
      trackingUrl: getTrackingUrl(extra?.carrier || '', extra?.trackingNumber || ''),
      reason: extra?.reason || '',
    };
    sideEffects.push(
      sendCmsEmailOrFallback({
        slug: 'order-status',
        to: email,
        vars: statusVars,
        fallbackSubject: emailConfig.subject(order.orderNumber),
        fallbackHtml: emailConfig.html(order.orderNumber, extra),
        businessFlow: 'orders_commerce',
        relatedEntityType: 'order',
        relatedEntityId: order._id.toString(),
        relatedEntityDisplay: order.orderNumber,
      }).catch((err) => {
        logger.error({ err, orderNumber: order.orderNumber, status: newStatus }, 'Order status email error');
      }),
    );
  }

  // Admin notification for cancelled/refunded orders
  if (newStatus === 'cancelled' || newStatus === 'refunded') {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    sideEffects.push(
      Notification.create({
        userId: order.userId,
        audience: 'admin',
        type: 'order_update',
        title: `Order ${newStatus}`,
        message: `Order ${order.orderNumber} has been ${newStatus}.${extra?.reason ? ` Reason: ${extra.reason}` : ''}`,
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status: newStatus,
          reason: extra?.reason,
          amount: order.payment?.amount,
        },
        priority: 'high',
        channel: 'alert',
      }).then(() => {}).catch(() => {}),
    );

    if (adminEmail) {
      // CMS slug for cancelled admin alert; refund-complete uses order-status fallback wording
      const adminSlug = newStatus === 'cancelled' ? 'admin-order-alert' : 'order-status';
      const adminFallbackSubject = `Order ${order.orderNumber} ${newStatus}`;
      const adminFallbackHtml = newStatus === 'cancelled'
        ? renderOrderCancelledAlertEmail(order.orderNumber, customerName, email || '', order.payment?.amount || 0, extra?.reason)
        : renderOrderStatusEmail({ orderNumber: order.orderNumber, customerName, status: 'refunded', reason: extra?.reason, viewOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders` });
      sideEffects.push(
        sendCmsEmailOrFallback({
          slug: adminSlug,
          to: adminEmail,
          vars: {
            orderNumber: order.orderNumber,
            customerName,
            customerEmail: email || '',
            status: newStatus,
            amount: String(order.payment?.amount || 0),
            reason: extra?.reason || '',
          },
          fallbackSubject: adminFallbackSubject,
          fallbackHtml: adminFallbackHtml,
          businessFlow: 'admin_system',
          relatedEntityType: 'order',
          relatedEntityId: order._id.toString(),
          relatedEntityDisplay: order.orderNumber,
        }).catch((err) => {
          logger.error({ err }, 'Admin cancellation/refund notification email error');
        }),
      );
    }
  }

  // Wait for all side effects (don't block on failure)
  await Promise.allSettled(sideEffects);

  return true;
}

/**
 * Notify customer (and admin on failure) of a refund status update from Stripe.
 *
 * Called from the Stripe webhook handler when a refund event arrives:
 * - 'pending' → "Refund Processing" email
 * - 'succeeded' → "Refund Settled" email
 * - 'failed' → "Refund Failed" email + admin in-app alert + admin email
 *
 * @param order - The Order document
 * @param refund - Raw Stripe refund object
 * @param newStatus - Normalised refund status
 */
export async function notifyRefundUpdate(
  order: IOrderDocument,
  refund: any,
  newStatus: 'pending' | 'succeeded' | 'failed' | 'canceled',
): Promise<void> {
  const user = await User.findById(order.userId).select('fullName email').lean();
  if (!user) {
    logger.warn({ orderId: String(order._id) }, 'Cannot send refund notification: user not found');
    return;
  }

  const refundId = refund.id;
  const amount = (refund.amount || 0) / 100;
  const currency = (refund.currency || 'nzd').toUpperCase();
  const failureReason = refund.failure_reason as string | undefined;
  const arn = (refund.arn as string | undefined) || order.refundArn || undefined;
  const cardBrand = order.payment?.cardBrand;
  const cardLast4 = order.payment?.cardLast4;
  const destination = cardBrand
    ? `${cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1).toLowerCase()}${cardLast4 ? ` ••••${cardLast4}` : ''}`
    : undefined;
  const settledAt = new Date().toLocaleString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const expectedArrival = refund.arrival_date
    ? new Date(refund.arrival_date * 1000).toLocaleDateString('en-NZ', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : order.refundExpectedArrival
      ? new Date(order.refundExpectedArrival).toLocaleDateString('en-NZ', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : undefined;

  // Build order view URL (assumes public-facing domain)
  const baseUrl = process.env.PUBLIC_WEB_URL || 'http://localhost:3000';
  const viewOrderUrl = `${baseUrl}/account/orders/${order._id}`;

  // Customer email + push notification — CMS-first for refund lifecycle
  let subject = '';
  let html = '';
  let cmsSlug = 'refund-processing';
  let fallbackRendererHtml = '';

  const refundVars: Record<string, string> = {
    name: user.fullName || 'Customer',
    orderNumber: order.orderNumber,
    refundId,
    amount: amount.toFixed(2),
    currency,
    expectedArrival: expectedArrival || '',
    destination: destination || 'Original payment method',
    arn: arn || '',
    settledAt,
    failureReason: failureReason || '',
    willRetry: 'false',
    viewOrderUrl,
  };

  if (newStatus === 'pending') {
    cmsSlug = 'refund-processing';
    subject = `Refund Processing — Order ${order.orderNumber}`;
    html = renderRefundProcessingEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      amount,
      currency,
      expectedArrival,
      destination,
      viewOrderUrl,
    });
    fallbackRendererHtml = html;
  } else if (newStatus === 'succeeded') {
    cmsSlug = 'refund-settled';
    subject = `Refund Settled — Order ${order.orderNumber}`;

    // Look up credit note if it exists
    let creditNoteNumber: string | undefined;
    let creditNoteUrl: string | undefined;
    try {
      const { Invoice } = await import('@pawtag/db');
      const creditNote = await Invoice.findOne({ orderId: order._id, type: 'credit_note' }).sort({ createdAt: -1 }).lean();
      if (creditNote) {
        creditNoteNumber = creditNote.invoiceNumber;
        creditNoteUrl = `${baseUrl}/account/orders/${order._id}`;
      }
    } catch { /* non-critical */ }

    html = renderRefundSettledEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      arn,
      amount,
      currency,
      settledAt,
      destination,
      viewOrderUrl,
      creditNoteNumber,
      creditNoteUrl,
    });
    fallbackRendererHtml = html;
    refundVars.creditNoteNumber = creditNoteNumber || '';
    refundVars.creditNoteUrl = creditNoteUrl || '';
  } else if (newStatus === 'failed') {
    cmsSlug = 'refund-failed';
    subject = `Refund Update — Order ${order.orderNumber}`;
    const willRetry = (order.refundAttemptCount || 0) < 1;
    refundVars.willRetry = willRetry ? 'true' : 'false';
    html = renderRefundFailedEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      amount,
      currency,
      failureReason,
      destination,
      willRetry,
      viewOrderUrl,
    });
    fallbackRendererHtml = html;
  } else {
    // 'canceled' — no customer email, just log
    logger.info({ refundId, orderNumber: order.orderNumber }, 'Refund canceled — no customer email sent');
    return;
  }

  await Promise.allSettled([
    sendCmsEmailOrFallback({
      slug: cmsSlug,
      to: user.email,
      vars: refundVars,
      fallbackSubject: subject,
      fallbackHtml: fallbackRendererHtml,
      businessFlow: 'orders_commerce',
      relatedEntityType: 'order',
      relatedEntityId: order._id.toString(),
      relatedEntityDisplay: order.orderNumber,
    }).catch((err) => {
      logger.error({ err, refundId, email: user.email }, 'Refund email error');
    }),
    sendPushToUser(String(order.userId), subject, `Refund ${newStatus} for order ${order.orderNumber}`, {
      type: 'refund_update',
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      refundId,
      status: newStatus,
    }).catch(() => {}),
  ]);

  // Admin alert for failed refunds (in-app + email)
  if (newStatus === 'failed') {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    await Promise.allSettled([
      Notification.create({
        userId: order.userId,
        audience: 'admin',
        type: 'refund_failed',
        title: `Refund Failed: ${order.orderNumber}`,
        message: `Refund ${refundId} of $${amount.toFixed(2)} failed. Reason: ${failureReason || 'Unknown'}. ${(order.refundAttemptCount || 0) < 1 ? 'Auto-retry scheduled.' : 'Manual intervention required.'}`,
        data: { orderId: String(order._id), refundId, amount, failureReason },
        priority: 'high',
        channel: 'alert',
      }).catch(() => {}),
      adminEmail
        ? sendCmsEmailOrFallback({
            slug: 'admin-refund-failed',
            to: adminEmail,
            vars: {
              orderNumber: order.orderNumber,
              refundId,
              amount: amount.toFixed(2),
              currency,
              failureReason: failureReason || 'Unknown',
              customerName: user.fullName,
              customerEmail: user.email,
              retryNote: (order.refundAttemptCount || 0) < 1 ? 'Auto-retry scheduled in 2h.' : 'Manual intervention required.',
            },
            fallbackSubject: `[ACTION REQUIRED] Refund Failed — ${order.orderNumber}`,
            fallbackHtml: renderRefundFailedAlertEmail(order.orderNumber, refundId, amount, currency, failureReason || 'Unknown', user.fullName, user.email, (order.refundAttemptCount || 0) < 1 ? 'Auto-retry scheduled in 2h.' : 'Manual intervention required.'),
            businessFlow: 'admin_system',
            relatedEntityType: 'order',
            relatedEntityId: order._id.toString(),
            relatedEntityDisplay: order.orderNumber,
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  }
}
