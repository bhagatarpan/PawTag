import { renderBase, renderCtaButton } from './base';

/**
 * Render "Refund Processing" email.
 *
 * Sent when a refund is first initiated via Stripe (status: 'pending').
 * Tells the customer the refund is being processed.
 */
export function renderRefundProcessingEmail(data: {
  name: string;
  orderNumber: string;
  refundId: string;
  amount: number;
  currency: string;
  expectedArrival?: string;
  viewOrderUrl: string;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>

    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your refund for order <strong>${data.orderNumber}</strong> is being processed.
    </p>

    <div style="background-color:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#1e40af;font-size:14px;">
        Refund Status: Processing
      </p>
      <p style="margin:0;color:#1e3a8a;font-size:14px;line-height:1.5;">
        Stripe has accepted your refund and is processing it. Funds typically take 5–10 business days to appear on your statement after settlement.
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;width:40%;">Refund ID</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-family:monospace;border-bottom:1px solid #e5e7eb;">${data.refundId}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Order</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-family:monospace;border-bottom:1px solid #e5e7eb;">${data.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Refund Amount</td>
        <td style="padding:12px 16px;color:#0d9488;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;">$${data.amount.toFixed(2)} ${data.currency}</td>
      </tr>
      ${data.expectedArrival ? `
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;">Expected Arrival</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;">${data.expectedArrival}</td>
      </tr>` : ''}
    </table>

    ${renderCtaButton(data.viewOrderUrl, 'View Order Details')}

    <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">
      Questions? Reply to this email or contact <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>
    </p>
  `;

  return renderBase({
    title: 'Refund Processing',
    subtitle: `Order ${data.orderNumber}`,
    preheader: `Your refund of $${data.amount.toFixed(2)} for order ${data.orderNumber} is being processed.`,
    bodyHtml,
  });
}
