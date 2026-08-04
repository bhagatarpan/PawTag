import { Notification, type IOrderDocument } from '@pawtag/db';
import { sendMail } from './email.service';

interface StatusChangeExtra {
  trackingNumber?: string;
  carrier?: string;
  reason?: string;
}

const STATUS_NOTIFICATIONS: Record<string, { title: string; getMessage: (orderNumber: string, extra?: StatusChangeExtra) => string }> = {
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
  paid: {
    subject: (orderNumber) => `Order ${orderNumber} confirmed`,
    html: (orderNumber) => `<h2>Order Confirmed</h2><p>Your order <strong>${orderNumber}</strong> has been confirmed and is being processed.</p>`,
  },
  shipped: {
    subject: (orderNumber) => `Order ${orderNumber} has shipped`,
    html: (orderNumber, extra) => `<h2>Order Shipped</h2>
      <p>Your order <strong>${orderNumber}</strong> has shipped!</p>
      <p><strong>Carrier:</strong> ${extra?.carrier || 'Courier'}</p>
      <p><strong>Tracking:</strong> ${extra?.trackingNumber || 'N/A'}</p>`,
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
 * Creates an in-app notification and sends an email.
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

  // Create in-app notification
  await Notification.create({
    userId: order.userId,
    audience: 'customer',
    type: 'order_update',
    title: notifConfig.title,
    message: notifConfig.getMessage(order.orderNumber, extra),
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

  // Send email
  const emailConfig = STATUS_EMAILS[newStatus];
  if (emailConfig && email) {
    try {
      await sendMail(
        email,
        emailConfig.subject(order.orderNumber),
        emailConfig.html(order.orderNumber, extra),
      );
    } catch (err) {
      console.error(`Order ${newStatus} email error:`, err);
    }
  }

  return true;
}
