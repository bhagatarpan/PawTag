import { renderBase, renderCtaButton } from './base';

export function renderShippingNotificationEmail(data: {
  name: string;
  orderNumber: string;
  trackingNumber: string;
  carrier?: string;
  trackingUrl?: string;
  viewOrderUrl: string;
}): string {
  const trackingButton = data.trackingUrl
    ? `<a href="${data.trackingUrl}" target="_blank" style="display:inline-block;background-color:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:12px;margin:8px 0;">
        Track Your Shipment →
      </a>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Great news! Your order has been shipped and is on its way to you.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background-color:#f0fdfa;border-radius:8px;border:1px solid #ccfbf1;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Tracking Number</p>
          <p style="margin:0 0 8px;color:#0f766e;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:1px;">${data.trackingNumber}</p>
          ${data.carrier ? `<p style="margin:0;color:#6b7280;font-size:13px;">Via ${data.carrier}</p>` : ''}
        </td>
      </tr>
    </table>

    ${trackingButton}

    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.5;">
      Order: <strong style="color:#374151;">${data.orderNumber}</strong>
    </p>

    ${renderCtaButton(data.viewOrderUrl, 'View Order')}
  `;

  return renderBase({
    title: 'Your Order Has Shipped',
    subtitle: `Order ${data.orderNumber}`,
    preheader: `Your PawTag order ${data.orderNumber} has been shipped. Tracking: ${data.trackingNumber}`,
    bodyHtml,
  });
}
