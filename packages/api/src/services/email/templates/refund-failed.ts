import { renderBase, renderCtaButton } from './base';

/**
 * Render "Refund Failed" email.
 *
 * Sent when Stripe reports the refund as failed.
 * Explains the failure and what happens next.
 */
export function renderRefundFailedEmail(data: {
  name: string;
  orderNumber: string;
  refundId: string;
  amount: number;
  currency: string;
  failureReason?: string;
  willRetry: boolean;
  viewOrderUrl: string;
}): string {
  const retryMessage = data.willRetry
    ? `<strong>What happens next:</strong> We will automatically retry this refund in 2 hours. If the second attempt also fails, our support team will be notified and reach out to you.`
    : `<strong>What happens next:</strong> Our support team has been notified and will reach out to you to arrange an alternative refund method (e.g. bank transfer).`;

  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>

    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      We were unable to process the refund for order <strong>${data.orderNumber}</strong>.
    </p>

    <div style="background-color:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b;font-size:14px;">
        Refund Status: Failed
      </p>
      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.5;">
        ${data.failureReason || 'The card issuer or bank declined the refund. This can happen if the card has expired, been cancelled, or has restrictions.'}
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
        <td style="padding:12px 16px;color:#374151;font-size:16px;font-weight:700;border-bottom:1px solid #e5e7eb;">$${data.amount.toFixed(2)} ${data.currency}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;">Failure Reason</td>
        <td style="padding:12px 16px;color:#991b1b;font-size:13px;">${data.failureReason || 'Unknown'}</td>
      </tr>
    </table>

    <p style="margin:20px 0;color:#374151;font-size:14px;line-height:1.5;">
      ${retryMessage}
    </p>

    ${renderCtaButton(data.viewOrderUrl, 'View Order Details')}

    <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">
      Questions? Reply to this email or contact <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>
    </p>
  `;

  return renderBase({
    title: 'Refund Needs Attention',
    subtitle: `Order ${data.orderNumber}`,
    preheader: `There was an issue processing your refund for order ${data.orderNumber}.`,
    bodyHtml,
  });
}
