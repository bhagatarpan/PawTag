import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface SubscriptionResumedEmailData {
  customerName: string;
  planName: string;
  resumedAt: string;
  nextBillingDate: string;
  dashboardUrl: string;
}

export function renderSubscriptionResumedEmail(data: SubscriptionResumedEmailData): string {
  const { customerName, planName, resumedAt, nextBillingDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>${planName}</strong> auto-renewal has been successfully reactivated.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">What happens next:</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Resumed on:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${resumedAt}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Next billing date:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${nextBillingDate}</td>
        </tr>
      </table>
    `)}

    ${renderCtaButton(dashboardUrl, 'View Your Subscription')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      You can manage or pause auto-renew anytime from your account settings.
    </p>
  `;

  return renderBase({
    title: 'Auto-Renewal Reactivated',
    subtitle: `${planName} — Confirmed`,
    theme: 'success',
    bodyHtml,
  });
}
