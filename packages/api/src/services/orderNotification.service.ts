import { Notification, Order, User, type IOrderDocument } from '@pawtag/db';
import { sendMail } from './email.service';
import { sendPushToUser } from './push-notification.service';
import {
  renderRefundProcessingEmail,
  renderRefundSettledEmail,
  renderRefundFailedEmail,
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
    html: (orderNumber) => `<h2>Order Being Packed</h2><p>Your order <strong>${orderNumber}</strong> is being prepared for shipping.</p>`,
  },
  paid: {
    subject: (orderNumber) => `Order ${orderNumber} confirmed`,
    html: (orderNumber) => `<h2>Order Confirmed</h2><p>Your order <strong>${orderNumber}</strong> has been confirmed and is being processed.</p>`,
  },
  shipped: {
    subject: (orderNumber) => `Order ${orderNumber} has shipped`,
    html: (orderNumber, extra) => {
      const trackingUrl = getTrackingUrl(extra?.carrier || '', extra?.trackingNumber || '');
      return `<h2>Order Shipped</h2>
      <p>Your order <strong>${orderNumber}</strong> has shipped!</p>
      <p><strong>Carrier:</strong> ${extra?.carrier || 'Courier'}</p>
      <p><strong>Tracking:</strong> ${extra?.trackingNumber || 'N/A'}</p>
      ${trackingUrl ? `<p><a href="${trackingUrl}" target="_blank" style="display:inline-block;background-color:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:12px;">Track Your Shipment →</a></p>` : ''}`;
    },
  },
  delivered: {
    subject: (orderNumber) => `Order ${orderNumber} delivered`,
    html: (orderNumber) => `<h2>Order Delivered</h2><p>Your order <strong>${orderNumber}</strong> has been delivered.</p>`,
  },
  cancelled: {
    subject: (orderNumber) => `Order ${orderNumber} cancelled`,
    html: (orderNumber, extra) => `<h2>Order Cancelled</h2>
      <p>Your order <strong>${orderNumber}</strong> has been cancelled.</p>
      ${extra?.reason ? `<p><strong>Reason:</strong> ${extra.reason}</p>` : ''}`,
  },
  refunded: {
    subject: (orderNumber) => `Order ${orderNumber} refunded`,
    html: (orderNumber, extra) => `<h2>Order Refunded</h2>
      <p>Your order <strong>${orderNumber}</strong> has been refunded.</p>
      ${extra?.reason ? `<p><strong>Reason:</strong> ${extra.reason}</p>` : ''}`,
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

  // Send email
  const emailConfig = STATUS_EMAILS[newStatus];
  if (emailConfig && email) {
    sideEffects.push(
      sendMail(
        email,
        emailConfig.subject(order.orderNumber),
        emailConfig.html(order.orderNumber, extra),
      ).catch((err) => {
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
      sideEffects.push(
        sendMail(
          adminEmail,
          `Order ${order.orderNumber} ${newStatus}`,
          `<h2>Order ${newStatus === 'cancelled' ? 'Cancelled' : 'Refunded'}</h2>
           <p><strong>Order:</strong> ${order.orderNumber}</p>
           <p><strong>Customer:</strong> ${customerName} (${email})</p>
           <p><strong>Amount:</strong> $${order.payment?.amount?.toFixed(2) || '0.00'} NZD</p>
           ${extra?.reason ? `<p><strong>Reason:</strong> ${extra.reason}</p>` : ''}`,
        ).catch((err) => {
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
  const settledAt = new Date().toLocaleString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const expectedArrival = refund.arrival_date
    ? new Date(refund.arrival_date * 1000).toLocaleDateString('en-NZ', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : undefined;

  // Build order view URL (assumes public-facing domain)
  const baseUrl = process.env.PUBLIC_WEB_URL || 'http://localhost:3000';
  const viewOrderUrl = `${baseUrl}/account/orders/${order._id}`;

  // Customer email + push notification
  let subject = '';
  let html = '';

  if (newStatus === 'pending') {
    subject = `Refund Processing — Order ${order.orderNumber}`;
    html = renderRefundProcessingEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      amount,
      currency,
      expectedArrival,
      viewOrderUrl,
    });
  } else if (newStatus === 'succeeded') {
    subject = `Refund Settled — Order ${order.orderNumber}`;
    html = renderRefundSettledEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      arn: undefined,
      amount,
      currency,
      settledAt,
      viewOrderUrl,
    });
  } else if (newStatus === 'failed') {
    subject = `Refund Update — Order ${order.orderNumber}`;
    const willRetry = (order.refundAttemptCount || 0) < 1;
    html = renderRefundFailedEmail({
      name: user.fullName || 'Customer',
      orderNumber: order.orderNumber,
      refundId,
      amount,
      currency,
      failureReason,
      willRetry,
      viewOrderUrl,
    });
  } else {
    // 'canceled' — no customer email, just log
    logger.info({ refundId, orderNumber: order.orderNumber }, 'Refund canceled — no customer email sent');
    return;
  }

  await Promise.allSettled([
    sendMail(user.email, subject, html).catch((err) => {
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
        ? sendMail(
            adminEmail,
            `[ACTION REQUIRED] Refund Failed — ${order.orderNumber}`,
            `<h2>Refund Failed</h2>
             <p><strong>Order:</strong> ${order.orderNumber}</p>
             <p><strong>Refund ID:</strong> ${refundId}</p>
             <p><strong>Amount:</strong> $${amount.toFixed(2)} ${currency}</p>
             <p><strong>Reason:</strong> ${failureReason || 'Unknown'}</p>
             <p><strong>Customer:</strong> ${user.fullName} (${user.email})</p>
             <p><strong>Action needed:</strong> ${(order.refundAttemptCount || 0) < 1 ? 'Auto-retry scheduled in 2h.' : 'Manual intervention required.'}</p>`,
          ).catch(() => {})
        : Promise.resolve(),
    ]);
  }
}
