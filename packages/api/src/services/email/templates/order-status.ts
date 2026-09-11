import { renderBase, renderCtaButton, renderDataTable, renderStatusCard } from './base';

interface OrderStatusData {
  orderNumber: string;
  customerName: string;
  status: 'packing' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  reason?: string;
  viewOrderUrl: string;
}

const STATUS_CONFIG: Record<string, { label: string; subject: string; cardVariant: 'info' | 'success' | 'warning' | 'processing' }> = {
  packing:   { label: 'Being Packed', subject: 'is being packed', cardVariant: 'processing' },
  paid:      { label: 'Confirmed', subject: 'confirmed', cardVariant: 'success' },
  shipped:   { label: 'Shipped', subject: 'has shipped', cardVariant: 'info' },
  delivered: { label: 'Delivered', subject: 'delivered', cardVariant: 'success' },
  cancelled: { label: 'Cancelled', subject: 'cancelled', cardVariant: 'warning' },
  refunded:  { label: 'Refunded', subject: 'refunded', cardVariant: 'info' },
};

export function renderOrderStatusEmail(data: OrderStatusData): string {
  const config = STATUS_CONFIG[data.status] || STATUS_CONFIG.paid;

  const statusCard = renderStatusCard(
    config.cardVariant,
    `Order ${config.label}`,
    `Your order ${data.orderNumber} has been ${config.subject}.`
  );

  let extraInfo = '';
  if (data.status === 'shipped' && data.trackingNumber) {
    const trackingLink = data.trackingUrl
      ? `<a href="${data.trackingUrl}" style="color:#0d9488;text-decoration:none;font-weight:600;">${data.trackingNumber}</a>`
      : data.trackingNumber;
    extraInfo = `
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Tracking</p>
        <p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${trackingLink}</p>
        ${data.carrier ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">via ${data.carrier}</p>` : ''}
      </div>`;
  }

  if (data.status === 'cancelled' && data.reason) {
    extraInfo = renderStatusCard('warning', 'Cancellation Reason', data.reason);
  }

  if (data.status === 'refunded' && data.reason) {
    extraInfo = renderStatusCard('info', 'Refund Reason', data.reason);
  }

  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.customerName},</p>
    ${statusCard}
    ${extraInfo}
    ${renderCtaButton(data.viewOrderUrl, 'View Order')}
  `;

  return renderBase({
    title: `Order ${data.orderNumber} ${config.subject}`,
    subtitle: `Order ${data.orderNumber}`,
    bodyHtml,
  });
}
