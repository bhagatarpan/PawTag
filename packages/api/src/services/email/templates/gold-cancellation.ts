import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface GoldCancellationEmailData {
  customerName: string;
  cancelledAt: string;
  currentPeriodEnd: string;
  dashboardUrl: string;
  resubscribeUrl: string;
}

export function renderGoldCancellationEmail(data: GoldCancellationEmailData): string {
  const { customerName, cancelledAt, currentPeriodEnd, dashboardUrl, resubscribeUrl } = data;

  const benefitsList = `
    <ul style="color:#92400e;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
      <li>2× points on every purchase</li>
      <li>Free shipping on orders over $50</li>
      <li>Priority customer support</li>
      <li>Early access to new products</li>
      <li>$3/month PawRewards</li>
    </ul>
  `;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>Gold Membership</strong> has been successfully cancelled.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Benefits you'll lose after ${currentPeriodEnd}:</p>
      ${benefitsList}
      <p style="color:#92400e;font-size:13px;margin:12px 0 0;">
        <strong>You'll keep your benefits until ${currentPeriodEnd}.</strong><br>
        No further charges will be made after this date.
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      We're sorry to see you go. If you change your mind, you can resubscribe anytime and immediately regain all Gold benefits.
    </p>

    <div style="display:flex;gap:12px;margin:24px 0;">
      ${renderCtaButton(resubscribeUrl, 'Resubscribe to Gold')}
      ${renderCtaButton(dashboardUrl, 'View Dashboard')}
    </div>

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Cancellation date: ${cancelledAt}<br>
      Benefits until: ${currentPeriodEnd}
    </p>
  `;

  return renderBase({
    title: 'Gold Membership Cancelled',
    subtitle: 'Gold Membership — Confirmation',
    theme: 'warning',
    bodyHtml,
  });
}
