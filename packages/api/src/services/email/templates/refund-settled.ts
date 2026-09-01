import { renderBase, renderCtaButton } from './base';

/**
 * Render "Refund Settled" email.
 *
 * Sent when the refund has fully settled (status: 'succeeded').
 * Confirms the refund is complete and includes ARN.
 */
export function renderRefundSettledEmail(data: {
  name: string;
  orderNumber: string;
  refundId: string;
  arn?: string;
  amount: number;
  currency: string;
  settledAt: string;
  viewOrderUrl: string;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>

    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your refund for order <strong>${data.orderNumber}</strong> has been successfully processed.
    </p>

    <div style="background-color:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#166534;font-size:14px;">
        Refund Status: Settled
      </p>
      <p style="margin:0;color:#14532d;font-size:14px;line-height:1.5;">
        The refund of <strong>$${data.amount.toFixed(2)} ${data.currency}</strong> has been processed by your bank. Depending on your bank's processing time, the funds may take 1–3 additional business days to appear on your statement.
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;width:40%;">Refund ID</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-family:monospace;border-bottom:1px solid #e5e7eb;">${data.refundId}</td>
      </tr>
      ${data.arn ? `
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">ARN (Bank Reference)</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-family:monospace;border-bottom:1px solid #e5e7eb;">${data.arn}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Order</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-family:monospace;border-bottom:1px solid #e5e7eb;">${data.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">Refund Amount</td>
        <td style="padding:12px 16px;color:#0d9488;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;">$${data.amount.toFixed(2)} ${data.currency}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;">Settled At</td>
        <td style="padding:12px 16px;color:#6b7280;font-size:13px;">${data.settledAt}</td>
      </tr>
    </table>

    <p style="margin:20px 0;color:#6b7280;font-size:13px;line-height:1.5;">
      <strong>Need to trace this at your bank?</strong> ${data.arn ? `The Acquirer Reference Number (ARN) is shown above. Your bank can use this to locate the refund.` : 'Contact your bank and quote the Refund ID to trace the transaction.'}
    </p>

    ${renderCtaButton(data.viewOrderUrl, 'View Order Details')}

    <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">
      Questions? Reply to this email or contact <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>
    </p>
  `;

  return renderBase({
    title: 'Refund Settled',
    subtitle: `Order ${data.orderNumber}`,
    preheader: `Your refund of $${data.amount.toFixed(2)} for order ${data.orderNumber} has been processed.`,
    bodyHtml,
  });
}
