import { renderBase, renderCtaButton } from './base';

export function renderOrderConfirmationEmail(data: {
  name: string;
  orderNumber: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number; variantName?: string; petName?: string }>;
  total: number;
  shippingAddress: { line1: string; city: string; state: string; zip: string };
  viewOrderUrl: string;
}): string {
  const itemRows = data.items.map((item) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">
        ${item.productName}
        ${item.variantName ? `<br><span style="color:#6b7280;font-size:12px;">${item.variantName}</span>` : ''}
        ${item.petName ? `<br><span style="color:#0d9488;font-size:12px;">For: ${item.petName}</span>` : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151;font-size:14px;">${item.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;font-size:14px;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Thank you for your order! We're processing it now and will notify you when it ships.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background-color:#f9fafb;">
          <th style="padding:12px 16px;text-align:left;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Item</th>
          <th style="padding:12px 16px;text-align:center;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Qty</th>
          <th style="padding:12px 16px;text-align:right;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background-color:#f9fafb;">
          <td colspan="2" style="padding:12px 16px;font-weight:700;color:#374151;font-size:14px;">Total</td>
          <td style="padding:12px 16px;text-align:right;font-weight:700;color:#0d9488;font-size:16px;">$${data.total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 6px;font-weight:600;color:#374151;font-size:13px;">Shipping to:</p>
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5;">
            ${data.shippingAddress.line1}<br>
            ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zip}
          </p>
        </td>
      </tr>
    </table>

    ${renderCtaButton(data.viewOrderUrl, 'View Order')}

    <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">
      Questions? Reply to this email or contact <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>
    </p>
  `;

  return renderBase({
    title: 'Order Confirmed',
    subtitle: `Order ${data.orderNumber}`,
    preheader: `Your PawTag order ${data.orderNumber} has been confirmed. Total: $${data.total.toFixed(2)}`,
    bodyHtml,
  });
}
