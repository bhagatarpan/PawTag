import { Notification, Order, type IOrderDocument } from '@pawtag/db';
import { sendMail } from './email.service';
import { sendPushToUser } from './push-notification.service';
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
  const notifTitle = notifConfig.title;
  const notifMessage = notifConfig.getMessage(order.orderNumber, extra);

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

  // Record activity on the order timeline
  try {
    const activityType = newStatus;
    const activityMessage = notifConfig.getMessage(order.orderNumber, extra);
    await Order.findByIdAndUpdate(order._id, {
      $push: {
        activity: {
          type: activityType,
          message: activityMessage,
          timestamp: new Date(),
          actor: 'system',
          metadata: {
            trackingNumber: extra?.trackingNumber,
            carrier: extra?.carrier,
            reason: extra?.reason,
          },
        },
      },
    });
  } catch (err) {
    logger.error({ err, orderNumber: order.orderNumber }, 'Failed to record order activity');
  }

  // Send push notification
  await sendPushToUser(order.userId.toString(), notifTitle, notifMessage, {
    type: 'order_update',
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    status: newStatus,
  }).catch(() => {});

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
      logger.error({ err, orderNumber: order.orderNumber, status: newStatus }, 'Order status email error');
    }
  }

  return true;
}
